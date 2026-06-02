<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import logoUrl from './assets/logo.jpg'
import { getDiatonicChords, SCALES, getScaleNotes } from './core/scales.js'
import { formatChord } from './core/chords.js'
import { generatePDF } from './core/pdfExport.js'
import { getKeySignatureString, getKeySignature, getParentKeyRoot, SCALE_PARENTS } from './core/keySignatures.js'
import { getSuggestionsForSystem, applySuggestion, getChordDegree, analyzeModulationRelationship } from './core/suggestions.js'
import { NOTE_TO_INDEX, transposeNote } from './core/notes.js'
import { getTransposedChord } from './core/transpose.js'
const generateUniqueId = () => {
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}
// --- FREE vs PRO STATE ---
const currentPlan = ref('FREE')
const viewMode = ref('compact')
const isUpgradeModalOpen = ref(false)
const upgradeReason = ref('')
// --- TRANSPOSE STATE ---
const isTransposeModalOpen = ref(false)
const transposeTargetKey = ref('C')
const transposeTargetScale = ref('major')
const transposeMode = ref('tonal') // 'tonal', 'modal', 'functional'
const transposeScope = ref('all') // 'all', 'section'
// --- LYRICS STATE ---
const showLyricsGlobal = ref(false)
const hoveredMeasureIndex = ref(null)
const activeEditingLyricsIndex = ref(null)
const pendingSelection = ref(null)
const hoveredChordId = ref(null)
const hoveredAnchor = ref(null)
const activeConnectors = ref([])
// --- RESPONSIVE STATE FOR AUTO-ORDERING ---
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const handleResize = () => {
  windowWidth.value = window.innerWidth
  updateConnectors()
}
// --- WIZARD / SETUP STATE ---
const isSetupMode = ref(true)
const configTitle = ref('Mi Canción')
const configMeasuresCount = ref(8)
const configKey = ref('C')
const configScale = ref('major')
const configTimeSignature = ref(4)
const configTimeSignatureUnit = ref(4)
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
const timeSignatureUnit = ref(4)
const key = ref('C')
const scaleType = ref('major')
const measures = ref([])
const repeats = ref([])
const globalGroove = ref('Ninguno')
const globalShowObligado = ref(false)
const globalShowSubdivisions = computed({
  get() {
    return measures.value.some(m => m.showSubdivisions !== false)
  },
  set(on) {
    measures.value.forEach(m => {
      m.showSubdivisions = on
    })
  }
})
const tempMeasureGroove = ref('global')
// --- UNDO HISTORY STATE & OPERATIONS ---
const undoStack = ref([])

const saveHistory = () => {
  const stateCopy = {
    measures: JSON.parse(JSON.stringify(measures.value)),
    timeSignature: timeSignature.value,
    timeSignatureUnit: timeSignatureUnit.value,
    globalGrouping: globalGrouping.value ? [...globalGrouping.value] : null,
    globalGroove: globalGroove.value,
    keyRoot: key.value,
    scaleType: scaleType.value,
    tiedSlots: Array.from(tiedSlots.value),
    repeats: JSON.parse(JSON.stringify(repeats.value))
  }
  
  if (undoStack.value.length >= 50) {
    undoStack.value.shift()
  }
  undoStack.value.push(stateCopy)
}

const undo = () => {
  if (undoStack.value.length === 0) return
  
  const prevState = undoStack.value.pop()
  
  measures.value = prevState.measures
  timeSignature.value = prevState.timeSignature
  timeSignatureUnit.value = prevState.timeSignatureUnit
  globalGrouping.value = prevState.globalGrouping
  globalGroove.value = prevState.globalGroove
  key.value = prevState.keyRoot
  scaleType.value = prevState.scaleType
  tiedSlots.value = new Set(prevState.tiedSlots)
  repeats.value = prevState.repeats || []
  
  showToast("Deshacer completado ↩️")
}

const selectKey = (k) => {
  saveHistory()
  key.value = k
  activeDropdown.value = null
}

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
    globalShowObligado.value = false
    measures.value.forEach(m => {
      m.groove = 'global'
      m.showObligado = false
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
  timeSignatureUnit.value = configTimeSignatureUnit.value
  globalGrouping.value = getDefaultGrouping(configTimeSignature.value, configTimeSignatureUnit.value)
  customGlobalBeats.value = configTimeSignature.value
  customGlobalUnit.value = configTimeSignatureUnit.value
  key.value = configKey.value
  scaleType.value = configScale.value
  globalGroove.value = 'Ninguno'
  
  // Reset all layout toggles to OFF when entering the editor
  globalShowObligado.value = false
  showLyricsGlobal.value = false
  
  const limit = currentPlan.value === 'PRO' ? 999 : 20
  const count = Math.min(Math.max(configMeasuresCount.value, 1), limit)
  const emptyMeasures = []
  for(let i = 0; i < count; i++) {
    const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
    emptyMeasures.push({
      id: generateUniqueId(),
      beats: emptyBeats,
      sectionLabel: null,
      showObligado: globalShowObligado.value,
      showSubdivisions: false,
      lyrics: {
        rawText: '',
        mode: 'free'
      }
    })
  }
  measures.value = emptyMeasures
  repeats.value = []
  undoStack.value = [] // Reset undo history for the new project
  isSetupMode.value = false
  syncMeasuresBeats()
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
const isCharacteristicNote = (scale, index) => {
  if (scale === 'dorian') return index === 5
  if (scale === 'phrygian') return index === 1
  if (scale === 'lydian') return index === 3
  if (scale === 'mixolydian') return index === 6
  if (scale === 'locrian') return index === 1 || index === 4
  if (scale === 'harmonic_minor') return index === 6
  if (scale === 'locrian_sharp6') return index === 1 || index === 4 || index === 5
  if (scale === 'ionian_sharp5') return index === 4
  if (scale === 'dorian_sharp4') return index === 3 || index === 5
  if (scale === 'phrygian_dominant') return index === 1 || index === 2
  if (scale === 'lydian_sharp2') return index === 1 || index === 3
  if (scale === 'ultralocrian') return index === 1 || index === 3 || index === 4 || index === 5
  if (scale === 'melodic_minor') return index === 5 || index === 6
  if (scale === 'dorian_flat2') return index === 1 || index === 5
  if (scale === 'lydian_augmented') return index === 3 || index === 4
  if (scale === 'lydian_dominant') return index === 3 || index === 6
  if (scale === 'mixolydian_flat6') return index === 5 || index === 6
  if (scale === 'locrian_sharp2') return index === 1 || index === 4
  if (scale === 'altered') return index === 1 || index === 2 || index === 4 || index === 5
  if (scale === 'diminished_wh') return true
  if (scale === 'diminished_hw') return index === 1 || index === 2 || index === 4 || index === 6
  if (scale === 'whole_tone') return index === 3 || index === 4
  if (scale === 'pentatonic_major') return true
  if (scale === 'pentatonic_minor') return index === 1 || index === 4
  if (scale === 'blues') return index === 3 || index === 1 || index === 5
  if (scale === 'bebop_dominant') return index === 6 || index === 7
  if (scale === 'hungarian_major') return index === 1 || index === 3
  if (scale === 'hungarian_gypsy_minor') return index === 3 || index === 6
  return false
}
const translateCategory = (cat) => {
  const dict = {
    major_minor: 'Mayor / Menor',
    greek_modes: 'Modo Griego',
    harmonic_minor_modes: 'Modo de la Menor Armónica',
    melodic_minor_modes: 'Modo de la Menor Melódica',
    symmetric: 'Escala Simétrica',
    universal: 'Escala Universal',
    exotic: 'Escala Exótica',
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
const transposePreview = computed(() => {
  if (!isTransposeModalOpen.value) return []
  
  const activeM = selectedMeasureIndex.value !== -1 ? measuresWithKey.value[selectedMeasureIndex.value] : null
  const sourceKey = activeM ? activeM.activeKey : key.value
  const sourceScale = activeM ? activeM.activeScale : scaleType.value
  
  const targetKey = transposeTargetKey.value
  const targetScale = transposeTargetScale.value
  const mode = transposeMode.value
  const scope = transposeScope.value
  
  let measuresToPreview = []
  if (scope === 'section') {
    measuresToPreview = measuresWithKey.value.filter(m => m.activeKey === sourceKey && m.activeScale === sourceScale)
  } else {
    measuresToPreview = measuresWithKey.value
  }
  
  const uniqueChords = []
  const chordKeys = new Set()
  measuresToPreview.forEach(m => {
    m.beats.forEach(b => {
      if (b.root) {
        const keyStr = `${b.root}_${b.type}`
        if (!chordKeys.has(keyStr)) {
          chordKeys.add(keyStr)
          uniqueChords.push({ root: b.root, type: b.type, activeKey: m.activeKey, activeScale: m.activeScale })
        }
      }
    })
  })
  
  return uniqueChords.map(c => {
    const targetChord = getTransposedChord(c.root, c.type, c.activeKey, c.activeScale, targetKey, targetScale, mode, sourceKey)
    return {
      from: `${c.root}${c.type || ''}`,
      to: `${targetChord.root}${targetChord.type || ''}`
    }
  })
})
const transposeEducationNotes = computed(() => {
  if (!isTransposeModalOpen.value) return null
  
  const activeM = selectedMeasureIndex.value !== -1 ? measuresWithKey.value[selectedMeasureIndex.value] : null
  const sourceKey = activeM ? activeM.activeKey : key.value
  const sourceScale = activeM ? activeM.activeScale : scaleType.value
  
  const targetScale = transposeTargetScale.value
  
  if (sourceScale === targetScale) return null
  
  const compareKey = sourceKey
  const sourceNotes = getScaleNotes(compareKey, sourceScale)
  const targetNotes = getScaleNotes(compareKey, targetScale)
  
  const sourceDef = SCALES[sourceScale]
  const targetDef = SCALES[targetScale]
  if (!sourceDef || !targetDef) return null
  
  const changes = []
  const len = Math.min(sourceNotes.length, targetNotes.length)
  for (let i = 0; i < len; i++) {
    const sNote = sourceNotes[i]
    const tNote = targetNotes[i]
    if (sNote !== tNote) {
      changes.push({
        degree: sourceDef.degrees[i]?.numeral || `${i+1}`,
        from: sNote,
        to: tNote
      })
    }
  }
  
  let scaleDesc = ''
  if (sourceScale === 'major' && targetScale === 'dorian') {
    scaleDesc = 'Sonoridad más modal y melancólica (carácter menor con el brillo distintivo de la sexta mayor).'
  } else if (sourceScale === 'major' && targetScale === 'phrygian') {
    scaleDesc = 'Sonoridad muy tensa y misteriosa, de carácter flamenco y español.'
  } else if (sourceScale === 'minor' && targetScale === 'harmonic_minor') {
    scaleDesc = 'Sonoridad dramática y exótica con fuerte empuje tonal por la sensible mayor.'
  } else if (targetScale === 'hungarian_major') {
    scaleDesc = 'Color brillante y cinemático, muy exótico por la segunda aumentada.'
  } else if (targetScale === 'hungarian_gypsy_minor') {
    scaleDesc = 'Ambiente dramático de tensión gitana y metal neoclásico oscuro.'
  } else {
    scaleDesc = `Transición del color de ${sourceDef.name} al de ${targetDef.name}.`
  }
  
  return {
    changes,
    scaleDesc
  }
})
const groupedScales = computed(() => {
  const groups = {
    major_minor: { label: 'Mayor / Menor', items: [] },
    greek_modes: { label: 'Modos Griegos', items: [] },
    harmonic_minor_modes: { label: 'Modos de la Menor Armónica', items: [] },
    melodic_minor_modes: { label: 'Modos de la Menor Melódica', items: [] },
    symmetric: { label: 'Escalas Simétricas', items: [] },
    universal: { label: 'Nivel 5 — Escalas Universales', items: [] },
    exotic: { label: 'Nivel 6 — Escalas Exóticas', items: [] },
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
      return `La escala de <strong>${scaleName}</strong> (menor húngara o doble armónica menor) es una de las escalas exóticas más importantes para composición cinematográfica, metal neoclásico y música gitana. Combina la estructura de la menor armónica con el intervalo de cuarta aumentada (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>) del modo lidio, conteniendo simultáneamente <strong>♯4</strong> y <strong>7</strong> (sensible mayor). En esta tonalidad, sus notas son <strong>${notesStr}</strong>.`
    case 'hungarian_major':
      return `La escala de <strong>${scaleName}</strong> (mayor húngara) modifica la escala mayor elevando la segunda (<strong>♯2</strong> / <strong>${notesSpanish[1]}</strong>) y la cuarta (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>). El resultado es una sonoridad brillante, exótica y muy utilizada en música gitana, bandas sonoras, fantasía y composición cinematográfica. En esta tonalidad, está compuesta por las notas <strong>${notesStr}</strong>.`
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
  saveHistory()
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
      activeScale: currentScale,
      activeTimeSignature: getMeasureTimeSignature(idx),
      activeGrouping: getMeasureGrouping(idx)
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
        
        if (start > end || end > measuresWithKey.value.length) {
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
const applyToAllSubslots = ref(true)
const isRhythmPromptOpen = ref(false)
const rhythmPromptTargetChord = ref(null)
const rhythmPromptSlotIndex = ref(null)
const rhythmPromptBeat = ref(null)
const rhythmPromptMeasure = ref(null)
const rhythmPromptMatchingPatterns = ref([])
const selectedBeat = ref(null)
const modalComplexity = ref('tetrad') 
const tiedSlots = ref(new Set())
const toastMessage = ref('')
const toastTimeout = ref(null)

const autoCompleteMeasure = (measure) => {
  if (!measure) return
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  
  let remaining = getMeasureRemainingBeats(measure)
  if (remaining <= 0) return
  
  const numBeats = sig.beats
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.beats[i] || { root: '', type: '' },
    isMerged: false
  }))
  
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    const beat = states[i].beat
    if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
      const dur = getBeatSlotDuration(measure, beat, i)
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
    }
  }

  let idx = 0
  while (idx < numBeats) {
    if (states[idx].isMerged || measure.beats[idx].root !== '' || (measure.beats[idx].harmonicRhythm && measure.beats[idx].harmonicRhythm !== 'auto')) {
      idx++
      continue
    }
    
    let consecutive = 0
    let tempIdx = idx
    while (tempIdx < numBeats && !states[tempIdx].isMerged && measure.beats[tempIdx].root === '' && !measure.beats[tempIdx].harmonicRhythm) {
      consecutive++
      tempIdx++
    }
    
    let runRemaining = consecutive
    let currentIdx = idx
    while (runRemaining > 0) {
      let fitRhythm = 'eighth'
      let fitDur = 1
      
      if (isDenom8) {
        if (runRemaining >= 8) {
          fitRhythm = 'whole'
          fitDur = 8
        } else if (runRemaining >= 6) {
          fitRhythm = 'dotted-half'
          fitDur = 6
        } else if (runRemaining >= 4) {
          fitRhythm = 'double'
          fitDur = 4
        } else if (runRemaining >= 3) {
          fitRhythm = 'dotted-quarter'
          fitDur = 3
        } else if (runRemaining >= 2) {
          fitRhythm = 'quarter'
          fitDur = 2
        } else {
          fitRhythm = 'eighth'
          fitDur = 1
        }
      } else {
        if (runRemaining >= 4) {
          fitRhythm = 'whole'
          fitDur = 4
        } else if (runRemaining >= 3) {
          fitRhythm = 'dotted-half'
          fitDur = 3
        } else if (runRemaining >= 2) {
          fitRhythm = 'double'
          fitDur = 2
        } else {
          fitRhythm = 'quarter'
          fitDur = 1
        }
      }
      
      measure.beats[currentIdx] = {
        root: '',
        type: '',
        tensions: [],
        tension: null,
        bass: null,
        harmonicRhythm: fitRhythm
      }
      
      for (let k = 1; k < fitDur; k++) {
        if (currentIdx + k < numBeats) {
          states[currentIdx + k].isMerged = true
        }
      }
      
      currentIdx += fitDur
      runRemaining -= fitDur
    }
    
    idx = tempIdx
  }
  
  syncMeasuresBeats()
}

const showToast = (msg) => {
  if (toastTimeout.value) {
    clearTimeout(toastTimeout.value)
  }
  toastMessage.value = msg
  toastTimeout.value = setTimeout(() => {
    toastMessage.value = ''
  }, 1500)
}
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
    } else if (['maj7', 'maj', ''].includes(type || '')) {
      dbInfo = { available: ['9', '13', '#11'], avoid: ['11'], reason: 'Evitar la 11 justa por choque de semitono con la tercera mayor.' }
    } else if (['m7', 'min', 'minor', 'm'].includes(type || '')) {
      dbInfo = { available: ['9', '11', '13'], avoid: [], reason: '' }
    } else if (['m7b5', 'dim', 'dim7'].includes(type || '')) {
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
const isSubdivisionCollapsed = (measure, beat, beatIdx) => {
  if (!measure || !beat) return false
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const isSub = measure.showObligado && isSubdividedRhythm(rhythm, sig.unit === 8, beat)
  if (!isSub) return false
  
  const slots = getBeatSlots(measure, beat, beatIdx)
  if (slots.length <= 1) return false
  
  const hasSilence = slots.some(s => s.isSilence)
  if (hasSilence) return false
  
  const hasAllRoot = slots.every(s => s.root)
  if (!hasAllRoot) return false
  
  return slots.every(s => areChordsEqual(s, slots[0]))
}

const propagateSubdivisionMutation = (measureIndex, beatIndex, subdivisionIndex, oldChord, newChord) => {
  if (!applyToAllSubslots.value) return
  
  const m = measures.value[measureIndex]
  const beat = m ? m.beats[beatIndex] : null
  if (!beat || !beat.subdivisions) return
  
  beat.subdivisions.forEach((sub, sIdx) => {
    if (sIdx !== subdivisionIndex && sub && !sub.isMerged && !sub.isSilence) {
      sub.root = newChord.root
      sub.type = newChord.type
      sub.tension = newChord.tension
      sub.bass = newChord.bass
      sub.tensions = newChord.tensions ? [...newChord.tensions] : []
      sub.isSilence = newChord.isSilence || false
    }
  })
}

const propagateChordMutation = (measureIndex, beatIndex, subdivisionIndex, oldChord, newChord) => {
  const linearBlocks = getLinearBlocks()
  const slotId = subdivisionIndex !== undefined
    ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
    : `${measureIndex}_${beatIndex}`
    
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1) return
  
  let nextIdx = idx + 1
  while (nextIdx < linearBlocks.length) {
    const nextBlock = linearBlocks[nextIdx]
    if (nextBlock && tiedSlots.value.has(nextBlock.id)) {
      if (areChordsEqual(nextBlock.chord, oldChord)) {
        nextBlock.chord.root = newChord.root
        nextBlock.chord.type = newChord.type
        nextBlock.chord.tension = newChord.tension
        nextBlock.chord.bass = newChord.bass
        nextBlock.chord.tensions = newChord.tensions ? [...newChord.tensions] : []
        nextBlock.chord.isSilence = newChord.isSilence || false
        
        if (nextBlock.type === 'beat') {
          const parentBeat = measures.value[nextBlock.measureIndex].beats[nextBlock.beatIndex]
          parentBeat.root = newChord.root
          parentBeat.type = newChord.type
          parentBeat.tension = newChord.tension
          parentBeat.bass = newChord.bass
          parentBeat.tensions = newChord.tensions ? [...newChord.tensions] : []
        }
        nextIdx++
      } else {
        break
      }
    } else {
      break
    }
  }
}

const toggleExtension = (tension) => {
  if (!activeEditingBeat.value) return
  const oldChord = {
    root: activeEditingBeat.value.root,
    type: activeEditingBeat.value.type,
    tension: activeEditingBeat.value.tension,
    bass: activeEditingBeat.value.bass,
    tensions: [...(activeEditingBeat.value.tensions || [])],
    isSilence: activeEditingBeat.value.isSilence
  }
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
  
  if (selectedBeat.value) {
    const newChord = {
      root: activeEditingBeat.value.root,
      type: activeEditingBeat.value.type,
      tension: activeEditingBeat.value.tension,
      bass: activeEditingBeat.value.bass,
      tensions: [...(activeEditingBeat.value.tensions || [])],
      isSilence: activeEditingBeat.value.isSilence
    }
    const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
    if (subdivisionIndex !== undefined) {
      propagateSubdivisionMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
    }
    propagateChordMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
  }
}

const selectBassNote = (note) => {
  if (!activeEditingBeat.value) return
  const oldChord = {
    root: activeEditingBeat.value.root,
    type: activeEditingBeat.value.type,
    tension: activeEditingBeat.value.tension,
    bass: activeEditingBeat.value.bass,
    tensions: [...(activeEditingBeat.value.tensions || [])],
    isSilence: activeEditingBeat.value.isSilence
  }
  activeEditingBeat.value.bass = note === activeEditingBeat.value.root ? null : note
  
  if (selectedBeat.value) {
    const newChord = {
      root: activeEditingBeat.value.root,
      type: activeEditingBeat.value.type,
      tension: activeEditingBeat.value.tension,
      bass: activeEditingBeat.value.bass,
      tensions: [...(activeEditingBeat.value.tensions || [])],
      isSilence: activeEditingBeat.value.isSilence
    }
    const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
    if (subdivisionIndex !== undefined) {
      propagateSubdivisionMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
    }
    propagateChordMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
  }
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
const availableWidth = computed(() => {
  const w = windowWidth.value
  if (w >= 1450) {
    return 1260
  } else if (w >= 1024) {
    return w - 170
  } else if (w >= 768) {
    return w - 160
  } else {
    return w - 24
  }
})

const systems = computed(() => {
  const result = []
  let currentSystem = []
  let currentSystemWidth = 0
  const gap = 12 // gap-x-3 = 12px
  
  displayedMeasures.value.forEach((measure, idx) => {
    const measureWidth = getMeasureMinWidth(measure)
    const isPro = currentPlan.value === 'PRO'
    const maxPerSystem = isPro ? defaultMeasuresPerSystem.value : 4
    
    // Check if adding this measure exceeds the available width of the row container
    const wouldExceedWidth = currentSystem.length > 0 && 
      (currentSystemWidth + gap + measureWidth > availableWidth.value)
      
    const hasExplicitBreak = isPro && measure.systemBreak === true
    const reachedMax = currentSystem.length >= maxPerSystem
    
    if (wouldExceedWidth || hasExplicitBreak || reachedMax) {
      result.push({
        id: `sys-${result.length}`,
        measures: currentSystem
      })
      currentSystem = [measure]
      currentSystemWidth = measureWidth
    } else {
      currentSystem.push(measure)
      if (currentSystem.length === 1) {
        currentSystemWidth = measureWidth
      } else {
        currentSystemWidth += gap + measureWidth
      }
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

// --- ASSISTANT SUGGESTIONS STATE ---
const isSuggestionsPanelOpen = ref(true)
const allSuggestionsPool = ref([])
const suggestionOffset = ref(0)

const resolveRomanNumeralToChord = (numeral, keyRoot, scaleType) => {
  const triads = getDiatonicChords(keyRoot, scaleType, 'triad')
  const tetrads = getDiatonicChords(keyRoot, scaleType, 'tetrad')
  
  const cleanNumeral = numeral
    .replace('maj7', '')
    .replace('min7', '')
    .replace('7', '')
    .replace('m7b5', '')
    .replace('m7', '')
    .replace('M7', '')
  
  let match = tetrads.find(c => c.degreeNumeral.toLowerCase() === cleanNumeral.toLowerCase())
  if (!match) {
    match = triads.find(c => c.degreeNumeral.toLowerCase() === cleanNumeral.toLowerCase())
  }
  
  if (match) {
    const useTetrad = numeral.includes('7') || numeral.includes('maj') || numeral.includes('min')
    return {
      root: match.root,
      type: useTetrad ? match.type : (triads.find(c => c.degreeNumeral === match.degreeNumeral)?.type || '')
    }
  }
  
  const cleanNumUpper = cleanNumeral.toUpperCase()
  let semitones = 0
  let isMinor = numeral.toLowerCase() === numeral
  
  if (cleanNumUpper === 'I') semitones = 0
  else if (cleanNumUpper === '♭II' || cleanNumUpper === 'BII') semitones = 1
  else if (cleanNumUpper === 'II') semitones = 2
  else if (cleanNumUpper === '♭III' || cleanNumUpper === 'BIII') semitones = 3
  else if (cleanNumUpper === 'III') semitones = 4
  else if (cleanNumUpper === 'IV') semitones = 5
  else if (cleanNumUpper === '♯IV' || cleanNumUpper === 'NIV') semitones = 6
  else if (cleanNumUpper === 'V') semitones = 7
  else if (cleanNumUpper === '♭VI' || cleanNumUpper === 'BVI') semitones = 8
  else if (cleanNumUpper === 'VI') semitones = 9
  else if (cleanNumUpper === '♭VII' || cleanNumUpper === 'BVII') semitones = 10
  else if (cleanNumUpper === 'VII') semitones = 11
  
  const transposedRoot = transposeNote(keyRoot, semitones, keyRoot)
  
  let type = ''
  if (numeral.includes('7')) {
    type = isMinor ? 'm7' : '7'
    if (numeral.includes('maj') || numeral.includes('M')) {
      type = 'maj7'
    }
  } else {
    type = isMinor ? 'min' : ''
  }
  
  return {
    root: transposedRoot,
    type: type
  }
}

const getGenericSuggestions = () => {
  const isMinor = scaleType.value === 'minor' || scaleType.value.includes('minor')
  const k = key.value
  
  const list = []
  if (!isMinor) {
    list.push({
      title: 'Progresión Pop Clásica',
      description: `Escribe la progresión más exitosa del pop mundial: **I - V - vi - IV** en ${translateNoteToSpanish(k)} Mayor. Aporta balance y estabilidad.`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'V', 'vi', 'IV']
      }
    })
    list.push({
      title: 'Cadencia Lidia Brillante',
      description: `Añade un color brillante y cinematográfico usando el intercambio modal del IV grado mayor: **I - II - IV - I** (ej. en ${translateNoteToSpanish(k)}: ${k} - ${transposeNote(k, 2, k)} - ${transposeNote(k, 5, k)} - ${k}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'II', 'IV', 'I']
      }
    })
    list.push({
      title: 'Cadencia Plagal de Jazz',
      description: `Progresión sofisticada ideal para puentes o coros: **ii7 - V7 - Imaj7**. Conecta la subdominante menor y el dominante con resolución de tónica.`,
      payload: {
        type: 'replace_progression',
        progression: ['ii7', 'V7', 'Imaj7', 'Imaj7']
      }
    })
    list.push({
      title: 'Intercambio Modal Mixolidio',
      description: `Aporta una vibración rockera y abierta a tu progresión usando el acorde de bemol siete: **I - ♭VII - IV - I** (ej: ${k} - ${transposeNote(k, 10, k)} - ${transposeNote(k, 5, k)} - ${k}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭VII', 'IV', 'I']
      }
    })
  } else {
    list.push({
      title: 'Progresión Menor Clásica',
      description: `Escribe una progresión base menor sumamente expresiva: **i - ♭VI - ♭III - ♭VII** en ${translateNoteToSpanish(k)} menor. Estándar de baladas.`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭VI', '♭III', '♭VII']
      }
    })
    list.push({
      title: 'Cadencia Frigia Española',
      description: `Color oscuro y flamenco: **i - ♭II - ♭III - ♭II** (ej. en ${translateNoteToSpanish(k)} menor: ${k}m - ${transposeNote(k, 1, k)} - ${transposeNote(k, 3, k)}m - ${transposeNote(k, 1, k)}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭II', '♭III', '♭II']
      }
    })
    list.push({
      title: 'Cadencia Menor Armónica',
      description: `Drama y fuerza dramática: **i - iv - V7 - i**. El V grado con tercera mayor proporciona resolución contundente.`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'iv', 'V7', 'i']
      }
    })
    list.push({
      title: 'Movimiento Dórico Elegante',
      description: `Elegancia y toque jazz-fusión: **i7 - IV7 - i7**. El acorde IV mayor en escala menor introduce una sexta mayor brillante.`,
      payload: {
        type: 'replace_progression',
        progression: ['i7', 'IV7', 'i7', 'i7']
      }
    })
  }
  return list
}

const updateSuggestionsPool = () => {
  if (!measures.value) return
  const pool = []
  const len = measures.value.length
  
  for (let i = 0; i <= len - 4; i++) {
    const windowMeasures = measures.value.slice(i, i + 4)
    const sysKey = measuresWithKey.value[i]?.activeKey || key.value
    const sysScale = measuresWithKey.value[i]?.activeScale || scaleType.value
    const windowSuggestions = getSuggestionsForSystem(windowMeasures, i, sysKey, sysScale)
    
    windowSuggestions.forEach(s => {
      pool.push({
        title: s.title,
        description: s.description,
        payload: s.payload,
        type: 'rule'
      })
    })
  }
  
  const uniquePool = []
  const seen = new Set()
  pool.forEach(s => {
    const id = `${s.title}_${s.description}`
    if (!seen.has(id)) {
      seen.add(id)
      uniquePool.push(s)
    }
  })
  
  allSuggestionsPool.value = uniquePool
  if (suggestionOffset.value >= uniquePool.length) {
    suggestionOffset.value = 0
  }
}

const displayedSuggestions = computed(() => {
  if (allSuggestionsPool.value.length === 0) {
    const generic = getGenericSuggestions()
    const offset = suggestionOffset.value % generic.length
    const res = []
    for (let i = 0; i < 3; i++) {
      res.push(generic[(offset + i) % generic.length])
    }
    return res
  }
  
  const res = []
  const pool = allSuggestionsPool.value
  const offset = suggestionOffset.value % pool.length
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    res.push(pool[(offset + i) % pool.length])
  }
  return res
})

const refreshSuggestions = () => {
  const poolSize = allSuggestionsPool.value.length === 0 ? getGenericSuggestions().length : allSuggestionsPool.value.length
  suggestionOffset.value = (suggestionOffset.value + 3) % poolSize
  showToast("Sugerencias actualizadas 🔄")
}

watch([key, scaleType, measures], () => {
  updateSuggestionsPool()
}, { deep: true, immediate: true })

const runSuggestion = (suggestion) => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'suggestions'
    isUpgradeModalOpen.value = true
    return
  }
  saveHistory()
  if (suggestion.payload && suggestion.payload.type === 'replace_progression') {
    const newMeasures = JSON.parse(JSON.stringify(measures.value))
    const keyRoot = key.value
    const scale = scaleType.value
    suggestion.payload.progression.forEach((numeral, idx) => {
      if (newMeasures[idx]) {
        const resolved = resolveRomanNumeralToChord(numeral, keyRoot, scale)
        newMeasures[idx].beats.forEach((b, bIdx) => {
          if (bIdx === 0) {
            b.root = resolved.root
            b.type = resolved.type
            b.tensions = []
            b.tension = null
            b.bass = null
          } else {
            b.root = null
            b.type = ''
            b.tensions = []
            b.tension = null
            b.bass = null
          }
        })
      }
    })
    measures.value = newMeasures
    showToast(`Se aplicó la progresión: ${suggestion.title}`)
  } else {
    measures.value = applySuggestion(measures.value, suggestion.payload)
    showToast(`Se aplicó la sugerencia: ${suggestion.title}`)
  }
  isSystemSuggestionsModalOpen.value = false
  syncMeasuresBeats()
  updateSuggestionsPool()
}
const isMeasureOptionsOpen = ref(false)
const selectedMeasureIndex = ref(null)
const tempSectionLabel = ref('Ninguna')
const tempShowSubdivisions = ref(false)
const tempShowObligado = ref(false)
// --- LOCAL METRIC / TIME SIGNATURE STATE ---
const isLocalMetricSubMenuOpen = ref(false)
const localMetricBeats = ref(4)
const localMetricUnit = ref(4)
const localMetricGrouping = ref([4])
const isMetricInfoModalOpen = ref(false)

// --- METRIC CONFIGURATION AND HELPERS ---
const METRIC_GROUPS = [
  {
    label: 'Métricas Simples',
    desc: 'Subdivisión Binaria: Cada pulso se divide naturalmente en dos.',
    color: 'bg-green-500',
    borderColor: 'border-green-200 text-green-700 hover:border-green-500',
    activeColor: 'bg-green-500 text-white border-green-500',
    items: [
      { beats: 2, unit: 4, name: '2/4', isPro: true },
      { beats: 3, unit: 4, name: '3/4', isPro: false },
      { beats: 4, unit: 4, name: '4/4', isPro: false }
    ]
  },
  {
    label: 'Métricas Compuestas',
    desc: 'Subdivisión Ternaria: Cada pulso se divide naturalmente en tres.',
    color: 'bg-blue-500',
    borderColor: 'border-blue-200 text-blue-700 hover:border-blue-500',
    activeColor: 'bg-blue-500 text-white border-blue-500',
    isPro: true,
    items: [
      { beats: 6, unit: 8, name: '6/8', isPro: true },
      { beats: 9, unit: 8, name: '9/8', isPro: true },
      { beats: 12, unit: 8, name: '12/8', isPro: true }
    ]
  },
  {
    label: 'Métricas Avanzadas',
    desc: 'Amalgamas e Irregulares: Pulsos asimétricos con agrupaciones dinámicas.',
    color: 'bg-violet-500',
    borderColor: 'border-violet-200 text-violet-700 hover:border-violet-500',
    activeColor: 'bg-violet-500 text-white border-violet-500',
    isPro: true,
    items: [
      { beats: 5, unit: 8, name: '5/8', isPro: true },
      { beats: 7, unit: 8, name: '7/8', isPro: true },
      { beats: 11, unit: 8, name: '11/8', isPro: true },
      { beats: 13, unit: 8, name: '13/8', isPro: true }
    ]
  }
]

const globalGrouping = ref([4])
const customGlobalBeats = ref(4)
const customGlobalUnit = ref(4)
const customGlobalGroupingStr = ref('')
const customWizardBeats = ref(4)
const customWizardUnit = ref(4)
const customLocalGroupingStr = ref('')
const tempGlobalGroupingStr = ref('')
const tempLocalGroupingStr = ref('')

// --- KEY CHANGE / MODULATION STATE ---
const isKeyChangeSubMenuOpen = ref(false)
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
    if (isMeasureSixteenth(m)) {
      count += 3
    } else if (isMeasureDense(m)) {
      count += 2
    } else {
      count += 1
    }
    
    if (currentPlan.value === 'PRO' && m.keyChange) {
      count += 1
    }
    if (currentPlan.value === 'PRO' && m.timeSignature) {
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

const getBeatMinWidth = (measure, beat, state) => {
  const rhythm = getEffectiveRhythm(measure, beat, state.index)
  const isSynced = currentPlan.value === 'PRO' && measure.lyrics?.mode === 'synced'
  const isMobile = windowWidth.value < 768
  
  let baseMin = state.durationSlots * (isSynced ? (isMobile ? 28 : 35) : (isMobile ? 40 : 50))
  
  if (rhythm === 'sixteenth') {
    baseMin = Math.max(baseMin, isSynced ? (isMobile ? 64 : 80) : (isMobile ? 96 : 112))
  } else if (rhythm === 'triplet') {
    baseMin = Math.max(baseMin, isSynced ? (isMobile ? 48 : 60) : (isMobile ? 72 : 84))
  } else if (rhythm === 'quintuplet') {
    baseMin = Math.max(baseMin, isSynced ? (isMobile ? 75 : 90) : (isMobile ? 100 : 120))
  }
  
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig?.unit === 8
  
  // 1. Subdivided Beat adaptive width
  if (measure.showObligado && isSubdividedRhythm(rhythm, isDenom8, beat)) {
    const slots = getVisibleSlotsForRender(measure, beat, state.index)
    const totalFlexGrow = slots.reduce((sum, s) => sum + (s.flexGrow || 1), 0)
    let subWidthNeeded = 0
    
    slots.forEach(s => {
      let slotMin = 20
      
      if (s.root) {
        const subCount = slots.length
        let charWidth = 8
        let padding = 10
        
        if (subCount >= 4) {
          charWidth = isMobile ? 6.2 : 7.5
          padding = isMobile ? 6.5 : 8
        } else if (subCount >= 3) {
          charWidth = isMobile ? 7.5 : 9
          padding = isMobile ? 8 : 10
        } else {
          charWidth = isMobile ? 8.8 : 10.5
          padding = isMobile ? 10 : 12
        }
        
        const displayParts = splitChordDisplay(s)
        const maxPartLen = Math.max(displayParts.main.length, displayParts.bass.length)
        slotMin = padding + maxPartLen * charWidth
      }
      
      // Project required beat width for this slot to fit
      const requiredBeatWidth = slotMin * (totalFlexGrow / (s.flexGrow || 1))
      subWidthNeeded = Math.max(subWidthNeeded, requiredBeatWidth)
    })
    baseMin = Math.max(baseMin, subWidthNeeded)
  } 
  // 2. Normal Beat adaptive width
  else if (beat.root) {
    const fontClass = getMeasureFontSizeClass(measure)
    let charWidth = 8.5
    let padding = 24
    
    if (fontClass.includes('text-xl') || fontClass.includes('lg:text-[30px]')) {
      charWidth = 16
      padding = 32
    } else if (fontClass.includes('lg:text-[26px]') || fontClass.includes('lg:text-[22px]')) {
      charWidth = 14
      padding = 28
    } else if (fontClass.includes('lg:text-[19px]')) {
      charWidth = 12
      padding = 26
    } else if (fontClass.includes('lg:text-[16px]')) {
      charWidth = 10
      padding = 24
    }
    
    if (isMobile) {
      charWidth = charWidth * 0.85
      padding = padding * 0.8
    }
    
    const displayParts = splitChordDisplay(beat)
    const maxPartLen = Math.max(displayParts.main.length, displayParts.bass.length)
    let chordMinWidth = padding + maxPartLen * charWidth
    
    baseMin = Math.max(baseMin, chordMinWidth)
  }
  
  // 3. Ensure beat width accommodates lyrics text for both normal, empty, and subdivided beats
  if (isSynced) {
    const layoutData = getMeasureLyricsLayout(measure)
    const slotRes = layoutData[beat.id]
    if (slotRes && slotRes.hasLyrics) {
      const textLen = slotRes.hasAssociated 
        ? (slotRes.preText.length + slotRes.associatedText.length + slotRes.postText.length) 
        : slotRes.normalText.length
      const lyricMinWidth = textLen * 8.0 + 24
      baseMin = Math.max(baseMin, lyricMinWidth)
    }
  }
  
  return baseMin
}

const getMeasureMinWidth = (measure) => {
  const states = getMergedBeats(measure)
  let totalMinWidth = 0
  
  states.forEach(state => {
    if (!state.isMerged) {
      totalMinWidth += getBeatMinWidth(measure, state.beat, state)
    }
  })
  
  totalMinWidth += 36 // Card base margins/paddings
  
  // Add spacers minWidth under PRO plan
  if (currentPlan.value === 'PRO') {
    if (measure.keyChange) {
      totalMinWidth += 120
    }
    const idx = measures.value.findIndex(m => m.id === measure.id)
    if (idx > 0) {
      const prevSig = getMeasureTimeSignature(idx - 1)
      if (measure.timeSignature && (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit)) {
        totalMinWidth += 72
      }
    }
  }
  
  return totalMinWidth
}

const getMeasureFlexStyle = (measure) => {
  const sig = getMeasureTimeSignature(measure)
  const beats = sig.beats
  const minWidth = getMeasureMinWidth(measure)
  
  return {
    flex: `${beats} 0 0%`,
    minWidth: `${minWidth}px`
  }
}

const getAddButtonFlexStyle = () => {
  const beats = timeSignature.value
  const minWidth = beats * 50 + 36
  return {
    flex: `${beats} ${beats} 0%`,
    minWidth: `${minWidth}px`
  }
}

const getBeatSlotDuration = (measure, beat, beatIdx) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  const rhythm = beat.harmonicRhythm || 'auto'
  
  if (isDenom8) {
    if (rhythm === 'whole') return 8
    if (rhythm === 'dotted-half') return 6
    if (rhythm === 'double') return 4
    if (rhythm === 'dotted-quarter') return 3
    if (rhythm === 'quarter') return 2
    if (rhythm === 'sixteenth') return 2
    if (rhythm === 'eighth') return 1
    return 1
  } else {
    if (rhythm === 'whole') return 4
    if (rhythm === 'dotted-half') return 3
    if (rhythm === 'double') return 2
    if (rhythm === 'quarter') return 1
    return 1
  }
}

const getRhythmFigureDuration = (rhythmType, isDenom8) => {
  if (isDenom8) {
    if (rhythmType === 'whole') return 8
    if (rhythmType === 'dotted-half') return 6
    if (rhythmType === 'double') return 4
    if (rhythmType === 'dotted-quarter') return 3
    if (rhythmType === 'quarter') return 2
    if (rhythmType === 'sixteenth') return 2
    if (rhythmType === 'eighth') return 1
    return 1
  } else {
    if (rhythmType === 'whole') return 4
    if (rhythmType === 'dotted-half') return 3
    if (rhythmType === 'double') return 2
    if (rhythmType === 'quarter') return 1
    return 1
  }
}

const getMeasureUsedBeats = (measure, excludeBeatIdx) => {
  if (!measure) return 0
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  let used = 0
  
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.beats[i] || { root: '', type: '' },
    isMerged: false
  }))
  
  if (currentPlan.value === 'PRO') {
    for (let i = 0; i < numBeats; i++) {
      if (states[i].isMerged) continue
      const beat = states[i].beat
      if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
        const dur = getBeatSlotDuration(measure, beat, i)
        for (let j = 1; j < dur; j++) {
          if (i + j < numBeats) {
            states[i + j].isMerged = true
          }
        }
      }
    }
  }

  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    if (i === excludeBeatIdx) continue
    const beat = states[i].beat
    if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
      used += getBeatSlotDuration(measure, beat, i)
    }
  }
  return used
}

const isFigureValid = (rhythmType, measure, beatIdx) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  const duration = getRhythmFigureDuration(rhythmType, isDenom8)
  
  // 1. Cannot exceed the end of the measure
  if (beatIdx + duration > sig.beats) {
    return false
  }
  
  const numBeats = sig.beats
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.beats[i] || { root: '', type: '' },
    isMerged: false
  }))
  
  // Simulate space occupancy of OTHER figures.
  // The range [beatIdx, beatIdx + duration - 1] will be overwritten, so we skip any beat starting inside it.
  let usedOthers = 0
  
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    if (i >= beatIdx && i < beatIdx + duration) continue
    
    const beat = states[i].beat
    if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
      const dur = getBeatSlotDuration(measure, beat, i)
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
      usedOthers += dur
    }
  }
  
  // If target beat is merged by a preceding figure, it is a collision
  if (states[beatIdx].isMerged) {
    return false
  }
  
  return duration <= (sig.beats - usedOthers)
}

const isPatternActive = (measure, beat, beatIdx, key) => {
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig?.unit === 8
  
  if (rhythm === 'eighth') {
    if (isDenom8) {
      return beat.eighthPattern === key
    } else {
      return beat.eighthPattern === key || (!beat.eighthPattern && key === '2_notes')
    }
  }
  return beat.sixteenthPattern === key || (!beat.sixteenthPattern && key === '4_semi')
}

const getMeasureRemainingBeats = (measure) => {
  if (!measure) return 0
  const sig = getMeasureTimeSignature(measure)
  const capacity = sig.beats
  
  let used = 0
  const numBeats = sig.beats
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.beats[i] || { root: '', type: '' },
    isMerged: false
  }))
  
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    const beat = states[i].beat
    if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
      const dur = getBeatSlotDuration(measure, beat, i)
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
    }
  }

  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    const beat = states[i].beat
    if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
      used += getBeatSlotDuration(measure, beat, i)
    }
  }
  
  return Math.max(0, capacity - used)
}

const isSubdividedRhythm = (rhythmType, isDenom8, beat = null) => {
  if (isDenom8) {
    if (rhythmType === 'eighth') {
      return beat && beat.eighthPattern ? true : false
    }
    return ['sixteenth', 'triplet', 'quintuplet'].includes(rhythmType)
  } else {
    return ['eighth', 'sixteenth', 'triplet', 'quintuplet', 'offbeat'].includes(rhythmType)
  }
}

const areChordsEqual = (c1, c2) => {
  if (!c1 || !c2) return false
  if (c1.root !== c2.root) return false
  if (c1.type !== c2.type) return false
  if (c1.tension !== c2.tension) return false
  if (c1.bass !== c2.bass) return false
  
  const t1 = c1.tensions || []
  const t2 = c2.tensions || []
  if (t1.length !== t2.length) return false
  
  const s1 = [...t1].sort()
  const s2 = [...t2].sort()
  return s1.every((v, i) => v === s2[i])
}

const getMergedBeats = (measure) => {
  if (!measure) return []
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  const origMIdx = measure.originalMeasureIndex
  
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.beats[i] || { root: '', type: '' },
    isMerged: false,
    durationSlots: 1
  }))
  
  if (currentPlan.value === 'PRO' && measure.showObligado) {
    // 1. Initial merge based on explicit figures duration
    for (let i = 0; i < numBeats; i++) {
      if (states[i].isMerged) continue
      const beat = states[i].beat
      if (beat.root !== '' || (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto')) {
        const dur = getBeatSlotDuration(measure, beat, i)
        states[i].durationSlots = dur
        for (let j = 1; j < dur; j++) {
          if (i + j < numBeats) {
            states[i + j].isMerged = true
          }
        }
      }
    }
    
    // 2. Fusion of adjacent identical tied beats (visual fusion)
    for (let i = 0; i < numBeats; i++) {
      if (states[i].isMerged) continue
      
      let currentIdx = i
      let nextIdx = currentIdx + states[currentIdx].durationSlots
      
      while (nextIdx < numBeats) {
        const currentBeat = states[currentIdx].beat
        const nextBeat = states[nextIdx].beat
        
        const currentRhythm = getEffectiveRhythm(measure, currentBeat, currentIdx)
        const nextRhythm = getEffectiveRhythm(measure, nextBeat, nextIdx)
        const currentSubdivided = measure.showObligado && isSubdividedRhythm(currentRhythm, sig.unit === 8, currentBeat)
        const nextSubdivided = measure.showObligado && isSubdividedRhythm(nextRhythm, sig.unit === 8, nextBeat)
        
        const nextSlotId = `${origMIdx}_${nextIdx}`
        
        if (
          nextBeat &&
          !states[nextIdx].isMerged &&
          !currentSubdivided &&
          !nextSubdivided &&
          areChordsEqual(currentBeat, nextBeat) &&
          tiedSlots.value.has(nextSlotId)
        ) {
          states[currentIdx].durationSlots += states[nextIdx].durationSlots
          states[nextIdx].isMerged = true
          nextIdx = currentIdx + states[currentIdx].durationSlots
        } else {
          break
        }
      }
    }
  }
  // When showObligado is OFF: NO merging — all slots remain free and independently clickable
  return states
}

const partitionsCache = {}
const getPartitionsOf2And3 = (n) => {
  if (n in partitionsCache) return partitionsCache[n]
  if (n === 0) return [[]]
  if (n < 0) return []
  const results = []
  // Try taking a 2
  const p2 = getPartitionsOf2And3(n - 2)
  p2.forEach(p => results.push([2, ...p]))
  // Try taking a 3
  const p3 = getPartitionsOf2And3(n - 3)
  p3.forEach(p => results.push([3, ...p]))
  partitionsCache[n] = results
  return results
}

const canGroupToPattern = (durations, pattern) => {
  let durIdx = 0
  for (let i = 0; i < pattern.length; i++) {
    const targetSum = pattern[i]
    let currentSum = 0
    while (currentSum < targetSum && durIdx < durations.length) {
      currentSum += durations[durIdx]
      durIdx++
    }
    if (currentSum !== targetSum) {
      return false
    }
  }
  return durIdx === durations.length
}

const analyzeMeasureSubdivision = (measure) => {
  const sig = getMeasureTimeSignature(measure)
  if (sig.unit !== 8) {
    return { type: 'standard', message: '' }
  }
  
  const N = sig.beats
  const patterns = getPartitionsOf2And3(N)
  if (patterns.length === 0) {
    return { type: 'standard', message: '' }
  }
  
  const blocks = getMergedBeats(measure).filter(s => !s.isMerged)
  const durations = blocks.map(s => s.durationSlots)
  
  const matchingPatterns = patterns.filter(p => canGroupToPattern(durations, p))
  
  const hasSubdividedChords = durations.some(d => d > 1)
  if (!hasSubdividedChords) {
    return { type: 'ambiguous', matchingPatterns, message: 'Sin subdivisión clara' }
  }
  
  if (matchingPatterns.length === 1) {
    return {
      type: 'match',
      pattern: matchingPatterns[0],
      message: `Subdivisión detectada: ${matchingPatterns[0].join('+')}`
    }
  } else if (matchingPatterns.length > 1) {
    return {
      type: 'ambiguous_match',
      matchingPatterns,
      message: 'Podría completarse como: ' + matchingPatterns.map(p => p.join('+')).join(' o ')
    }
  } else {
    return {
      type: 'inconsistent',
      message: `⚠️ No corresponde a una subdivisión estándar (${N}/8)`
    }
  }
}

const getBeatGroupInfo = (measure, beatIdx) => {
  const grouping = getMeasureGrouping(measure)
  let accum = 0
  for (let gIdx = 0; gIdx < grouping.length; gIdx++) {
    const groupLen = grouping[gIdx]
    if (beatIdx >= accum && beatIdx < accum + groupLen) {
      return {
        groupIndex: gIdx,
        isFirst: beatIdx === accum,
        isLast: beatIdx === accum + groupLen - 1
      }
    }
    accum += groupLen
  }
  return { groupIndex: 0, isFirst: false, isLast: false }
}

const getAvailableRhythmFigures = (measure) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  
  if (isDenom8) {
    return [
      { value: 'whole', label: 'Redonda (8 Corcheas)', icon: '\uD834\uDD5D', isPro: true },
      { value: 'dotted-half', label: 'Blanca con Punto (6 Corcheas)', icon: '\uD834\uDD5E.', isPro: true },
      { value: 'double', label: 'Blanca (4 Corcheas)', icon: '\uD834\uDD5E', isPro: true },
      { value: 'dotted-quarter', label: 'Negra con Punto (3 Corcheas)', icon: '\uD834\uDD5F.', isPro: true },
      { value: 'quarter', label: 'Negra (2 Corcheas)', icon: '\uD834\uDD5F', isPro: false },
      { value: 'eighth', label: 'Corchea (1 Corchea)', icon: '\uD834\uDD60', isPro: false },
      { value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '\uD834\uDD61', isPro: true }
    ]
  } else {
    return [
      { value: 'whole', label: 'Redonda (4 Negras)', icon: '\uD834\uDD5D', isPro: true },
      { value: 'dotted-half', label: 'Blanca con Punto (3 Negras)', icon: '\uD834\uDD5E.', isPro: true },
      { value: 'double', label: 'Blanca (2 Negras)', icon: '\uD834\uDD5E', isPro: true },
      { value: 'quarter', label: 'Negra (1 Negra)', icon: '\uD834\uDD5F', isPro: false },
      { value: 'eighth', label: 'Corcheas (2x)', icon: '\u266B', isPro: false },
      { value: 'offbeat', label: 'Contratiempo', icon: '\u21B7', isPro: false },
      { value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '\u266C', isPro: true },
      { value: 'triplet', label: 'Tresillo (3x)', icon: '3\uFE0F\u20E3', isPro: true }
    ]
  }
}

const getRhythmDisplayIcon = (rhythm, measure) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  if (isDenom8) {
    if (rhythm === 'whole') return '\uD834\uDD5D'
    if (rhythm === 'dotted-half') return '\uD834\uDD5E.'
    if (rhythm === 'double') return '\uD834\uDD5E'
    if (rhythm === 'dotted-quarter') return '\uD834\uDD5F.'
    if (rhythm === 'quarter') return '\uD834\uDD5F'
    if (rhythm === 'eighth' || rhythm === 'auto') return '\uD834\uDD60'
    if (rhythm === 'sixteenth') return '\uD834\uDD61'
    if (rhythm === 'triplet') return '3\uFE0F\u20E3'
  } else {
    if (rhythm === 'whole') return '\uD834\uDD5D'
    if (rhythm === 'dotted-half') return '\uD834\uDD5E.'
    if (rhythm === 'double') return '\uD834\uDD5E'
    if (rhythm === 'quarter' || rhythm === 'auto') return '\uD834\uDD5F'
    if (rhythm === 'eighth') return '\uD834\uDD60'
    if (rhythm === 'sixteenth') return '\uD834\uDD61'
    if (rhythm === 'triplet') return '3\uFE0F\u20E3'
  }
  return ''
}
const startKeyChangeSetup = () => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'modulacion'
    isUpgradeModalOpen.value = true
    return
  }
  isKeyChangeSubMenuOpen.value = true
  tempKeyChangeBeatIndex.value = 0 // Always first beat of the measure
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

// --- LOCAL METRIC / TIME SIGNATURE MODIFICATION HELPERS ---
const getDefaultGrouping = (beats, unit) => {
  if (unit === 8) {
    if (beats === 6) return [3, 3]
    if (beats === 9) return [3, 3, 3]
    if (beats === 12) return [3, 3, 3, 3]
    if (beats === 5) return [3, 2]
    if (beats === 7) return [3, 2, 2]
    if (beats === 11) return [3, 3, 3, 2]
    if (beats === 13) return [3, 3, 3, 2, 2]
    if (beats === 15) return [3, 3, 3, 3, 3]
  }
  if (unit === 4) {
    if (beats === 5) return [3, 2]
    if (beats === 7) return [3, 2, 2]
  }
  return Array.from({ length: beats }, () => 1)
}

const getMeasureTimeSignature = (measureOrIdx) => {
  let idx = measureOrIdx
  if (measureOrIdx && typeof measureOrIdx === 'object') {
    idx = measureOrIdx.originalMeasureIndex !== undefined 
      ? measureOrIdx.originalMeasureIndex 
      : measures.value.findIndex(m => m.id === measureOrIdx.id)
  }
  
  if (idx === null || idx === undefined || idx < 0) {
    return { beats: timeSignature.value, unit: timeSignatureUnit.value }
  }
  
  for (let i = idx; i >= 0; i--) {
    const m = measures.value[i]
    if (m && m.timeSignature) {
      return {
        beats: m.timeSignature.beats,
        unit: m.timeSignature.unit
      }
    }
  }
  return {
    beats: timeSignature.value,
    unit: timeSignatureUnit.value
  }
}

const getMeasureGrouping = (measureOrIdx) => {
  let idx = measureOrIdx
  let m = null
  if (measureOrIdx && typeof measureOrIdx === 'object') {
    m = measureOrIdx
    idx = measureOrIdx.originalMeasureIndex !== undefined 
      ? measureOrIdx.originalMeasureIndex 
      : measures.value.findIndex(item => item.id === measureOrIdx.id)
  } else if (measureOrIdx !== null && measureOrIdx !== undefined && measureOrIdx >= 0) {
    idx = measureOrIdx
    m = measures.value[idx]
  }
  
  if (!m) {
    return getDefaultGrouping(timeSignature.value, timeSignatureUnit.value)
  }
  
  const sig = getMeasureTimeSignature(m)
  if (sig.unit === 8) {
    const analysis = analyzeMeasureSubdivision(m)
    if (analysis.type === 'match') {
      return analysis.pattern
    }
  }
  
  // Fallback to manual/inherited grouping
  for (let i = idx; i >= 0; i--) {
    const prevM = measures.value[i]
    if (prevM && prevM.grouping) {
      return prevM.grouping
    }
  }
  return getDefaultGrouping(sig.beats, sig.unit)
}

const resizeMeasureBeats = (measure, targetBeats) => {
  if (!measure || !measure.beats) return
  const currentBeatsCount = measure.beats.length
  if (currentBeatsCount < targetBeats) {
    for (let i = currentBeatsCount; i < targetBeats; i++) {
      measure.beats.push({ root: '', type: '' })
    }
  } else if (currentBeatsCount > targetBeats) {
    measure.beats = measure.beats.slice(0, targetBeats)
  }
}

const syncMeasuresBeats = () => {
  if (!measures.value) return
  measures.value.forEach((m, idx) => {
    const sig = getMeasureTimeSignature(idx)
    resizeMeasureBeats(m, sig.beats)
  })
}

const parseGroupingString = (str, totalBeats) => {
  if (!str) return null
  const parts = str.split('+').map(p => parseInt(p.trim(), 10))
  if (parts.some(isNaN) || parts.some(p => p <= 0)) return null
  const sum = parts.reduce((a, b) => a + b, 0)
  if (sum !== totalBeats) return null
  return parts
}

const getGroupingPresets = (beats) => {
  if (beats === 5) return [[3, 2], [2, 3]]
  if (beats === 7) return [[3, 2, 2], [2, 3, 2], [2, 2, 3]]
  if (beats === 11) return [[3, 3, 3, 2], [2, 3, 3, 3]]
  if (beats === 13) return [[3, 3, 3, 2, 2], [2, 2, 3, 3, 3]]
  if (beats === 15) return [[3, 3, 3, 3, 3]]
  return []
}

const changeGlobalTimeSignature = (beats, unit) => {
  if (currentPlan.value !== 'PRO' && ((beats !== 3 && beats !== 4) || unit !== 4)) {
    upgradeReason.value = 'time_signature'
    isUpgradeModalOpen.value = true
    return
  }
  timeSignature.value = beats
  timeSignatureUnit.value = unit
  globalGrouping.value = getDefaultGrouping(beats, unit)
  syncMeasuresBeats()
}

const applyCustomGlobalTimeSignature = () => {
  const b = parseInt(customGlobalBeats.value, 10)
  const u = parseInt(customGlobalUnit.value, 10)
  if (isNaN(b) || b < 2 || b > 16) {
    showToast("El numerador debe estar entre 2 y 16")
    return
  }
  if (u !== 4 && u !== 8) {
    showToast("El denominador debe ser 4 u 8")
    return
  }
  
  if (currentPlan.value !== 'PRO' && ((b !== 3 && b !== 4) || u !== 4)) {
    upgradeReason.value = 'time_signature'
    isUpgradeModalOpen.value = true
    return
  }
  
  timeSignature.value = b
  timeSignatureUnit.value = u
  
  const parsed = parseGroupingString(tempGlobalGroupingStr.value, b)
  if (parsed) {
    globalGrouping.value = parsed
  } else {
    globalGrouping.value = getDefaultGrouping(b, u)
  }
  
  syncMeasuresBeats()
  isMetricInfoModalOpen.value = false
}

const handleGlobalGroupingInput = (event) => {
  const val = event.target.value
  tempGlobalGroupingStr.value = val
  const parsed = parseGroupingString(val, timeSignature.value)
  if (parsed) {
    globalGrouping.value = parsed
  }
}

const startLocalMetricSetup = () => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'metrica'
    isUpgradeModalOpen.value = true
    return
  }
  if (selectedMeasureIndex.value === null) return
  const m = measures.value[selectedMeasureIndex.value]
  if (!m) return
  if (m.timeSignature) {
    localMetricBeats.value = m.timeSignature.beats
    localMetricUnit.value = m.timeSignature.unit
    localMetricGrouping.value = m.grouping || getDefaultGrouping(m.timeSignature.beats, m.timeSignature.unit)
  } else {
    const sig = getMeasureTimeSignature(selectedMeasureIndex.value)
    localMetricBeats.value = sig.beats
    localMetricUnit.value = sig.unit
    localMetricGrouping.value = getMeasureGrouping(selectedMeasureIndex.value)
  }
  const groupStr = localMetricGrouping.value ? localMetricGrouping.value.join('+') : ''
  customLocalGroupingStr.value = groupStr
  tempLocalGroupingStr.value = groupStr
  isLocalMetricSubMenuOpen.value = true
}

const selectLocalMetricItem = (beats, unit) => {
  localMetricBeats.value = beats
  localMetricUnit.value = unit
  localMetricGrouping.value = getDefaultGrouping(beats, unit)
  tempLocalGroupingStr.value = localMetricGrouping.value.join('+')
}

const getMetricGroupingPresets = (beats, unit) => {
  if (unit === 8) {
    if (beats === 5) return [[2, 3], [3, 2]]
    if (beats === 7) return [[2, 2, 3], [3, 2, 2], [2, 3, 2]]
    if (beats === 11) return [[3, 3, 3, 2], [2, 3, 3, 3], [3, 2, 3, 3], [3, 3, 2, 3]]
    if (beats === 13) return [[3, 3, 3, 2, 2], [3, 3, 2, 3, 2], [2, 2, 3, 3, 3]]
    if (beats === 15) return [[3, 3, 3, 3, 3]]
  }
  if (unit === 4) {
    if (beats === 5) return [[2, 3], [3, 2]]
    if (beats === 7) return [[3, 4], [4, 3], [2, 2, 3], [3, 2, 2]]
  }
  return [Array.from({ length: beats }, () => 1)]
}

const isAdvancedLocalMetric = computed(() => {
  const b = localMetricBeats.value
  return b >= 5
})

const onLocalMetricCustomChange = () => {
  let b = parseInt(localMetricBeats.value, 10)
  let u = parseInt(localMetricUnit.value, 10)
  if (isNaN(b) || b < 2) b = 2
  if (b > 16) b = 16
  localMetricBeats.value = b
  if (u !== 4 && u !== 8) u = 4
  localMetricUnit.value = u
  localMetricGrouping.value = getDefaultGrouping(b, u)
  tempLocalGroupingStr.value = localMetricGrouping.value.join('+')
}

const handleLocalGroupingInput = (event) => {
  const val = event.target.value
  tempLocalGroupingStr.value = val
  const parsed = parseGroupingString(val, localMetricBeats.value)
  if (parsed) {
    localMetricGrouping.value = parsed
  }
}

const saveLocalTimeSignature = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    if (!m) return
    m.timeSignature = {
      beats: localMetricBeats.value,
      unit: localMetricUnit.value
    }
    const parsed = parseGroupingString(tempLocalGroupingStr.value, localMetricBeats.value)
    if (parsed) {
      m.grouping = parsed
    } else {
      m.grouping = getDefaultGrouping(localMetricBeats.value, localMetricUnit.value)
    }
    
    syncMeasuresBeats()
    
    isLocalMetricSubMenuOpen.value = false
    isMeasureOptionsOpen.value = false
    showToast(`Métrica local del compás ${selectedMeasureIndex.value + 1} cambiada a ${localMetricBeats.value}/${localMetricUnit.value}`)
  }
}

const removeLocalTimeSignature = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    if (!m) return
    delete m.timeSignature
    delete m.grouping
    
    syncMeasuresBeats()
    
    isLocalMetricSubMenuOpen.value = false
    isMeasureOptionsOpen.value = false
    showToast(`Métrica local del compás ${selectedMeasureIndex.value + 1} eliminada`)
  }
}

const selectWizardTimeSignature = (beats, unit, isPro) => {
  if (isPro && currentPlan.value !== 'PRO') {
    upgradeReason.value = 'metrica'
    isUpgradeModalOpen.value = true
    return
  }
  configTimeSignature.value = beats
  configTimeSignatureUnit.value = unit
  activeDropdown.value = null
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
let wasAlreadySelectedBeforeMousedown = false

const toggleMeasureSelection = (index) => {
  if (wasAlreadySelectedBeforeMousedown) {
    clearSelection()
  } else {
    if (selectedRangeStart.value === selectedRangeEnd.value) {
      selectedRangeStart.value = index
      selectedRangeEnd.value = index
    }
  }
}
const startSelectionDrag = (index) => {
  isSelectionDragging.value = true
  wasAlreadySelectedBeforeMousedown = (selectedRangeStart.value === index && selectedRangeEnd.value === index)
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
const activeRhythmSelector = ref(null)
const RHYTHM_FIGURES = [
  { value: 'whole', label: 'Redonda', icon: '\uD834\uDD5D', isPro: true },
  { value: 'dotted-half', label: 'Blanca con Punto', icon: '\uD834\uDD5E.', isPro: true },
  { value: 'double', label: 'Blanca', icon: '\uD834\uDD5E', isPro: true },
  { value: 'dotted-quarter', label: 'Negra con Punto', icon: '\uD834\uDD5F.', isPro: true },
  { value: 'quarter', label: 'Negras (1x)', icon: '♩', isPro: false },
  { value: 'eighth', label: 'Corcheas (2x)', icon: '♫', isPro: false },
  { value: 'offbeat', label: 'Contratiempo', icon: '↷', isPro: false },
  { value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '♬', isPro: true },
  { value: 'triplet', label: 'Tresillo (3x)', icon: '3️⃣', isPro: true },
  { value: 'quintuplet', label: 'Quintillo (5x)', icon: '5️⃣', isPro: true }
]

const SIXTEENTH_PATTERNS = {
  '4_semi': {
    label: '4 Semicorcheas',
    slots: ['note', 'note', 'note', 'note'],
    icon: '♬'
  },
  'silencio_3_semi': {
    label: '1 Silencio - 3 Semicorcheas',
    slots: ['silence', 'note', 'note', 'note'],
    icon: '𝄾 ♬'
  },
  'semi_silencio_2_semi': {
    label: 'Semicorchea - 1 Silencio - 2 Semicorcheas',
    slots: ['note', 'silence', 'note', 'note'],
    icon: '♬ 𝄾 ♫'
  },
  '2_semi_silencio_semi': {
    label: '2 Semicorcheas - Silencio - Semicorchea',
    slots: ['note', 'note', 'silence', 'note'],
    icon: '♫ 𝄾 ♬'
  },
  '3_semi_silencio': {
    label: '3 Semicorcheas - Silencio',
    slots: ['note', 'note', 'note', 'silence'],
    icon: '♬ 𝄾'
  },
  'corchea_2_semi': {
    label: 'Corchea - 2 Semicorcheas',
    slots: ['note', 'merged', 'note', 'note'],
    icon: '♫'
  },
  'semi_corchea_semi': {
    label: 'Semicorchea - Corchea - Semicorchea',
    slots: ['note', 'note', 'merged', 'note'],
    icon: '♬'
  },
  '2_semi_corchea': {
    label: '2 Semicorcheas - Corchea',
    slots: ['note', 'note', 'note', 'merged'],
    icon: '♬'
  },
  'silencio_corchea_semi': {
    label: 'Silencio - Corchea - Semicorchea',
    slots: ['silence', 'note', 'merged', 'note'],
    icon: '𝄾 ♫'
  },
  'corchea_punto_semi': {
    label: 'Corchea con punto - Semicorchea',
    slots: ['note', 'merged', 'merged', 'note'],
    icon: '♩. ♬'
  },
  'silencio_semi_silencio_semi': {
    label: 'Silencio - Semicorchea - Silencio - Semicorchea',
    slots: ['silence', 'note', 'silence', 'note'],
    icon: '𝄾 ♬ 𝄾 ♬'
  },
  'silencio_corchea_punto_semi': {
    label: 'Silencio de corchea con punto - Semicorchea',
    slots: ['silence', 'merged', 'merged', 'note'],
    icon: '𝄾. ♬'
  },
  'silencio_corchea_punto': {
    label: 'Silencio - Corchea con punto',
    slots: ['silence', 'note', 'merged', 'merged'],
    icon: '𝄾 ♩.'
  }
}

const EIGHTH_PATTERNS = {
  '2_notes': {
    label: '2 Semicorcheas',
    slots: ['note', 'note'],
    icon: '♫'
  },
  'silence_note': {
    label: 'Silencio - Semicorchea',
    slots: ['silence', 'note'],
    icon: '𝄾 ♬'
  },
  'note_silence': {
    label: 'Semicorchea - Silencio',
    slots: ['note', 'silence'],
    icon: '♬ 𝄾'
  }
}

const clickBeat = (measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex) => {
  if (isSelectionMode.value) {
    toggleMeasureSelection(measureIndex)
    return
  }
  
  const m = measures.value[measureIndex]
  if (pendingSelection.value) {
    if (pendingSelection.value.measureIndex === measureIndex) {
      let chordObj = null
      if (subdivisionIndex !== undefined && subdivisionIndex !== null) {
        const beat = m.beats[beatIndex]
        if (beat && beat.subdivisions) {
          chordObj = beat.subdivisions[subdivisionIndex]
        }
      } else {
        chordObj = m.beats[beatIndex]
      }
      
      if (chordObj) {
        if (!chordObj.id) {
          chordObj.id = generateUniqueId()
        }
        
        const start = pendingSelection.value.start
        const end = pendingSelection.value.end
        
        if (!m.lyrics) {
          m.lyrics = { rawText: '', mode: 'free', anchors: [] }
        }
        if (!m.lyrics.anchors) {
          m.lyrics.anchors = []
        }
        
        // Remove overlapping anchors: (a.start < end && a.end > start)
        m.lyrics.anchors = m.lyrics.anchors.filter(a => !(a.start < end && a.end > start))
        
        m.lyrics.anchors.push({
          chordId: chordObj.id,
          start,
          end
        })
        
        pendingSelection.value = null
        updateConnectors()
      }
      return
    } else {
      pendingSelection.value = null
    }
  }
  
  activeDropdown.value = null
  activeRhythmSelector.value = null
  isMeasureOptionsOpen.value = false
  isRepeatMenuOpen.value = false
  isSystemSuggestionsModalOpen.value = false
  openModal(measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex)
}

const isRhythmSelectorActive = (measureIndex, beatIndex) => {
  return activeRhythmSelector.value &&
         activeRhythmSelector.value.measureIndex === measureIndex &&
         activeRhythmSelector.value.beatIndex === beatIndex
}

const isRhythmSelectorActiveForMeasure = (measureIndex) => {
  return activeRhythmSelector.value &&
         activeRhythmSelector.value.measureIndex === measureIndex
}

const isSystemActive = (system) => {
  if (!system || !system.measures || !activeRhythmSelector.value) return false
  return system.measures.some(m => m.originalMeasureIndex === activeRhythmSelector.value.measureIndex)
}

const openLocalMetricInfo = (measure) => {
  if (!measure) return
  selectedMeasureIndex.value = measure.originalMeasureIndex
  isMeasureOptionsOpen.value = true
  startLocalMetricSetup()
}

const openRhythmSelector = (measureIndex, beatIndex) => {
  const isSame = isRhythmSelectorActive(measureIndex, beatIndex)
    
  if (isSame) {
    activeRhythmSelector.value = null
  } else {
    activeDropdown.value = null
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
    if (m) {
      if (!isFigureValid(rhythmType, m, beatIndex)) {
        const sig = getMeasureTimeSignature(m)
        const isDenom8 = sig.unit === 8
        const dur = getRhythmFigureDuration(rhythmType, isDenom8)
        const capacity = sig.beats
        const unitName = isDenom8 ? 'corcheas' : 'negras'
        showToast(`No cabe en este compás: esta figura ocupa ${dur} ${unitName}, pero el compás tiene capacidad de ${capacity} o choca con otro acorde.`)
        return
      }

      const figObj = getAvailableRhythmFigures(m).find(f => f.value === rhythmType)
      if (figObj && figObj.isPro && currentPlan.value === 'FREE') {
        activeRhythmSelector.value = null
        upgradeReason.value = 'ritmo_armonico'
        isUpgradeModalOpen.value = true
        return
      }
      
      const beat = m.beats[beatIndex]
      if (beat) {
        changeBeatHarmonicRhythm(m, beat, rhythmType)
        m.groove = 'custom'
        
        // Clear any chords that are now covered by this new figure's duration
        const sig = getMeasureTimeSignature(m)
        const isDenom8 = sig.unit === 8
        const dur = getRhythmFigureDuration(rhythmType, isDenom8)
        for (let j = 1; j < dur; j++) {
          if (beatIndex + j < m.beats.length) {
            const coveredBeat = m.beats[beatIndex + j]
            coveredBeat.root = ''
            coveredBeat.type = ''
            coveredBeat.tensions = []
            coveredBeat.tension = null
            coveredBeat.bass = null
            coveredBeat.harmonicRhythm = null
          }
        }
        
        activeRhythmSelector.value = null
      }
    }
  }
}

const selectSixteenthPattern = (measure, beat, patternKey) => {
  const pattern = SIXTEENTH_PATTERNS[patternKey]
  if (!pattern) return
  saveHistory()
  
  beat.harmonicRhythm = 'sixteenth'
  beat.sixteenthPattern = patternKey
  
  const newSubs = []
  for (let i = 0; i < 4; i++) {
    const slotType = pattern.slots[i]
    const isNote = slotType === 'note'
    
    newSubs.push({
      root: isNote ? beat.root : '',
      type: isNote ? beat.type : '',
      tensions: isNote ? [...(beat.tensions || [])] : [],
      tension: isNote ? beat.tension : null,
      bass: isNote ? beat.bass : null,
      isSilence: slotType === 'silence',
      isMerged: slotType === 'merged'
    })
  }
  
  beat.subdivisions = newSubs
  measure.groove = 'custom'
  activeRhythmSelector.value = null
}

const selectEighthPattern = (measure, beat, patternKey) => {
  const pattern = EIGHTH_PATTERNS[patternKey]
  if (!pattern) return
  saveHistory()
  
  beat.harmonicRhythm = 'eighth'
  beat.eighthPattern = patternKey
  
  const newSubs = []
  for (let i = 0; i < 2; i++) {
    const slotType = pattern.slots[i]
    const isNote = slotType === 'note'
    
    newSubs.push({
      root: isNote ? beat.root : '',
      type: isNote ? beat.type : '',
      tensions: isNote ? [...(beat.tensions || [])] : [],
      tension: isNote ? beat.tension : null,
      bass: isNote ? beat.bass : null,
      isSilence: slotType === 'silence',
      isMerged: slotType === 'merged'
    })
  }
  
  beat.subdivisions = newSubs
  measure.groove = 'custom'
  activeRhythmSelector.value = null
}

const selectSixteenthPatternWrapper = (measure, beat, patternKey) => {
  if (currentPlan.value === 'FREE') {
    activeRhythmSelector.value = null
    upgradeReason.value = 'ritmo_armonico'
    isUpgradeModalOpen.value = true
    return
  }
  const { measureIndex, beatIndex } = activeRhythmSelector.value
  const m = measures.value[measureIndex]
  const rhythm = getEffectiveRhythm(m, beat, beatIndex)
  if (rhythm === 'eighth') {
    selectEighthPattern(m, beat, patternKey)
  } else {
    selectSixteenthPattern(m, beat, patternKey)
  }
}

const getVisibleSlotsForRender = (measure, beat, beatIdx) => {
  const slots = getBeatSlots(measure, beat, beatIdx)
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const origMIdx = measure.originalMeasureIndex
  
  const states = slots.map((s, idx) => ({
    ...s,
    originalIndex: idx,
    flexGrow: 1,
    isMerged: s.isMerged || false
  }))
  
  let visible = []
  if (rhythm === 'sixteenth') {
    const visibleSixteenth = []
    for (let i = 0; i < states.length; i++) {
      if (states[i].isMerged) continue
      
      let flexGrow = 1
      let j = i + 1
      while (j < states.length && states[j].isMerged) {
        flexGrow++
        j++
      }
      
      states[i].flexGrow = flexGrow
      visibleSixteenth.push(states[i])
    }
    
    // Fuse adjacent identical tied slots
    const fused = []
    for (let i = 0; i < visibleSixteenth.length; i++) {
      let current = visibleSixteenth[i]
      let j = i + 1
      while (j < visibleSixteenth.length) {
        const next = visibleSixteenth[j]
        const nextSlotId = `${origMIdx}_${beatIdx}_${next.originalIndex}`
        if (areChordsEqual(current, next) && tiedSlots.value.has(nextSlotId)) {
          current.flexGrow += next.flexGrow
          j++
        } else {
          break
        }
      }
      fused.push(current)
      i = j - 1
    }
    visible = fused
  } else {
    const visibleNonSixteenth = []
    for (let i = 0; i < states.length; i++) {
      let current = states[i]
      let j = i + 1
      while (j < states.length) {
        const next = states[j]
        const nextSlotId = `${origMIdx}_${beatIdx}_${next.originalIndex}`
        if (areChordsEqual(current, next) && tiedSlots.value.has(nextSlotId)) {
          current.flexGrow += next.flexGrow
          j++
        } else {
          break
        }
      }
      visibleNonSixteenth.push(current)
      i = j - 1
    }
    visible = visibleNonSixteenth
  }
  
  // Collapse logic: if all visible slots are non-silence, have a chord, and are identical:
  if (
    visible.length > 1 &&
    visible.every(s => !s.isSilence && s.root) &&
    visible.every(s => areChordsEqual(s, visible[0]))
  ) {
    return [{
      ...visible[0],
      originalIndex: 0,
      flexGrow: visible.reduce((sum, s) => sum + s.flexGrow, 0),
      isCollapsedSubdivision: true
    }]
  }
  
  return visible
}

const selectSixteenthPatternInModal = (patternObj, patternKey) => {
  if (selectedBeat.value) {
    saveHistory()
    const { measureIndex, beatIndex } = selectedBeat.value
    const m = measures.value[measureIndex]
    const beat = m.beats[beatIndex]
    if (beat) {
      const newSubs = []
      for (let i = 0; i < 4; i++) {
        const slotType = patternObj.slots[i]
        const isNote = slotType === 'note'
        
        newSubs.push({
          root: isNote ? beat.root : '',
          type: isNote ? beat.type : '',
          tensions: isNote ? [...(beat.tensions || [])] : [],
          tension: isNote ? beat.tension : null,
          bass: isNote ? beat.bass : null,
          isSilence: slotType === 'silence',
          isMerged: slotType === 'merged'
        })
      }
      
      beat.subdivisions = newSubs
      beat.sixteenthPattern = patternKey
      beat.harmonicRhythm = 'sixteenth'
      m.groove = 'custom'
    }
  }
}

const selectEighthPatternInModal = (patternObj, patternKey) => {
  if (selectedBeat.value) {
    saveHistory()
    const { measureIndex, beatIndex } = selectedBeat.value
    const m = measures.value[measureIndex]
    const beat = m.beats[beatIndex]
    if (beat) {
      const newSubs = []
      for (let i = 0; i < 2; i++) {
        const slotType = patternObj.slots[i]
        const isNote = slotType === 'note'
        
        newSubs.push({
          root: isNote ? beat.root : '',
          type: isNote ? beat.type : '',
          tensions: isNote ? [...(beat.tensions || [])] : [],
          tension: isNote ? beat.tension : null,
          bass: isNote ? beat.bass : null,
          isSilence: slotType === 'silence',
          isMerged: slotType === 'merged'
        })
      }
      
      beat.subdivisions = newSubs
      beat.eighthPattern = patternKey
      beat.harmonicRhythm = 'eighth'
      m.groove = 'custom'
    }
  }
}
const closeDropdowns = (e) => {
  if (!e.target.closest('.dropdown-container') && !e.target.closest('.quick-popover-container') && !e.target.closest('.rhythm-popover-container')) {
    activeDropdown.value = null
    activeRhythmSelector.value = null
  }
}
const handleKeyDown = (event) => {
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdowns)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyDown)
  updateConnectors()
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
})
const activeModalKeyAndScale = computed(() => {
  if (selectedBeat.value) {
    const measureIdx = selectedBeat.value.measureIndex
    const beatIdx = selectedBeat.value.beatIndex
    return getBeatKeyAndScale(measureIdx, beatIdx)
  }
  return { key: key.value, scale: scaleType.value }
})
const diatonicChords = computed(() => {
  const { key: activeKey, scale: activeScale } = activeModalKeyAndScale.value
  return getDiatonicChords(activeKey, activeScale, modalComplexity.value)
})

const getNextWrittenChord = (selectedBeatVal) => {
  if (!selectedBeatVal) return null
  const { measureIndex, beatIndex, subdivisionIndex } = selectedBeatVal
  
  // 1. Look in the rest of the current measure
  const m = measures.value[measureIndex]
  if (m) {
    const sig = getMeasureTimeSignature(m)
    // Start searching from the next slot in the current measure
    // Let's list all slots of the measure chronologically
    const slots = []
    for (let bIdx = 0; bIdx < sig.beats; bIdx++) {
      const beat = m.beats[bIdx]
      if (beat) {
        const rhythm = getEffectiveRhythm(m, beat, bIdx)
        const subSlots = getBeatSlots(m, beat, bIdx)
        if (subSlots && subSlots.length > 1) {
          subSlots.forEach((s, sIdx) => {
            slots.push({ measureIndex, beatIndex: bIdx, subdivisionIndex: sIdx, chord: s })
          })
        } else {
          slots.push({ measureIndex, beatIndex: bIdx, chord: beat })
        }
      }
    }
    
    // Find our current slot's index in the list
    let curIdx = -1
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (s.beatIndex === beatIndex && (subdivisionIndex === undefined || s.subdivisionIndex === subdivisionIndex)) {
        curIdx = i
        break
      }
    }
    
    // Search forward from curIdx + 1 in the current measure
    if (curIdx !== -1) {
      for (let i = curIdx + 1; i < slots.length; i++) {
        if (slots[i].chord && slots[i].chord.root) {
          return {
            chord: slots[i].chord,
            measureIndex,
            beatIndex: slots[i].beatIndex,
            subdivisionIndex: slots[i].subdivisionIndex,
            distance: i - curIdx
          }
        }
      }
    }
  }
  
  // 2. Look in the next measure (measureIndex + 1)
  const nextM = measures.value[measureIndex + 1]
  if (nextM) {
    const sig = getMeasureTimeSignature(nextM)
    for (let bIdx = 0; bIdx < sig.beats; bIdx++) {
      const beat = nextM.beats[bIdx]
      if (beat) {
        const subSlots = getBeatSlots(nextM, beat, bIdx)
        if (subSlots && subSlots.length > 1) {
          for (let sIdx = 0; sIdx < subSlots.length; sIdx++) {
            if (subSlots[sIdx].root) {
              return {
                chord: subSlots[sIdx],
                measureIndex: measureIndex + 1,
                beatIndex: bIdx,
                subdivisionIndex: sIdx,
                distance: 99 // different measure
              }
            }
          }
        } else {
          if (beat.root) {
            return {
              chord: beat,
              measureIndex: measureIndex + 1,
              beatIndex: bIdx,
              distance: 99 // different measure
            }
          }
        }
      }
    }
  }
  
  return null
}

const activeModalNextChord = computed(() => {
  return getNextWrittenChord(selectedBeat.value)
})

const secondaryAlternativeChords = computed(() => {
  const targetInfo = activeModalNextChord.value
  if (!targetInfo || !targetInfo.chord || !targetInfo.chord.root) return []
  
  const targetRoot = targetInfo.chord.root
  const targetType = targetInfo.chord.type || ''
  const isTargetMinor = ['min', 'minor', 'm', 'm7', 'min7', 'm9', 'm11', 'dim'].some(t => targetType.toLowerCase().includes(t))
  
  const measureIdx = selectedBeat.value ? selectedBeat.value.measureIndex : 0
  const beatIdx = selectedBeat.value ? selectedBeat.value.beatIndex : 0
  const { key: activeKey } = getBeatKeyAndScale(measureIdx, beatIdx)
  
  const complexity = modalComplexity.value // 'triad' or 'tetrad'
  const list = []
  
  // 1. Dominante Secundario (V / V7)
  const vRoot = transposeNote(targetRoot, 7, activeKey)
  if (vRoot) {
    list.push({
      root: vRoot,
      type: complexity === 'tetrad' ? '7' : '',
      label: complexity === 'tetrad' ? `${vRoot}7` : vRoot,
      degree: complexity === 'tetrad' ? `V7 / ${targetRoot}` : `V / ${targetRoot}`,
      category: 'Dominante Secundario',
      description: `Genera una fuerte resolución de quinta justa descendente hacia el destino.`
    })
  }
  
  // 2. Sustitución de Tritono (subV7)
  const subvRoot = transposeNote(targetRoot, 1, activeKey)
  if (subvRoot) {
    list.push({
      root: subvRoot,
      type: complexity === 'tetrad' ? '7' : '',
      label: complexity === 'tetrad' ? `${subvRoot}7` : subvRoot,
      degree: complexity === 'tetrad' ? `subV7 / ${targetRoot}` : `subV / ${targetRoot}`,
      category: 'Sustitución de Tritono',
      description: `Utiliza una resolución cromática descendente muy suave y comparte el tritono resolutivo.`
    })
  }
  
  // 3. ii Relacionado (ii7 o ii7b5)
  const iiRoot = transposeNote(targetRoot, 2, activeKey)
  if (iiRoot) {
    let iiType = 'min'
    let iiLabel = `${iiRoot}m`
    let iiDegree = `ii / ${targetRoot}`
    
    if (complexity === 'tetrad') {
      if (isTargetMinor) {
        iiType = 'm7b5'
        iiLabel = `${iiRoot}m7(b5)`
        iiDegree = `iiø7 / ${targetRoot}`
      } else {
        iiType = 'm7'
        iiLabel = `${iiRoot}m7`
        iiDegree = `ii7 / ${targetRoot}`
      }
    } else {
      if (isTargetMinor) {
        iiType = 'dim'
        iiLabel = `${iiRoot}dim`
        iiDegree = `ii° / ${targetRoot}`
      }
    }
    
    list.push({
      root: iiRoot,
      type: iiType,
      label: iiLabel,
      degree: iiDegree,
      category: 'ii Relacionado',
      description: `Prepara la cadencia ii-V secundaria; proviene de la escala diatónica natural de la tónica destino (Eólico/Dórico en menor, Jónico en mayor).`
    })
  }
  
  // 4. vii° Relacionado (vii°7)
  const viiRoot = transposeNote(targetRoot, 11, activeKey)
  if (viiRoot) {
    let viiType = 'dim'
    let viiLabel = `${viiRoot}dim`
    let viiDegree = `vii° / ${targetRoot}`
    
    if (complexity === 'tetrad') {
      if (isTargetMinor) {
        viiType = 'dim7'
        viiLabel = `${viiRoot}dim7`
        viiDegree = `vii°7 / ${targetRoot}`
      } else {
        viiType = 'm7b5'
        viiLabel = `${viiRoot}m7(b5)`
        viiDegree = `viiø7 / ${targetRoot}`
      }
    }
    
    list.push({
      root: viiRoot,
      type: viiType,
      label: viiLabel,
      degree: viiDegree,
      category: 'Sensible Secundaria',
      description: `Construido sobre la sensible cromática inferior del destino, aportando máxima tensión por semitono.`
    })
  }
  
  // 5. Dominante Backdoor (♭VII7)
  const bviiRoot = transposeNote(targetRoot, 10, activeKey)
  if (bviiRoot) {
    list.push({
      root: bviiRoot,
      type: complexity === 'tetrad' ? '7' : '',
      label: complexity === 'tetrad' ? `${bviiRoot}7` : bviiRoot,
      degree: complexity === 'tetrad' ? `♭VII7 / ${targetRoot}` : `♭VII / ${targetRoot}`,
      category: 'Backdoor Dominant',
      description: `Proviene de un intercambio modal con el modo menor paralelo (Eólico) de la tónica destino, resolviendo un tono entero hacia arriba.`
    })
  }

  // 6. Acorde Napolitano (♭II / ♭IImaj7)
  const bIIRoot = transposeNote(targetRoot, 1, activeKey)
  if (bIIRoot) {
    list.push({
      root: bIIRoot,
      type: complexity === 'tetrad' ? 'maj7' : '',
      label: complexity === 'tetrad' ? `${bIIRoot}maj7` : bIIRoot,
      degree: complexity === 'tetrad' ? `♭IImaj7 / ${targetRoot}` : `♭II / ${targetRoot}`,
      category: 'Intercambio Frigio',
      description: `Acorde Napolitano. Proviene del modo Frigio del destino; aporta un color dramático, andaluz y de película al resolver medio tono hacia abajo.`
    })
  }

  // 7. Subdominante Mayor/Menor (IV / iv)
  const ivRoot = transposeNote(targetRoot, 5, activeKey)
  if (ivRoot) {
    if (isTargetMinor) {
      list.push({
        root: ivRoot,
        type: complexity === 'tetrad' ? 'maj7' : '',
        label: complexity === 'tetrad' ? `${ivRoot}maj7` : ivRoot,
        degree: complexity === 'tetrad' ? `IVmaj7 / ${targetRoot}` : `IV / ${targetRoot}`,
        category: 'Carácter Épico (Dórico)',
        description: `Subdominante Mayor (IV). Proviene del intercambio modal con el modo Dórico; crea una atmósfera heroica, brillante y épica de película de fantasía.`
      })
    } else {
      list.push({
        root: ivRoot,
        type: complexity === 'tetrad' ? 'm7' : 'min',
        label: complexity === 'tetrad' ? `${ivRoot}m7` : `${ivRoot}m`,
        degree: complexity === 'tetrad' ? `iv7 / ${targetRoot}` : `iv / ${targetRoot}`,
        category: 'Carácter Nostálgico',
        description: `Subdominante Menor (iv). Proviene del intercambio modal con el modo Eólico; aporta un color sumamente melancólico, nostálgico o romántico de cine.`
      })
    }
  }

  // 8. Cadencia Exótica Húngara (♯II° / ♯iv°)
  if (isTargetMinor) {
    const hRoot = transposeNote(targetRoot, 6, activeKey) // sharp 4th
    if (hRoot) {
      list.push({
        root: hRoot,
        type: complexity === 'tetrad' ? 'dim7' : 'dim',
        label: complexity === 'tetrad' ? `${hRoot}dim7` : `${hRoot}dim`,
        degree: complexity === 'tetrad' ? `♯iv°7 / ${targetRoot}` : `♯iv° / ${targetRoot}`,
        category: 'Cadencia Exótica',
        description: `Aproximación de la Escala Menor Húngara. Aporta un color tenso, misterioso y exótico de carácter gitano antes de resolver al destino.`
      })
    }
  } else {
    const hRoot = transposeNote(targetRoot, 3, activeKey) // sharp 2nd
    if (hRoot) {
      list.push({
        root: hRoot,
        type: complexity === 'tetrad' ? 'dim7' : 'dim',
        label: complexity === 'tetrad' ? `${hRoot}dim7` : `${hRoot}dim`,
        degree: complexity === 'tetrad' ? `♯II°7 / ${targetRoot}` : `♯II° / ${targetRoot}`,
        category: 'Cadencia Exótica',
        description: `Aproximación de la Escala Mayor Húngara. Resuelve cromáticamente hacia arriba con un sonido místico, oriental y muy llamativo.`
      })
    }
  }

  // 9. Tritono Locrio (♭V o ♭Vmaj7) - Locrio Espacial
  const bVRoot = transposeNote(targetRoot, 6, activeKey)
  if (bVRoot) {
    list.push({
      root: bVRoot,
      type: complexity === 'tetrad' ? 'maj7' : '',
      label: complexity === 'tetrad' ? `${bVRoot}maj7` : bVRoot,
      degree: complexity === 'tetrad' ? `♭Vmaj7 / ${targetRoot}` : `♭V / ${targetRoot}`,
      category: '🔮 Locrio Espacial',
      description: `Resuelve a distancia de tritono. Aporta un color de ciencia ficción, ingravidez y misterio interestelar.`,
      isExotic: true,
      styleType: 'indigo'
    })
  }

  // 10. Mediante Cromática Lidia (III o IIImaj7) - Lidio Mediante
  const IIIRoot = transposeNote(targetRoot, 4, activeKey)
  if (IIIRoot) {
    list.push({
      root: IIIRoot,
      type: complexity === 'tetrad' ? 'maj7' : '',
      label: complexity === 'tetrad' ? `${IIIRoot}maj7` : IIIRoot,
      degree: complexity === 'tetrad' ? `IIImaj7 / ${targetRoot}` : `III / ${targetRoot}`,
      category: '🪐 Lidio Mediante',
      description: `Mediante cromática mayor (4 semitonos arriba). Aporta un brillo místico instantáneo y una transición cinematográfica trascendental.`,
      isExotic: true,
      styleType: 'gold'
    })
  }

  // 11. Subdominante Menor Mística (iv o iv(mM7)) - Misticismo Noir
  const iv_exoticRoot = transposeNote(targetRoot, 5, activeKey)
  if (iv_exoticRoot) {
    list.push({
      root: iv_exoticRoot,
      type: complexity === 'tetrad' ? 'mM7' : 'min',
      label: complexity === 'tetrad' ? `${iv_exoticRoot}mM7` : `${iv_exoticRoot}m`,
      degree: complexity === 'tetrad' ? `iv(M7) / ${targetRoot}` : `iv / ${targetRoot}`,
      category: '🌌 Misticismo Noir',
      description: `Subdominante menor con séptima mayor. Combina la melancolía del modo menor y la tensión de la séptima mayor, evocando cine negro (Film Noir).`,
      isExotic: true,
      styleType: 'emerald'
    })
  }
  
  return list
})

const wasBeatAlreadySet = ref(false)
const openModal = (measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex) => {
  // Close all other bottom-sheet modals first to prevent stacking
  isMeasureOptionsOpen.value = false
  isRepeatMenuOpen.value = false
  isSystemSuggestionsModalOpen.value = false
  
  const m = measures.value[measureIndex]
  const b = m ? m.beats[beatIndex] : null
  applyToAllSubslots.value = b ? isSubdivisionCollapsed(m, b, beatIndex) : false
  
  selectedBeat.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex }
  
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
    saveHistory()
    const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
    const m = measures.value[measureIndex]
    const beat = m.beats[beatIndex]
    
    // Check if selecting a chord on a silence slot (only if chordObj.root is not empty and rhythm has predefined patterns)
    if (chordObj.root && subdivisionIndex !== undefined) {
      const rhythm = getEffectiveRhythm(m, beat, beatIndex)
      if (rhythm === 'eighth' || rhythm === 'sixteenth') {
        const slots = getBeatSlots(m, beat, beatIndex)
        const targetSlot = slots[subdivisionIndex]
        if (targetSlot && targetSlot.isSilence) {
          showRhythmPrompt(m, beat, subdivisionIndex, chordObj)
          return
        }
      }
    }
    
    const oldChord = activeEditingBeat.value ? {
      root: activeEditingBeat.value.root,
      type: activeEditingBeat.value.type,
      tension: activeEditingBeat.value.tension,
      bass: activeEditingBeat.value.bass,
      tensions: [...(activeEditingBeat.value.tensions || [])],
      isSilence: activeEditingBeat.value.isSilence
    } : null
    
    if (subdivisionIndex !== undefined) {
      const rhythm = getEffectiveRhythm(m, beat, beatIndex)
      const sig = getMeasureTimeSignature(m)
      const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
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
        bass: null,
        isSilence: !chordObj.root
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
    
    if (oldChord) {
      const newChord = {
        root: chordObj.root,
        type: chordObj.type,
        tension: null,
        bass: null,
        tensions: [],
        isSilence: !chordObj.root
      }
      if (subdivisionIndex !== undefined) {
        propagateSubdivisionMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
      }
      propagateChordMutation(measureIndex, beatIndex, subdivisionIndex, oldChord, newChord)
    }
    
    // Cerrar inmediatamente el modal/pestaña al seleccionar un acorde.
    // El usuario puede volver a hacer clic sobre él para abrir y configurar extensiones o bajo alternativo.
    isModalOpen.value = false
    if (chordObj.root) {
      wasBeatAlreadySet.value = true
    }
  }
}

const showRhythmPrompt = (measure, beat, slotIdx, chordObj) => {
  rhythmPromptMeasure.value = measure
  rhythmPromptBeat.value = beat
  rhythmPromptSlotIndex.value = slotIdx
  rhythmPromptTargetChord.value = chordObj
  
  const beatIdx = measure.beats.indexOf(beat)
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const patternSource = rhythm === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS
  
  const matching = []
  for (const [key, pat] of Object.entries(patternSource)) {
    if (pat.slots[slotIdx] === 'note') {
      matching.push({
        key,
        ...pat
      })
    }
  }
  
  rhythmPromptMatchingPatterns.value = matching
  isRhythmPromptOpen.value = true
}

const confirmRhythmPrompt = (patternKey) => {
  const beat = rhythmPromptBeat.value
  const measure = rhythmPromptMeasure.value
  const slotIdx = rhythmPromptSlotIndex.value
  const chordObj = rhythmPromptTargetChord.value
  
  if (!beat || !measure || slotIdx === null || !chordObj) return
  
  const beatIdx = measure.beats.indexOf(beat)
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const patternSource = rhythm === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS
  const pattern = patternSource[patternKey]
  if (!pattern) return
  
  const subCount = rhythm === 'eighth' ? 2 : 4
  
  let firstNoteIdx = -1
  for (let i = 0; i < subCount; i++) {
    if (pattern.slots[i] === 'note') {
      firstNoteIdx = i
      break
    }
  }
  
  const newSubs = []
  for (let i = 0; i < subCount; i++) {
    const slotType = pattern.slots[i]
    const isNote = slotType === 'note'
    
    newSubs.push({
      root: isNote ? chordObj.root : '',
      type: isNote ? chordObj.type : '',
      tensions: isNote ? (chordObj.tensions ? [...chordObj.tensions] : []) : [],
      tension: isNote ? chordObj.tension : null,
      bass: isNote ? chordObj.bass : null,
      isSilence: slotType === 'silence',
      isMerged: slotType === 'merged'
    })
  }
  
  const primaryNote = newSubs[firstNoteIdx]
  if (primaryNote) {
    beat.root = primaryNote.root
    beat.type = primaryNote.type
    beat.tensions = [...(primaryNote.tensions || [])]
    beat.tension = primaryNote.tension
    beat.bass = primaryNote.bass
  }
  
  beat.subdivisions = newSubs
  if (rhythm === 'eighth') {
    beat.eighthPattern = patternKey
  } else {
    beat.sixteenthPattern = patternKey
  }
  beat.harmonicRhythm = rhythm
  measure.groove = 'custom'
  
  // Close both modals
  isRhythmPromptOpen.value = false
  isModalOpen.value = false
  wasBeatAlreadySet.value = true
  
  // Reset prompt variables
  rhythmPromptBeat.value = null
  rhythmPromptMeasure.value = null
  rhythmPromptSlotIndex.value = null
  rhythmPromptTargetChord.value = null
}

const getEighthRestSVG = (x) => {
  return `<line x1="${x + 6}" y1="6" x2="${x + 2}" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="${x + 2}" cy="9.5" r="1.3" fill="currentColor"/>
          <path d="M ${x + 2} 9.5 Q ${x + 4.5} 6.5 ${x + 6} 9" stroke="currentColor" stroke-width="1.2" fill="none"/>`;
}

const getSixteenthRestSVG = (x) => {
  return `<line x1="${x + 6}" y1="4" x2="${x + 1.5}" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="${x + 2.5}" cy="7.5" r="1.3" fill="currentColor"/>
          <path d="M ${x + 2.5} 7.5 Q ${x + 4.5} 4.5 ${x + 6.5} 7.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <circle cx="${x + 0.5}" cy="12.5" r="1.3" fill="currentColor"/>
          <path d="M ${x + 0.5} 12.5 Q ${x + 2} 9.5 ${x + 4.5} 12.5" stroke="currentColor" stroke-width="1.2" fill="none"/>`;
}

const getSixteenthDoubleFlagSVG = (x) => {
  return `<path d="M ${x} 5 Q ${x + 5} 9 ${x + 4} 14" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <path d="M ${x} 8.5 Q ${x + 5} 12.5 ${x + 4} 17.5" stroke="currentColor" stroke-width="1.2" fill="none"/>`;
}

const getEighthSingleFlagSVG = (x) => {
  return `<path d="M ${x} 5 Q ${x + 5} 9 ${x + 4} 14" stroke="currentColor" stroke-width="1.2" fill="none"/>`;
}

const getRhythmIconSVG = (key) => {
  // Patrones de 2 notas (Eighths subdivided into Sixteenths)
  if (key === '2_notes') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="30" y1="5" x2="70" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="30" y1="8.5" x2="70" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'silence_note') {
    return getSixteenthRestSVG(20) +
           `<circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>` +
            getSixteenthDoubleFlagSVG(70);
  }
  if (key === 'note_silence') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>` +
            getSixteenthDoubleFlagSVG(30) +
            getSixteenthRestSVG(60);
  }

  // Figuras Básicas
  if (key === 'whole') {
    return `<ellipse cx="50" cy="12" rx="6" ry="4.5" stroke="currentColor" stroke-width="2" fill="none"/>`;
  }
  if (key === 'dotted-half') {
    return `<ellipse cx="42" cy="17" rx="5.5" ry="4" stroke="currentColor" stroke-width="2" fill="none" transform="rotate(-15 42 17)"/>
            <line x1="47.5" y1="17" x2="47.5" y2="4" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="55" cy="17" r="1.5" fill="currentColor"/>`;
  }
  if (key === 'double') {
    return `<ellipse cx="46" cy="17" rx="5.5" ry="4" stroke="currentColor" stroke-width="2" fill="none" transform="rotate(-15 46 17)"/>
            <line x1="51.5" y1="17" x2="51.5" y2="4" stroke="currentColor" stroke-width="1.5"/>`;
  }
  if (key === 'dotted-quarter') {
    return `<ellipse cx="44" cy="17" rx="5" ry="3.5" fill="currentColor" transform="rotate(-15 44 17)"/>
            <line x1="49" y1="17" x2="49" y2="4" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="56" cy="17" r="1.5" fill="currentColor"/>`;
  }
  if (key === 'quarter') {
    return `<circle cx="50" cy="17" r="2.5" fill="currentColor"/>
            <line x1="50" y1="17" x2="50" y2="5" stroke="currentColor" stroke-width="1.5"/>`;
  }
  if (key === 'eighth') {
    return `<circle cx="30" cy="17" r="2.5" fill="currentColor"/>
            <circle cx="70" cy="17" r="2.5" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.5"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.5"/>
            <line x1="30" y1="5" x2="70" y2="5" stroke="currentColor" stroke-width="2.5"/>`;
  }
  if (key === 'offbeat') {
    return getEighthRestSVG(30) +
           `<circle cx="70" cy="17" r="2.5" fill="currentColor"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M 70 5 Q 77 9 75 15" stroke="currentColor" stroke-width="1.5" fill="none"/>`;
  }
  if (key === 'triplet') {
    return `<circle cx="20" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="50" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="80" cy="17" r="2.2" fill="currentColor"/>
            <line x1="20" y1="17" x2="20" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="50" y1="17" x2="50" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="80" y1="17" x2="80" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="20" y1="6" x2="80" y2="6" stroke="currentColor" stroke-width="2"/>
            <text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'quintuplet') {
    return `<circle cx="15" cy="17" r="1.8" fill="currentColor"/>
            <circle cx="32.5" cy="17" r="1.8" fill="currentColor"/>
            <circle cx="50" cy="17" r="1.8" fill="currentColor"/>
            <circle cx="67.5" cy="17" r="1.8" fill="currentColor"/>
            <circle cx="85" cy="17" r="1.8" fill="currentColor"/>
            <line x1="15" y1="17" x2="15" y2="7" stroke="currentColor" stroke-width="1"/>
            <line x1="32.5" y1="17" x2="32.5" y2="7" stroke="currentColor" stroke-width="1"/>
            <line x1="50" y1="17" x2="50" y2="7" stroke="currentColor" stroke-width="1"/>
            <line x1="67.5" y1="17" x2="67.5" y2="7" stroke="currentColor" stroke-width="1"/>
            <line x1="85" y1="17" x2="85" y2="7" stroke="currentColor" stroke-width="1"/>
            <line x1="15" y1="7" x2="85" y2="7" stroke="currentColor" stroke-width="1.8"/>
            <line x1="15" y1="10" x2="85" y2="10" stroke="currentColor" stroke-width="1.8"/>
            <text x="50" y="6" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">5</text>`;
  }

  // Familia de Semicorcheas
  if (key === '4_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'silencio_3_semi') {
    return getSixteenthRestSVG(12.5) +
           `<circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="37.5" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'semi_silencio_2_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getSixteenthDoubleFlagSVG(12.5) +
           getSixteenthRestSVG(37.5) +
           `<circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="62.5" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === '2_semi_silencio_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="37.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="37.5" y2="8.5" stroke="currentColor" stroke-width="2"/>` +
           getSixteenthRestSVG(62.5) +
           `<circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getSixteenthDoubleFlagSVG(87.5);
  }
  if (key === '3_semi_silencio') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="62.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="62.5" y2="8.5" stroke="currentColor" stroke-width="2"/>` +
           getSixteenthRestSVG(87.5);
  }
  if (key === 'corchea_2_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="62.5" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'semi_corchea_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="20" y2="8.5" stroke="currentColor" stroke-width="2"/>
            <line x1="80" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === '2_semi_corchea') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="62.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="37.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'silencio_corchea_semi') {
    return getSixteenthRestSVG(12.5) +
           `<circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="80" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'corchea_punto_semi') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="19" cy="17" r="0.75" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="80" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'silencio_semi_silencio_semi') {
    return getSixteenthRestSVG(12.5) +
           `<circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getSixteenthDoubleFlagSVG(37.5) +
           getSixteenthRestSVG(62.5) +
           `<circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getSixteenthDoubleFlagSVG(87.5);
  }
  if (key === 'silencio_corchea_punto_semi') {
    return getEighthRestSVG(12.5) +
           getSixteenthRestSVG(37.5) +
           `<circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getSixteenthDoubleFlagSVG(87.5);
  }
  if (key === 'silencio_corchea_punto') {
    return getSixteenthRestSVG(12.5) +
           `<circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="44" cy="17" r="0.75" fill="currentColor"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>` +
           getEighthSingleFlagSVG(37.5);
  }
  return '';
}

function isMeasureDense(measure) {
  if (!measure || !measure.beats) return false
  
  // If any beat is subdivided (rhythm !== 'quarter'), make the measure dense/double-width
  const hasSubdivisions = measure.beats.some((b, bIdx) => {
    const rhythm = getEffectiveRhythm(measure, b, bIdx)
    return rhythm !== 'quarter'
  })
  if (hasSubdivisions) return true

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
function isMeasureSixteenth(measure) {
  if (!measure || !measure.beats) return false
  return measure.beats.some((b, bIdx) => {
    const rhythm = getEffectiveRhythm(measure, b, bIdx)
    return rhythm === 'sixteenth' || rhythm === 'quintuplet'
  })
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
  tempShowSubdivisions.value = m.showSubdivisions !== false
  tempShowObligado.value = m.showObligado === true
  isKeyChangeSubMenuOpen.value = false
  isLocalMetricSubMenuOpen.value = false
  
  if (m.keyChange) {
    tempKeyChangeKey.value = m.keyChange.key
    tempKeyChangeScale.value = m.keyChange.scaleType || 'major'
    tempKeyChangeBeatIndex.value = 0
  } else {
    const mWithKey = measuresWithKey.value[mIdx]
    tempKeyChangeKey.value = mWithKey ? mWithKey.activeKey : key.value
    tempKeyChangeScale.value = mWithKey ? mWithKey.activeScale : scaleType.value
    tempKeyChangeBeatIndex.value = 0
  }
  
  isMeasureOptionsOpen.value = true
}
const changeBeatHarmonicRhythm = (measure, beat, rhythmType) => {
  const sig = getMeasureTimeSignature(measure);
  const isDenom8 = sig?.unit === 8;
  const defaultRhythm = isDenom8 ? 'eighth' : 'quarter';
  const prevRhythm = beat.harmonicRhythm || defaultRhythm;
  if (prevRhythm === rhythmType) return;
  
  beat.harmonicRhythm = rhythmType;
  
  const isBaseUnit = isDenom8 ? (rhythmType === 'eighth') : (rhythmType === 'quarter');
  
  if (isBaseUnit) {
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
    delete beat.eighthPattern;
    delete beat.sixteenthPattern;
  } else {
    let subCount = 2;
    if (rhythmType === 'eighth') {
      subCount = 2;
      if (!isDenom8) {
        beat.eighthPattern = '2_notes';
      }
    }
    else if (rhythmType === 'sixteenth') {
      subCount = 4;
      beat.sixteenthPattern = '4_semi';
    }
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
            bass: beat.bass,
            isSilence: beat.isSilence || !beat.root
          };
        } else if (!existing && i === 1 && beat.root && rhythmType === 'offbeat') {
          existing = {
            root: beat.root,
            type: beat.type,
            tensions: [...(beat.tensions || [])],
            tension: beat.tension,
            bass: beat.bass,
            isSilence: beat.isSilence || !beat.root
          };
        }
        
        newSubs.push({
          root: existing?.root || '',
          type: existing?.type || '',
          tensions: existing?.tensions ? [...existing.tensions] : [],
          tension: existing?.tension || null,
          bass: existing?.bass || null,
          isSilence: existing ? (existing.isSilence || !existing.root) : true
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
    saveHistory()
    const { measureIndex, beatIndex } = selectedBeat.value;
    const m = measures.value[measureIndex];
    const beat = m?.beats[beatIndex];
    if (beat) {
      changeBeatHarmonicRhythm(m, beat, rhythmType);
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
    saveHistory()
    const { measureIndex, beatIndex } = selectedBeat.value;
    const m = measures.value[measureIndex];
    const beat = m?.beats[beatIndex];
    if (beat) {
      changeBeatHarmonicRhythm(m, beat, 'quarter');
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
const getSubdivisionCount = (rhythm, isDenom8 = false, beat = null) => {
  if (isDenom8 && rhythm === 'eighth') {
    return beat && beat.eighthPattern ? 2 : 1
  }
  if (rhythm === 'eighth' || rhythm === 'offbeat') return 2
  if (rhythm === 'sixteenth') return 4
  if (rhythm === 'triplet') return 3
  if (rhythm === 'quintuplet') return 5
  return 1
}
function getEffectiveRhythm(measure, beat, beatIdx) {
  if (!beat) return 'quarter'
  if (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto') {
    return beat.harmonicRhythm
  }
  
  // Determine if this is a /8 time signature (base unit is eighth/corchea)
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig?.unit === 8
  
  const mGroove = measure?.groove || 'global'
  if (mGroove === 'neutral' || mGroove === 'custom') {
    // In /8 measures the base unit (1 beat) is an eighth note, not a quarter
    return isDenom8 ? 'eighth' : 'quarter'
  }
  
  const pattern = GROOVE_PATTERNS[globalGroove.value] || GROOVE_PATTERNS.Ninguno
  const grooveRhythm = pattern[beatIdx] || 'quarter'
  
  // In /8 measures: groove 'quarter' (negra) maps to 'eighth' (corchea) as the base beat unit
  if (isDenom8 && grooveRhythm === 'quarter') {
    return 'eighth'
  }
  
  return grooveRhythm
}

const getBeatFlexGrow = (measure, beat, beatIdx) => {
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  if (rhythm === 'sixteenth') return '3 3 0%'
  if (rhythm === 'triplet') return '2 2 0%'
  if (rhythm === 'quintuplet') return '3.5 3.5 0%'
  if (rhythm === 'eighth' || rhythm === 'offbeat') return '1.5 1.5 0%'
  return '1 1 0%'
}

const getLinearSlots = () => {
  const list = []
  measures.value.forEach((measure, mIdx) => {
    const sig = getMeasureTimeSignature(mIdx)
    const visibleBeats = measure.beats.slice(0, sig.beats)
    visibleBeats.forEach((beat, bIdx) => {
      const rhythm = getEffectiveRhythm(measure, beat, bIdx)
      const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
      if (subCount === 1) {
        list.push({
          type: 'beat',
          measureIndex: mIdx,
          beatIndex: bIdx,
          subdivisionIndex: null,
          chord: beat,
          rhythm,
          id: `${mIdx}_${bIdx}`,
          isSilence: !beat.root
        })
      } else {
        const slots = getBeatSlots(measure, beat, bIdx)
        slots.forEach((sub, sIdx) => {
          list.push({
            type: 'subdivision',
            measureIndex: mIdx,
            beatIndex: bIdx,
            subdivisionIndex: sIdx,
            chord: sub,
            rhythm,
            id: `${mIdx}_${bIdx}_${sIdx}`,
            isSilence: sub.isSilence
          })
        })
      }
    })
  })
  return list
}

const getMeasureSlotCoordinates = (measure) => {
  const coords = []
  if (!measure) return coords
  const origMIdx = measure.originalMeasureIndex
  const sig = getMeasureTimeSignature(measure)
  const beats = measure.beats.slice(0, sig.beats)
  
  // Calculate beat weights
  const beatGrows = beats.map((b, bIdx) => {
    const rhythm = getEffectiveRhythm(measure, b, bIdx)
    if (rhythm === 'sixteenth') return 3
    if (rhythm === 'triplet') return 2
    if (rhythm === 'quintuplet') return 3.5
    if (rhythm === 'eighth' || rhythm === 'offbeat') return 1.5
    return 1
  })
  const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
  
  let currentX = 0
  beats.forEach((beat, bIdx) => {
    const beatWidth = (beatGrows[bIdx] / totalGrow) * 1000
    const rhythm = getEffectiveRhythm(measure, beat, bIdx)
    const slots = getVisibleSlotsForRender(measure, beat, bIdx)
    
    if (slots.length === 0) {
      // Normal beat (quarter)
      coords.push({
        id: `${origMIdx}_${bIdx}`,
        x: currentX + beatWidth / 2,
        measureIndex: origMIdx,
        beatIndex: bIdx,
        subdivisionIndex: null
      })
    } else {
      // Subdivided beat
      let slotOffset = 0
      slots.forEach((sub) => {
        const slotWidth = (sub.flexGrow / 4) * beatWidth
        coords.push({
          id: `${origMIdx}_${bIdx}_${sub.originalIndex}`,
          x: currentX + slotOffset + slotWidth / 2,
          measureIndex: origMIdx,
          beatIndex: bIdx,
          subdivisionIndex: sub.originalIndex
        })
        slotOffset += slotWidth
      })
    }
    currentX += beatWidth
  })
  return coords
}

const getLinearBlocks = () => {
  const list = []
  measures.value.forEach((measure, mIdx) => {
    const sig = getMeasureTimeSignature(mIdx)
    const visibleBeats = measure.beats.slice(0, sig.beats)
    const beatStates = getMergedBeats(measure)
    
    beatStates.forEach((state, bIdx) => {
      if (state.isMerged) return
      
      const rhythm = getEffectiveRhythm(measure, state.beat, bIdx)
      const isSubdivided = measure.showObligado && isSubdividedRhythm(rhythm, sig.unit === 8, state.beat)
      
      if (!isSubdivided) {
        list.push({
          type: 'beat',
          measureIndex: mIdx,
          beatIndex: bIdx,
          subdivisionIndex: null,
          chord: state.beat,
          rhythm,
          id: `${mIdx}_${bIdx}`,
          isSilence: !state.beat.root,
          durationSlots: state.durationSlots
        })
      } else {
        const slots = getVisibleSlotsForRender(measure, state.beat, bIdx)
        slots.forEach((sub, sIdx) => {
          list.push({
            type: 'subdivision',
            measureIndex: mIdx,
            beatIndex: bIdx,
            subdivisionIndex: sub.originalIndex,
            chord: sub,
            rhythm,
            id: `${mIdx}_${bIdx}_${sub.originalIndex}`,
            isSilence: sub.isSilence,
            durationSlots: sub.flexGrow
          })
        })
      }
    })
  })
  return list
}

const getSlotNoteX = (rhythm, slotIdx, startX, blockWidth) => {
  let relativeOffset = 0.5
  
  if (rhythm === 'eighth') {
    relativeOffset = slotIdx === 0 ? 0.30 : 0.70
  } else if (rhythm === 'offbeat') {
    relativeOffset = 0.70
  } else if (rhythm === 'triplet') {
    const offsets = [0.20, 0.50, 0.80]
    relativeOffset = offsets[slotIdx] !== undefined ? offsets[slotIdx] : 0.5
  } else if (rhythm === 'quintuplet') {
    const offsets = [0.15, 0.325, 0.50, 0.675, 0.85]
    relativeOffset = offsets[slotIdx] !== undefined ? offsets[slotIdx] : 0.5
  } else if (rhythm === 'sixteenth') {
    const offsets = [0.125, 0.375, 0.625, 0.875]
    relativeOffset = offsets[slotIdx] !== undefined ? offsets[slotIdx] : 0.5
  }
  
  return startX + relativeOffset * blockWidth
}

const getMeasureBlockCoordinates = (measure) => {
  const coords = []
  if (!measure) return coords
  const origMIdx = measure.originalMeasureIndex
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  
  const beatGrows = measure.beats.slice(0, numBeats).map((b, bIdx) => {
    const rhythm = getEffectiveRhythm(measure, b, bIdx)
    if (rhythm === 'sixteenth') return 3
    if (rhythm === 'triplet') return 2
    if (rhythm === 'quintuplet') return 3.5
    if (rhythm === 'eighth' || rhythm === 'offbeat') return 1.5
    return 1
  })
  const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
  
  const beatStates = getMergedBeats(measure)
  
  const beatX = []
  let accumX = 0
  for (let i = 0; i < numBeats; i++) {
    beatX.push(accumX)
    const beatWidth = (beatGrows[i] / totalGrow) * 1000
    accumX += beatWidth
  }
  
  beatStates.forEach((state, bIdx) => {
    if (state.isMerged) return
    
    let blockWidth = 0
    for (let j = 0; j < state.durationSlots; j++) {
      if (bIdx + j < numBeats) {
        blockWidth += (beatGrows[bIdx + j] / totalGrow) * 1000
      }
    }
    
    const startX = beatX[bIdx]
    const rhythm = getEffectiveRhythm(measure, state.beat, bIdx)
    const isSubdivided = measure.showObligado && isSubdividedRhythm(rhythm, sig.unit === 8, state.beat)
    
    if (!isSubdivided) {
      coords.push({
        id: `${origMIdx}_${bIdx}`,
        x: startX + blockWidth / 2,
        firstNoteX: startX + blockWidth / 2,
        lastNoteX: startX + blockWidth / 2,
        measureIndex: origMIdx,
        beatIndex: bIdx,
        subdivisionIndex: null
      })
    } else {
      const slots = getVisibleSlotsForRender(measure, state.beat, bIdx)
      let slotOffset = 0
      slots.forEach((sub) => {
        const slotWidth = (sub.flexGrow / 4) * blockWidth
        
        // Calculate the first and last slot indices covered by this block
        const startSlot = sub.originalIndex
        const endSlot = startSlot + sub.flexGrow - 1
        
        // Use our slot positions helper
        const firstNoteX = getSlotNoteX(rhythm, startSlot, startX, blockWidth)
        const lastNoteX = getSlotNoteX(rhythm, endSlot, startX, blockWidth)
        
        coords.push({
          id: `${origMIdx}_${bIdx}_${sub.originalIndex}`,
          x: startX + slotOffset + slotWidth / 2,
          firstNoteX,
          lastNoteX,
          measureIndex: origMIdx,
          beatIndex: bIdx,
          subdivisionIndex: sub.originalIndex
        })
        slotOffset += slotWidth
      })
    }
  })
  
  return coords
}

const getMeasureTiesPaths = (measure) => {
  const paths = []
  if (!measure) return paths
  const origMIdx = measure.originalMeasureIndex
  
  const coords = getMeasureBlockCoordinates(measure)
  const linearBlocks = getLinearBlocks()
  
  coords.forEach((coord) => {
    const currentLinearIdx = linearBlocks.findIndex(b => b.id === coord.id)
    if (currentLinearIdx === -1) return
    
    const nextBlock = linearBlocks[currentLinearIdx + 1]
    if (nextBlock && tiedSlots.value.has(nextBlock.id)) {
      if (nextBlock.measureIndex === origMIdx) {
        const nextCoord = coords.find(c => c.id === nextBlock.id)
        if (nextCoord) {
          const startX = coord.lastNoteX !== undefined ? coord.lastNoteX : coord.x
          const endX = nextCoord.firstNoteX !== undefined ? nextCoord.firstNoteX : nextCoord.x
          
          paths.push({
            d: `M ${startX} 20 Q ${(startX + endX) / 2} 5 ${endX} 20`,
            type: 'internal'
          })
        }
      } else {
        const startX = coord.lastNoteX !== undefined ? coord.lastNoteX : coord.x
        paths.push({
          d: `M ${startX} 20 Q ${(startX + 1040) / 2} 5 1040 10`,
          type: 'outgoing'
        })
      }
    }
    
    if (tiedSlots.value.has(coord.id)) {
      const prevBlock = linearBlocks[currentLinearIdx - 1]
      if (prevBlock && prevBlock.measureIndex !== origMIdx) {
        const endX = coord.firstNoteX !== undefined ? coord.firstNoteX : coord.x
        paths.push({
          d: `M -40 10 Q ${(endX - 40) / 2} 5 ${endX} 20`,
          type: 'incoming'
        })
      }
    }
  })
  return paths
}

const validateTies = () => {
  const linearBlocks = getLinearBlocks()
  const newTies = new Set()
  
  linearBlocks.forEach((block, idx) => {
    if (idx > 0 && tiedSlots.value.has(block.id)) {
      const prevBlock = linearBlocks[idx - 1]
      if (
        prevBlock &&
        prevBlock.chord.root &&
        block.chord.root &&
        !prevBlock.isSilence &&
        !block.isSilence
      ) {
        newTies.add(block.id)
      }
    }
  })
  tiedSlots.value = newTies
}

watch(measures, () => {
  const beforeCount = tiedSlots.value.size
  validateTies()
  const afterCount = tiedSlots.value.size
  if (afterCount < beforeCount) {
    showToast("Ligado eliminado en este punto")
  }
}, { deep: true })

watch([timeSignature, timeSignatureUnit], () => {
  syncMeasuresBeats()
  const beforeCount = tiedSlots.value.size
  validateTies()
  const afterCount = tiedSlots.value.size
  if (afterCount < beforeCount) {
    showToast("Ligado eliminado en este punto")
  }
})

watch([timeSignature, globalGrouping], () => {
  const currentGroup = globalGrouping.value || getDefaultGrouping(timeSignature.value, timeSignatureUnit.value)
  tempGlobalGroupingStr.value = currentGroup.join('+')
}, { immediate: true })

const canTieActiveSlot = () => {
  if (!selectedBeat.value || !activeEditingBeat.value || !activeEditingBeat.value.root) return false
  const linearBlocks = getLinearBlocks()
  const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
  const slotId = subdivisionIndex !== undefined
    ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
    : `${measureIndex}_${beatIndex}`
    
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return false
  
  return true
}

const isNextSlotTied = () => {
  if (!selectedBeat.value) return false
  const linearBlocks = getLinearBlocks()
  const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
  const slotId = subdivisionIndex !== undefined
    ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
    : `${measureIndex}_${beatIndex}`
    
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return false
  
  const nextBlock = linearBlocks[idx + 1]
  return nextBlock && tiedSlots.value.has(nextBlock.id)
}

const toggleTieActiveSlot = () => {
  if (!canTieActiveSlot()) return
  saveHistory()
  const linearBlocks = getLinearBlocks()
  const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
  const slotId = subdivisionIndex !== undefined
    ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
    : `${measureIndex}_${beatIndex}`
    
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  const currentBlock = linearBlocks[idx]
  const nextBlock = linearBlocks[idx + 1]
  if (!nextBlock) return
  
  if (tiedSlots.value.has(nextBlock.id)) {
    tiedSlots.value.delete(nextBlock.id)
    showToast("Ligado eliminado")
  } else {
    // Copy chord details if next block is a rest/silence (UX helper)
    if (!nextBlock.chord.root || nextBlock.chord.isSilence) {
      nextBlock.chord.root = currentBlock.chord.root
      nextBlock.chord.type = currentBlock.chord.type
      nextBlock.chord.tensions = currentBlock.chord.tensions ? [...currentBlock.chord.tensions] : []
      nextBlock.chord.tension = currentBlock.chord.tension
      nextBlock.chord.bass = currentBlock.chord.bass
      nextBlock.chord.isSilence = false
      
      // Update next block's parent beat properties if it represents a beat chord
      if (nextBlock.type === 'beat') {
        const parentBeat = measures.value[nextBlock.measureIndex].beats[nextBlock.beatIndex]
        parentBeat.root = currentBlock.chord.root
        parentBeat.type = currentBlock.chord.type
        parentBeat.tensions = currentBlock.chord.tensions ? [...currentBlock.chord.tensions] : []
        parentBeat.tension = currentBlock.chord.tension
        parentBeat.bass = currentBlock.chord.bass
      }
    }
    
    tiedSlots.value.add(nextBlock.id)
    showToast("Ligado creado con éxito")
  }
}
const getBeatSlots = (measure, beat, beatIdx) => {
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const subCount = getSubdivisionCount(rhythm, sig?.unit === 8, beat)
  
  if (subCount === 1) return []
  
  if (!beat.subdivisions || beat.subdivisions.length !== subCount) {
    const slots = []
    for (let i = 0; i < subCount; i++) {
      if (rhythm === 'offbeat' && i === 0) {
        slots.push({ id: generateUniqueId(), root: '', type: '', tensions: [], tension: null, bass: null, isSilence: true })
      } else {
        const isPrimary = (rhythm !== 'offbeat' && i === 0) || (rhythm === 'offbeat' && i === 1)
        slots.push({
          id: generateUniqueId(),
          root: isPrimary ? beat.root : '',
          type: isPrimary ? beat.type : '',
          tensions: isPrimary ? [...(beat.tensions || [])] : [],
          tension: isPrimary ? beat.tension : null,
          bass: isPrimary ? beat.bass : null,
          isSilence: isPrimary ? (beat.isSilence || !beat.root) : true
        })
      }
    }
    beat.subdivisions = slots
  }
  
  // Ensure all slots have a unique ID
  beat.subdivisions.forEach(s => {
    if (!s.id) s.id = generateUniqueId()
  })
  
  return beat.subdivisions
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
  saveHistory()
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
  if (rhythm === 'whole') return '\uD834\uDD5D'
  if (rhythm === 'dotted-half') return '\uD834\uDD5E.'
  if (rhythm === 'double') return '\uD834\uDD5E'
  if (rhythm === 'dotted-quarter') return '\uD834\uDD5F.'
  if (rhythm === 'quarter') return '♩'
  if (rhythm === 'eighth') return '♪'
  if (rhythm === 'offbeat') return '↷'
  if (rhythm === 'sixteenth') return '♬'
  if (rhythm === 'triplet') return '3'
  if (rhythm === 'quintuplet') return '5'
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
// Toggle subdivisions for ALL measures at once (global sidebar toggle)
const toggleAllSubdivisions = (event) => {
  const on = event.target.checked
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'ritmo_armonico'
    isUpgradeModalOpen.value = true
    event.target.checked = false // Revert native visual state immediately
    return
  }
  saveHistory()
  globalShowSubdivisions.value = on
}

const toggleGlobalShowObligado = (event) => {
  const on = event.target.checked
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'ritmo_armonico'
    isUpgradeModalOpen.value = true
    event.target.checked = false // Revert native visual state immediately
    return
  }
  saveHistory()
  globalShowObligado.value = on
  measures.value.forEach(m => {
    m.showObligado = on
  })
  syncMeasuresBeats()
  showToast(on ? 'Modo rítmico activado: Los acordes respetarán duración exacta de figuras' : 'Modo rítmico desactivado')
}

const saveMeasureOptions = () => {
  if (selectedMeasureIndex.value !== null) {
    saveHistory()
    const m = measures.value[selectedMeasureIndex.value]
    m.sectionLabel = tempSectionLabel.value === 'Ninguna' ? null : tempSectionLabel.value
    m.showSubdivisions = tempShowSubdivisions.value
    m.showObligado = tempShowObligado.value
    
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
  customTimes.value = 2
  isTimesModalOpen.value = true
}
const confirmTimes = (timesVal) => {
  const times = Number(timesVal)
  if (isNaN(times) || times < 2) {
    alert("Por favor, introduce un número de repeticiones válido (2 o más).")
    return
  }
  saveHistory()
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
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'casillas'
    isUpgradeModalOpen.value = true
    return
  }
  saveHistory()
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  
  // Find repeat that covers the selected end measure (handles both full range and single-last-measure selection)
  const rep = repeats.value.find(r => r.type === 'simple' && r.startMeasure <= end && r.endMeasure >= end)
  if (!rep) return
  
  rep.type = 'casilla'
  rep.casilla1Start = start  // Use the selected start measure for casilla 1
  rep.casilla2Start = rep.endMeasure + 1
  rep.casilla2End = rep.endMeasure + 1
  
  // Auto add measures for Casilla 2 if needed
  while (measures.value.length < rep.casilla2End) {
    const nextIdx = measures.value.length
    const sig = getMeasureTimeSignature(nextIdx)
    const emptyBeats = Array.from({ length: sig.beats }, () => ({ root: '', type: '' }))
    measures.value.push({
      id: generateUniqueId(),
      beats: emptyBeats,
      sectionLabel: null,
      showObligado: globalShowObligado.value,
      showSubdivisions: globalShowSubdivisions.value,
      lyrics: {
        rawText: '',
        mode: 'free'
      }
    })
  }
  
  isSelectionMode.value = false
  clearSelection()
}
const removeRepeat = (id) => {
  saveHistory()
  repeats.value = repeats.value.filter(r => r.id !== id)
}
const addMeasure = () => {
  if (currentPlan.value === 'FREE' && measures.value.length >= 20) {
    upgradeReason.value = 'limit'
    isUpgradeModalOpen.value = true
    return
  }
  saveHistory()
  const nextIdx = measures.value.length
  const sig = getMeasureTimeSignature(nextIdx)
  const emptyBeats = Array.from({ length: sig.beats }, () => ({ root: '', type: '' }))
  measures.value.push({
    id: generateUniqueId(),
    beats: emptyBeats,
    sectionLabel: null,
    showObligado: globalShowObligado.value,
    showSubdivisions: globalShowSubdivisions.value,
    lyrics: {
      rawText: '',
      mode: 'free'
    }
  })
  syncMeasuresBeats()
}

// --- LYRICS HELPERS & NAVIGATION ---
const getMeasureLyricsRef = (measure) => {
  if (!measure.lyrics) {
    measure.lyrics = {
      rawText: '',
      mode: 'free'
    }
  }
  return measure.lyrics
}

watch(measures, (newMeasures) => {
  if (!newMeasures) return
  newMeasures.forEach(m => {
    if (!m.lyrics) {
      m.lyrics = {
        rawText: '',
        mode: 'free',
        anchors: []
      }
    } else if (!m.lyrics.anchors) {
      m.lyrics.anchors = []
    }
    
    const validChordIds = new Set()
    if (m.beats) {
      m.beats.forEach(b => {
        if (!b.id) {
          b.id = generateUniqueId()
        }
        const isBeatActive = b.root && !b.isSilence
        const hasActiveSub = b.subdivisions && b.subdivisions.some(s => s.root && !s.isSilence)
        if (isBeatActive || hasActiveSub) {
          validChordIds.add(b.id)
        }
        if (b.subdivisions) {
          b.subdivisions.forEach(s => {
            if (!s.id) {
              s.id = generateUniqueId()
            }
            if (s.root && !s.isSilence) {
              validChordIds.add(s.id) // Support legacy anchors pointing to subdivisions
            }
          })
        }
      })
    }
    
    // Cleanup invalid anchors only if they change to avoid recursive updates
    const filtered = m.lyrics.anchors.filter(anchor => validChordIds.has(anchor.chordId))
    if (filtered.length !== m.lyrics.anchors.length) {
      m.lyrics.anchors = filtered
    }
  })
  
  // Update connectors since chords or measures changed
  updateConnectors()
}, { immediate: true, deep: true })

const hasSpacerBefore = (measure) => {
  if (!measure) return false
  if (currentPlan.value !== 'PRO') return false
  
  const hasKeyChange = !!measure.keyChange
  const hasMetricChange = measure.timeSignature && measure.displayedMeasureIndex > 0 && 
    (measure.timeSignature.beats !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).beats || 
     measure.timeSignature.unit !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).unit)
     
  return hasKeyChange || hasMetricChange
}

const isFirstOfGroup = (measuresList, idx) => {
  if (idx === 0) return true
  return hasSpacerBefore(measuresList[idx])
}

const isLastOfGroup = (measuresList, idx) => {
  if (idx === measuresList.length - 1) return true
  return hasSpacerBefore(measuresList[idx + 1])
}

const handleLyricsKeydown = (event, currentIndex) => {
  if (event.key === 'Tab') {
    const direction = event.shiftKey ? 'prev' : 'next'
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    
    // Check if target is within bounds
    if (targetIndex >= 0 && targetIndex < measures.value.length) {
      event.preventDefault()
      // If the global switch is off, but we are navigating, we must turn it on so the target textarea is visible and can be focused!
      if (!showLyricsGlobal.value) {
        showLyricsGlobal.value = true
      }
      
      // We wait for Vue to render the elements in nextTick
      setTimeout(() => {
        const targetEl = document.getElementById(`lyrics-textarea-${targetIndex}`)
        if (targetEl) {
          targetEl.focus()
        }
      }, 50)
    }
  }
}

const shouldShowLyricsRow = (system) => {
  if (showLyricsGlobal.value) return true
  
  // Show if any measure in the system has text
  const hasText = system.measures.some(m => m.lyrics && m.lyrics.rawText && m.lyrics.rawText.trim() !== '')
  if (hasText) return true
  
  // Show if any measure in the system is being hovered
  const isHovered = system.measures.some(m => m.originalMeasureIndex === hoveredMeasureIndex.value)
  if (isHovered) return true
  
  return false
}

const activateLyricsForMeasure = (measureOriginalIndex) => {
  showLyricsGlobal.value = true
  setTimeout(() => {
    const el = document.getElementById(`lyrics-textarea-${measureOriginalIndex}`)
    if (el) {
      el.focus()
    }
  }, 50)
}

const getSelectionCharacterOffsetWithin = (element) => {
  let start = 0
  let end = 0
  const doc = element.ownerDocument || element.document
  const win = doc.defaultView || doc.parentWindow
  const sel = win.getSelection()
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(element)
    preCaretRange.setEnd(range.startContainer, range.startOffset)
    start = preCaretRange.toString().length
    end = start + range.toString().length
  }
  return { start, end }
}

const getLyricSegmentsWithPending = (measure) => {
  const measureIndex = measure.originalMeasureIndex
  const rawText = measure.lyrics?.rawText || ''
  const anchors = measure.lyrics?.anchors || []
  const pending = pendingSelection.value && pendingSelection.value.measureIndex === measureIndex ? pendingSelection.value : null
  
  if (!rawText) return []
  
  // Create an array of types/chords for each character
  const charAttrs = Array.from({ length: rawText.length }, (_, idx) => {
    if (pending && idx >= pending.start && idx < pending.end) {
      return { type: 'pending', anchor: null }
    }
    const anchor = anchors.find(a => idx >= a.start && idx < a.end)
    if (anchor) {
      return { type: 'associated', anchor }
    }
    return { type: 'normal', anchor: null }
  })
  
  // Group adjacent characters with identical attributes
  const segments = []
  let currentSegment = null
  
  for (let i = 0; i < rawText.length; i++) {
    const attr = charAttrs[i]
    const char = rawText[i]
    
    if (!currentSegment) {
      currentSegment = {
        text: char,
        start: i,
        end: i + 1,
        type: attr.type,
        anchor: attr.anchor
      }
    } else if (
      currentSegment.type === attr.type &&
      JSON.stringify(currentSegment.anchor) === JSON.stringify(attr.anchor)
    ) {
      currentSegment.text += char
      currentSegment.end = i + 1
    } else {
      segments.push(currentSegment)
      currentSegment = {
        text: char,
        start: i,
        end: i + 1,
        type: attr.type,
        anchor: attr.anchor
      }
    }
  }
  if (currentSegment) {
    segments.push(currentSegment)
  }
  
  return segments
}

const isChordIdRelatedToBeat = (id1, id2, measure) => {
  if (!id1 || !id2 || !measure) return false
  if (id1 === id2) return true
  
  const b1 = (measure.beats || []).find(b => b.id === id1)
  if (b1 && b1.subdivisions && b1.subdivisions.some(s => s.id === id2)) {
    return true
  }
  const b2 = (measure.beats || []).find(b => b.id === id2)
  if (b2 && b2.subdivisions && b2.subdivisions.some(s => s.id === id1)) {
    return true
  }
  return false
}

function updateConnectors() {
  if (currentPlan.value !== 'PRO' || !showLyricsGlobal.value) {
    activeConnectors.value = []
    return
  }
  
  setTimeout(() => {
    const connectors = []
    
    systems.value.forEach(system => {
      const systemEl = document.getElementById(`system-row-${system.id}`)
      if (!systemEl) return
      
      const systemRect = systemEl.getBoundingClientRect()
      
      system.measures.forEach(measure => {
        const anchors = measure.lyrics?.anchors || []
        if (measure.lyrics?.mode !== 'synced') return
        
        anchors.forEach((anchor, aIdx) => {
          let chordEl = document.getElementById(`chord-card-${anchor.chordId}`)
          if (!chordEl) {
            // It might be a beat ID that is subdivided. Let's find the beat.
            const beatObj = measure.beats?.find(b => b.id === anchor.chordId)
            if (beatObj && beatObj.subdivisions) {
              const activeSub = beatObj.subdivisions.find(s => s.root && !s.isSilence)
              if (activeSub) {
                chordEl = document.getElementById(`chord-card-${activeSub.id}`)
              }
            }
          }
          const spanEl = document.getElementById(`lyric-span-${measure.originalMeasureIndex}-${anchor.start}-${anchor.end}`)
          
          if (chordEl && spanEl) {
            const chordRect = chordEl.getBoundingClientRect()
            const spanRect = spanEl.getBoundingClientRect()
            
            const x1 = chordRect.left + chordRect.width / 2 - systemRect.left
            const y1 = chordRect.bottom - systemRect.top
            const x2 = spanRect.left + spanRect.width / 2 - systemRect.left
            const y2 = spanRect.top - systemRect.top
            
            const controlPointYOffset = Math.abs(y2 - y1) * 0.5
            const path = `M ${x1} ${y1} C ${x1} ${y1 + controlPointYOffset}, ${x2} ${y2 - controlPointYOffset}, ${x2} ${y2}`
            
            const isHovered = isChordIdRelatedToBeat(hoveredChordId.value, anchor.chordId, measure) || 
                              (hoveredAnchor.value && 
                               isChordIdRelatedToBeat(hoveredAnchor.value.chordId, anchor.chordId, measure) && 
                               hoveredAnchor.value.start === anchor.start &&
                               hoveredAnchor.value.end === anchor.end)
            
            connectors.push({
              id: `${measure.originalMeasureIndex}-${aIdx}`,
              systemId: system.id,
              path,
              active: isHovered,
              chordId: anchor.chordId,
              anchor
            })
          }
        })
      })
    })
    
    activeConnectors.value = connectors
  }, 30)
}

const getLyricsActiveChordForBeat = (measure, beat) => {
  if (beat.subdivisions && beat.subdivisions.length > 0) {
    const activeSub = beat.subdivisions.find(s => s.root && !s.isSilence)
    return activeSub || beat
  }
  return beat
}

const getNextUnusedChord = (measure) => {
  if (!measure || !measure.beats) return null
  
  const activeBeats = []
  const slots = getAllMeasureSlots(measure)
  slots.forEach(s => {
    const hasChord = s.beat.root || (s.beat.subdivisions && s.beat.subdivisions.some(sub => sub.root && !sub.isSilence))
    if (hasChord) {
      activeBeats.push(s.beat)
    }
  })
  
  if (activeBeats.length === 0) return null
  
  const usedChordIds = new Set((measure.lyrics?.anchors || []).map(a => a.chordId))
  const unused = activeBeats.find(b => !usedChordIds.has(b.id))
  
  return unused || null
}

const assignPendingSelection = (measure) => {
  if (!pendingSelection.value || pendingSelection.value.measureIndex !== measure.originalMeasureIndex) return
  
  const activeBeats = []
  const slots = getAllMeasureSlots(measure)
  slots.forEach(s => {
    const hasChord = s.beat.root || (s.beat.subdivisions && s.beat.subdivisions.some(sub => sub.root && !sub.isSilence))
    if (hasChord) {
      activeBeats.push(s.beat)
    }
  })
  
  if (activeBeats.length === 0) {
    showToast('⚠️ No hay acordes en este compás. Agrega un acorde primero.')
    return
  }
  
  const unusedChord = getNextUnusedChord(measure)
  
  if (!unusedChord) {
    showToast('Todos los acordes ya están asignados. Sugerencia: agrega otro acorde en el compás.')
    return
  }
  
  const start = pendingSelection.value.start
  const end = pendingSelection.value.end
  
  if (!measure.lyrics.anchors) {
    measure.lyrics.anchors = []
  }
  
  // Remove overlapping anchors
  measure.lyrics.anchors = measure.lyrics.anchors.filter(a => !(a.start < end && a.end > start))
  
  measure.lyrics.anchors.push({
    chordId: unusedChord.id,
    start,
    end
  })
  
  pendingSelection.value = null
  window.getSelection()?.removeAllRanges()
  updateConnectors()
}

const handleLyricsDblClick = (event, measure) => {
  if (measure.lyrics?.mode !== 'synced') return
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  
  if (pendingSelection.value && pendingSelection.value.measureIndex === measure.originalMeasureIndex) {
    assignPendingSelection(measure)
  }
}

const handleLyricsMouseUp = (event, measure) => {
  if (measure.lyrics?.mode !== 'synced') return
  
  const container = event.currentTarget
  const { start, end } = getSelectionCharacterOffsetWithin(container)
  
  if (start === end) return
  
  const rawText = measure.lyrics.rawText || ''
  const selectedText = rawText.substring(start, end)
  
  pendingSelection.value = {
    measureIndex: measure.originalMeasureIndex,
    start,
    end,
    text: selectedText
  }
}

const handleSegmentClick = (segment, measure) => {
  if (measure.lyrics?.mode !== 'synced') return
  
  const anchor = segment.anchor || segment
  if (anchor) {
    measure.lyrics.anchors = measure.lyrics.anchors.filter(a => 
      !(a.start === anchor.start && a.end === anchor.end)
    )
    hoveredAnchor.value = null
    updateConnectors()
  }
}

const measureLayoutCache = new WeakMap()

const tokenizeText = (text) => {
  if (!text) return []
  const regex = /(\s+)|([^\s]+(?:\s+|$))/g
  return text.match(regex) || []
}

const distributeTokens = (tokens, P) => {
  const result = Array.from({ length: P }, () => '')
  if (tokens.length === 0) return result
  
  if (tokens.length <= P) {
    tokens.forEach((tok, idx) => {
      result[idx] = tok
    })
    return result
  }
  
  const tokensPerSlot = tokens.length / P
  let tokenIdx = 0
  for (let i = 0; i < P; i++) {
    const nextTokenIdx = Math.round((i + 1) * tokensPerSlot)
    result[i] = tokens.slice(tokenIdx, nextTokenIdx).join('')
    tokenIdx = nextTokenIdx
  }
  return result
}

const getAllMeasureSlots = (measure) => {
  const slots = []
  const mergedBeats = getMergedBeats(measure)
  mergedBeats.forEach((state) => {
    if (state.isMerged) return
    slots.push({
      id: state.beat.id,
      beat: state.beat,
      state,
      isSubdivision: false
    })
  })
  return slots
}

const getMeasureLyricsLayout = (measure) => {
  const rawText = measure.lyrics?.rawText || ''
  const anchors = measure.lyrics?.anchors || []
  const anchorsStr = JSON.stringify(anchors)
  
  if (measureLayoutCache.has(measure)) {
    const cached = measureLayoutCache.get(measure)
    if (cached.rawText === rawText && cached.anchorsStr === anchorsStr) {
      return cached.result
    }
  }
  
  const allSlots = getAllMeasureSlots(measure)
  const slotCount = allSlots.length
  
  const result = {}
  allSlots.forEach(s => {
    result[s.id] = {
      slotId: s.id,
      hasLyrics: false,
      hasAssociated: false,
      preText: '',
      associatedText: '',
      postText: '',
      normalText: '',
      preStart: 0, preEnd: 0,
      assocStart: 0, assocEnd: 0,
      postStart: 0, postEnd: 0,
      normalStart: 0, normalEnd: 0
    }
  })
  
  if (slotCount === 0 || !rawText) {
    measureLayoutCache.set(measure, { rawText, anchorsStr, result })
    return result
  }
  
  const activeAnchors = []
  anchors.forEach(anchor => {
    const slotIdx = allSlots.findIndex(s => s.id === anchor.chordId)
    if (slotIdx !== -1) {
      activeAnchors.push({
        anchor,
        slotIdx,
        start: anchor.start,
        end: anchor.end
      })
    }
  })
  
  activeAnchors.sort((a, b) => a.slotIdx - b.slotIdx)
  
  if (activeAnchors.length === 0) {
    const tokens = tokenizeText(rawText)
    const distributed = distributeTokens(tokens, slotCount)
    
    let currentCharIdx = 0
    allSlots.forEach((s, idx) => {
      const text = distributed[idx] || ''
      result[s.id] = {
        slotId: s.id,
        hasLyrics: text.length > 0,
        hasAssociated: false,
        normalText: text,
        normalStart: currentCharIdx,
        normalEnd: currentCharIdx + text.length
      }
      currentCharIdx += text.length
    })
    
    measureLayoutCache.set(measure, { rawText, anchorsStr, result })
    return result
  }
  
  const K = activeAnchors.length
  
  // Calculate wordStart and wordEnd for each active anchor to preserve full words
  const anchorWords = activeAnchors.map((aa, idx) => {
    let wordStart = aa.start
    const prevEnd = idx > 0 ? activeAnchors[idx - 1].end : 0
    while (wordStart > prevEnd && !/\s/.test(rawText[wordStart - 1])) {
      wordStart--
    }
    
    let wordEnd = aa.end
    const nextStart = idx < K - 1 ? activeAnchors[idx + 1].start : rawText.length
    while (wordEnd < nextStart && !/\s/.test(rawText[wordEnd])) {
      wordEnd++
    }
    
    return {
      wordStart,
      wordEnd,
      prefixStart: wordStart,
      prefixEnd: aa.start,
      suffixStart: aa.end,
      suffixEnd: wordEnd
    }
  })
  
  const distributeRange = (startChar, endChar, targets) => {
    if (startChar >= endChar) return
    const text = rawText.substring(startChar, endChar)
    const tokens = tokenizeText(text)
    const distributed = distributeTokens(tokens, targets.length)
    
    let currentCharIdx = startChar
    targets.forEach((target, idx) => {
      const part = distributed[idx] || ''
      const partLen = part.length
      const start = currentCharIdx
      const end = currentCharIdx + partLen
      currentCharIdx = end
      
      if (partLen === 0) return
      
      const slotRes = result[target.slotId]
      slotRes.hasLyrics = true
      
      if (target.type === 'pre') {
        slotRes.preText = slotRes.preText ? (part + slotRes.preText) : part
        slotRes.preStart = start
        slotRes.preEnd = end + (slotRes.preEnd - slotRes.preStart)
      } else if (target.type === 'post') {
        slotRes.postText = slotRes.postText ? (slotRes.postText + part) : part
        slotRes.postStart = slotRes.postStart || start
        slotRes.postEnd = end
      } else {
        slotRes.normalText = part
        slotRes.normalStart = start
        slotRes.normalEnd = end
      }
    })
  }
  
  // Set up associated anchors with their syllables, prefix, and suffix
  activeAnchors.forEach((aa, idx) => {
    const word = anchorWords[idx]
    const slotRes = result[aa.anchor.chordId]
    slotRes.hasLyrics = true
    slotRes.hasAssociated = true
    slotRes.associatedText = rawText.substring(aa.start, aa.end)
    slotRes.assocStart = aa.start
    slotRes.assocEnd = aa.end
    slotRes.anchor = aa.anchor
    
    // Assign suffix (suffix of full word)
    const suffixText = rawText.substring(word.suffixStart, word.suffixEnd)
    if (suffixText) {
      slotRes.postText = suffixText
      slotRes.postStart = word.suffixStart
      slotRes.postEnd = word.suffixEnd
    }
    
    // Assign prefix (prefix of full word)
    const prefixText = rawText.substring(word.prefixStart, word.prefixEnd)
    if (prefixText) {
      slotRes.preText = prefixText
      slotRes.preStart = word.prefixStart
      slotRes.preEnd = word.prefixEnd
    }
  })
  
  // Region 0: Before the first anchor's word
  // Distribute [0, anchorWords[0].wordStart] across slots 0 ... firstAnchorIdx
  const reg0Targets = []
  const firstAnchorIdx = activeAnchors[0].slotIdx
  for (let i = 0; i < firstAnchorIdx; i++) {
    reg0Targets.push({ slotId: allSlots[i].id, type: 'normal' })
  }
  reg0Targets.push({ slotId: allSlots[firstAnchorIdx].id, type: 'pre' })
  distributeRange(0, anchorWords[0].wordStart, reg0Targets)
  
  // Region k (between anchors' words)
  for (let k = 0; k < K - 1; k++) {
    const curr = activeAnchors[k]
    const next = activeAnchors[k + 1]
    const currWord = anchorWords[k]
    const nextWord = anchorWords[k + 1]
    
    // Distribute [currWord.wordEnd, nextWord.wordStart] across:
    // curr.slotIdx (type 'post'), empty slots between them (type 'normal'), next.slotIdx (type 'pre')
    const regKTargets = []
    regKTargets.push({ slotId: allSlots[curr.slotIdx].id, type: 'post' })
    for (let i = curr.slotIdx + 1; i < next.slotIdx; i++) {
      regKTargets.push({ slotId: allSlots[i].id, type: 'normal' })
    }
    regKTargets.push({ slotId: allSlots[next.slotIdx].id, type: 'pre' })
    distributeRange(currWord.wordEnd, nextWord.wordStart, regKTargets)
  }
  
  // Region K: After the last anchor's word
  // Distribute [lastWord.wordEnd, rawText.length] across:
  // lastAnchor.slotIdx (type 'post'), empty slots after it (type 'normal')
  const last = activeAnchors[K - 1]
  const lastWord = anchorWords[K - 1]
  const regKLastTargets = []
  regKLastTargets.push({ slotId: allSlots[last.slotIdx].id, type: 'post' })
  for (let i = last.slotIdx + 1; i < slotCount; i++) {
    regKLastTargets.push({ slotId: allSlots[i].id, type: 'normal' })
  }
  distributeRange(lastWord.wordEnd, rawText.length, regKLastTargets)
  
  measureLayoutCache.set(measure, { rawText, anchorsStr, result })
  return result
}

const buildSegmentsForTextRange = (text, startCharIdx, baseType, anchor, pending) => {
  if (!text) return []
  const segments = []
  let currentSegment = null
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const idx = startCharIdx + i
    
    let type = baseType
    let currentAnchor = anchor
    
    if (pending && idx >= pending.start && idx < pending.end) {
      type = 'pending'
      currentAnchor = null
    }
    
    if (!currentSegment) {
      currentSegment = { text: char, start: idx, end: idx + 1, type, anchor: currentAnchor }
    } else if (currentSegment.type === type && JSON.stringify(currentSegment.anchor) === JSON.stringify(currentAnchor)) {
      currentSegment.text += char
      currentSegment.end = idx + 1
    } else {
      segments.push(currentSegment)
      currentSegment = { text: char, start: idx, end: idx + 1, type, anchor: currentAnchor }
    }
  }
  if (currentSegment) {
    segments.push(currentSegment)
  }
  return segments
}

const getSlotLayout = (measure, slotId) => {
  const layoutData = getMeasureLyricsLayout(measure)
  const slotRes = layoutData[slotId]
  if (!slotRes || !slotRes.hasLyrics) {
    return { hasLyrics: false, hasAssociated: false, segments: [] }
  }
  
  const pending = pendingSelection.value && pendingSelection.value.measureIndex === measure.originalMeasureIndex ? pendingSelection.value : null
  
  if (slotRes.hasAssociated) {
    const preSegments = buildSegmentsForTextRange(slotRes.preText, slotRes.preStart, 'normal', null, pending)
    const assocSegments = buildSegmentsForTextRange(slotRes.associatedText, slotRes.assocStart, 'associated', slotRes.anchor, pending)
    const postSegments = buildSegmentsForTextRange(slotRes.postText, slotRes.postStart, 'normal', null, pending)
    
    return {
      hasLyrics: true,
      hasAssociated: true,
      pre: preSegments,
      associated: assocSegments[0] || { text: slotRes.associatedText, start: slotRes.assocStart, end: slotRes.assocEnd, type: 'associated', anchor: slotRes.anchor },
      post: postSegments
    }
  } else {
    const normalSegments = buildSegmentsForTextRange(slotRes.normalText, slotRes.normalStart, 'normal', null, pending)
    return {
      hasLyrics: true,
      hasAssociated: false,
      normalSegments
    }
  }
}

const getSlotSegments = (measure, slotId) => {
  const layout = getSlotLayout(measure, slotId)
  if (!layout.hasLyrics) return []
  if (layout.hasAssociated) {
    return [...layout.pre, layout.associated, ...layout.post]
  } else {
    return layout.normalSegments
  }
}

const handleSlotLyricsMouseUp = (event, measure, chordId) => {
  if (measure.lyrics?.mode !== 'synced') return
  
  const container = event.currentTarget
  const { start: localStart, end: localEnd } = getSelectionCharacterOffsetWithin(container)
  
  if (localStart === localEnd) return
  
  const segments = getSlotSegments(measure, chordId)
  const slotStartOffset = segments.length > 0 ? segments[0].start : 0
  
  const start = slotStartOffset + localStart
  const end = slotStartOffset + localEnd
  
  const rawText = measure.lyrics.rawText || ''
  const selectedText = rawText.substring(start, end)
  
  pendingSelection.value = {
    measureIndex: measure.originalMeasureIndex,
    start,
    end,
    text: selectedText
  }
}

const handleSlotLyricsDblClick = (event, measure) => {
  if (measure.lyrics?.mode !== 'synced') return
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  
  if (pendingSelection.value && pendingSelection.value.measureIndex === measure.originalMeasureIndex) {
    assignPendingSelection(measure)
  }
}

watch([showLyricsGlobal, hoveredChordId, hoveredAnchor], () => {
  updateConnectors()
})
watch(systems, () => {
  updateConnectors()
}, { deep: true })

function formatDisplayChord(beat) {
  if (!beat || !beat.root) return '-'
  return formatChord(beat)
}
function splitChordDisplay(beat) {
  const full = formatDisplayChord(beat)
  if (full === '-') return { main: '-', bass: '' }
  const parts = full.split('/')
  return {
    main: parts[0],
    bass: parts[1] ? `/${parts[1]}` : ''
  }
}
const openTransposeModal = () => {
  const activeM = selectedMeasureIndex.value !== -1 ? measuresWithKey.value[selectedMeasureIndex.value] : null
  transposeTargetKey.value = activeM ? activeM.activeKey : key.value
  transposeTargetScale.value = activeM ? activeM.activeScale : scaleType.value
  transposeMode.value = 'tonal'
  transposeScope.value = 'all'
  isTransposeModalOpen.value = true
}
const handleTransposeButtonClick = () => {
  if (currentPlan.value === 'PRO') {
    openTransposeModal()
  } else {
    upgradeReason.value = 'transpose'
    isUpgradeModalOpen.value = true
  }
}
const applyTranspose = () => {
  saveHistory()
  const activeM = selectedMeasureIndex.value !== -1 ? measuresWithKey.value[selectedMeasureIndex.value] : null
  const sourceKey = activeM ? activeM.activeKey : key.value
  const sourceScale = activeM ? activeM.activeScale : scaleType.value
  
  const targetKey = transposeTargetKey.value
  const targetScale = transposeTargetScale.value
  const mode = transposeMode.value
  const scope = transposeScope.value
  
  const sourceIdx = NOTE_TO_INDEX[sourceKey]
  const targetIdx = NOTE_TO_INDEX[targetKey]
  if (sourceIdx === undefined || targetIdx === undefined) return
  const mainDiff = (targetIdx - sourceIdx + 12) % 12
  
  if (scope === 'all') {
    key.value = targetKey
    scaleType.value = targetScale
  }
  
  measures.value.forEach((m, idx) => {
    const mWithKey = measuresWithKey.value[idx]
    const mSourceKey = mWithKey.activeKey
    const mSourceScale = mWithKey.activeScale
    
    const isMInScope = scope === 'all' || (mSourceKey === sourceKey && mSourceScale === sourceScale)
    
    if (isMInScope) {
      m.beats.forEach(b => {
        if (b.root) {
          const transposed = getTransposedChord(b.root, b.type, mSourceKey, mSourceScale, targetKey, targetScale, mode, sourceKey)
          b.root = transposed.root
          b.type = transposed.type
        }
      })
      
      if (m.keyChange) {
        m.keyChange.key = transposeNote(m.keyChange.key, mainDiff, targetKey)
        if (mode !== 'tonal') {
          m.keyChange.scaleType = targetScale
        }
      }
    }
  })
  
  if (scope === 'section') {
    const firstMIdx = measuresWithKey.value.findIndex(m => m.activeKey === sourceKey && m.activeScale === sourceScale)
    if (firstMIdx !== -1) {
      measures.value[firstMIdx].keyChange = {
        key: targetKey,
        scaleType: targetScale
      }
    }
    
    const afterMIdx = measuresWithKey.value.findIndex((m, idx) => idx > firstMIdx && !(m.activeKey === sourceKey && m.activeScale === sourceScale))
    if (afterMIdx !== -1 && !measures.value[afterMIdx].keyChange) {
      measures.value[afterMIdx].keyChange = {
        key: sourceKey,
        scaleType: sourceScale
      }
    }
  }
  
  isTransposeModalOpen.value = false
  syncMeasuresBeats()
}
const exportPdf = () => {
  if (currentPlan.value === 'PRO' && viewMode.value === 'expanded') {
    generatePDF({
      title: title.value,
      key: key.value,
      scaleType: scaleType.value,
      timeSignature: timeSignature.value,
      timeSignatureUnit: timeSignatureUnit.value,
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
      timeSignatureUnit: timeSignatureUnit.value,
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
  <div class="h-[100dvh] w-full flex flex-col bg-[#F5FCE6] text-[#1C1C1E] font-sans antialiased overflow-hidden">
    
    <transition name="fade" mode="out-in">
      
      <!-- ==================== WIZARD (GREEN ACCENT) ==================== -->
      <div v-if="isSetupMode" class="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <div class="max-w-2xl mx-auto w-full pt-12 pb-8 px-4 sm:px-6">
          <div class="flex items-center justify-between mb-8 px-4">
            <div class="flex items-center gap-3">
              <img :src="logoUrl" alt="HarmoniGrid Logo" class="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-250/50" />
              <h1 class="text-[34px] leading-tight font-bold text-black tracking-tight flex items-center gap-2">
                HarmoniGrid
                <span v-if="currentPlan === 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[12px] px-2.5 py-0.5 rounded-full font-black shadow-sm">PRO</span>
              </h1>
            </div>
            
            <!-- Plan Toggle Switch in Wizard -->
            <div class="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/80 shadow-inner">
              <button 
                @click="setPlan('FREE')" 
                :class="currentPlan === 'FREE' ? 'bg-[#8EE000] text-black shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
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
            <div class="bg-white rounded-2xl shadow-sm border border-[#8EE000]/10 overflow-visible">
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Título de la canción</span>
                <input v-model="configTitle" type="text" class="text-[17px] text-right text-[#6CA600] font-semibold focus:outline-none w-1/2 bg-transparent" placeholder="Ej: Mi Canción" />
              </div>
              
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Compases Iniciales</span>
                <div class="flex items-center gap-3">
                  <button @click="configMeasuresCount = Math.max(1, configMeasuresCount - 1)" class="w-8 h-8 rounded-full bg-[#8EE000]/10 text-[#6CA600] flex items-center justify-center active:bg-[#8EE000]/20">-</button>
                  <input 
                    :value="configMeasuresCount" 
                    @input="handleMeasuresInput" 
                    @blur="handleMeasuresBlur" 
                    type="number" 
                    min="1" 
                    class="text-[17px] font-bold w-16 text-center bg-gray-50 border border-gray-200 rounded-lg focus:border-[#8EE000] focus:bg-white focus:outline-none transition-all py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                  <button @click="currentPlan === 'PRO' ? configMeasuresCount++ : (configMeasuresCount >= 20 ? (upgradeReason='limit', isUpgradeModalOpen=true) : configMeasuresCount++)" class="w-8 h-8 rounded-full bg-[#8EE000]/10 text-[#6CA600] flex items-center justify-center active:bg-[#8EE000]/20">+</button>
                </div>
              </div>
              <!-- CUSTOM DROPDOWN: Cifra Indicadora -->
              <div class="relative dropdown-container border-b border-gray-100 z-30">
                <button @click="toggleDropdown('timeSignature')" class="flex items-center justify-between w-full p-4 active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Cifra Indicadora</span>
                  <div class="flex items-center gap-1 text-[#6CA600]">
                    <span class="text-[17px] font-semibold">{{ configTimeSignature }}/{{ configTimeSignatureUnit }}</span>
                    <svg class="w-4 h-4 transition-transform" :class="{'rotate-180': activeDropdown === 'timeSignature'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>
                <transition name="dropdown">
                  <div 
                    v-if="activeDropdown === 'timeSignature'" 
                    class="absolute top-full right-4 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-150 p-2 z-50 flex flex-col gap-1.5 text-left font-sans"
                  >
                    <div v-for="group in METRIC_GROUPS" :key="group.label" class="space-y-1">
                      <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider px-2 pt-1">{{ group.label }}</div>
                      <div class="flex flex-col">
                        <button
                          v-for="item in group.items"
                          :key="item.name"
                          @click="selectWizardTimeSignature(item.beats, item.unit, item.isPro)"
                          class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors w-full"
                          :class="{
                            'text-[#6CA600] bg-[#8EE000]/5 border-l-2 border-l-[#34C759] pl-1.5': configTimeSignature === item.beats && configTimeSignatureUnit === item.unit
                          }"
                        >
                          <div class="flex items-center gap-1.5">
                            <span>{{ item.name }}</span>
                            <span v-if="item.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-black shrink-0">PRO</span>
                          </div>
                          <span v-if="configTimeSignature === item.beats && configTimeSignatureUnit === item.unit" class="text-xs font-black text-[#6CA600]">✓</span>
                        </button>
                      </div>
                    </div>
                    <!-- Custom metric entry (PRO only) -->
                    <div class="border-t border-gray-100 mt-1 pt-1">
                      <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider px-2 pt-1 flex items-center gap-1.5">
                        Personalizada
                        <span class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded font-black">PRO</span>
                      </div>
                      <!-- PRO: editable inputs -->
                      <div v-if="currentPlan === 'PRO'" class="flex items-center gap-1.5 px-2 py-1.5">
                        <input
                          type="number"
                          min="1" max="32"
                          :value="configTimeSignature"
                          @input="configTimeSignature = Math.max(1, parseInt($event.target.value) || 4)"
                          class="w-10 text-center text-sm font-black border border-gray-300 rounded-lg py-1 focus:border-[#8EE000] focus:outline-none"
                          placeholder="Nº"
                        />
                        <span class="text-gray-400 font-black text-lg leading-none">/</span>
                        <select
                          :value="configTimeSignatureUnit"
                          @change="configTimeSignatureUnit = parseInt($event.target.value); activeDropdown = null"
                          class="text-sm font-bold border border-gray-300 rounded-lg py-1 px-1.5 focus:border-[#8EE000] focus:outline-none bg-white"
                        >
                          <option value="2">2</option>
                          <option value="4">4</option>
                          <option value="8">8</option>
                          <option value="16">16</option>
                        </select>
                        <button
                          @click="activeDropdown = null"
                          class="text-[10px] bg-[#8EE000] text-black px-2 py-1 rounded-lg font-black hover:bg-[#7BC200] transition-colors"
                        >✓ OK</button>
                      </div>
                      <!-- FREE: locked state -->
                      <button
                        v-else
                        @click="activeDropdown = null; upgradeReason = 'metrica'; isUpgradeModalOpen = true"
                        class="w-full flex items-center gap-2 px-2 py-2 text-left opacity-60 hover:opacity-80 transition-opacity"
                      >
                        <span class="text-xs text-gray-500 font-bold">🔒 Escribe cualquier métrica</span>
                        <span class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded font-black whitespace-nowrap">Desbloquear PRO</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
            <!-- Bloque 2: Tonalidad -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#8EE000]/10 p-5">
              <span class="block text-[17px] font-semibold text-gray-800 mb-5">Tonalidad Central</span>
              
              <div class="space-y-4">
                <div class="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                  <button v-for="k in keysNatural" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#8EE000] text-black shadow-md shadow-[#8EE000]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-9 h-9 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                  <button v-for="k in keysSharp" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#8EE000] text-black shadow-md shadow-[#8EE000]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-9 h-9 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                  <button v-for="k in keysFlat" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#8EE000] text-black shadow-md shadow-[#8EE000]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-9 h-9 sm:w-11 sm:h-11 rounded-full font-bold text-sm sm:text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
              </div>
              <!-- CUSTOM DROPDOWN: Escala -->
              <div class="mt-6 border-t border-gray-100 pt-2 relative dropdown-container z-20">
                <button @click="toggleDropdown('configScale')" class="flex items-center justify-between w-full p-3 -mx-3 rounded-lg active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Tipo de Escala</span>
                  <div class="flex items-center gap-1 text-[#6CA600]">
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
                        <span v-if="configScale === s.id" class="text-[#6CA600]">✓</span>
                        <span v-else-if="s.isPro && currentPlan !== 'PRO'" class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </div>
          <button @click="startProject" class="w-full mt-8 bg-[#8EE000] active:bg-[#6FA300] text-black font-black text-[18px] py-4 rounded-2xl shadow-lg shadow-[#8EE000]/30 transition-all transform active:scale-[0.98]">
            Crear Partitura
          </button>
        </div>
      </div>
      <!-- ==================== MAIN EDITOR ==================== -->
      <div v-else class="flex-1 flex flex-col h-full bg-[#F5FCE6] relative">
        
        <!-- HEADER -->
        <header class="flex items-center justify-between px-2 sm:px-4 h-16 bg-[#8EE000] border-b border-[#8EE000]/25 z-20 sticky top-0 shadow-sm">
          <div class="flex items-center gap-1.5 sm:gap-3">
            <img :src="logoUrl" alt="HarmoniGrid Logo" class="w-8 h-8 rounded-lg object-cover border border-black/15 shadow-sm cursor-pointer hover:scale-105 transition-transform hidden sm:block" @click="isSetupMode = true" />
            <button @click="isSetupMode = true" class="text-black font-black text-[14px] sm:text-[16px] flex items-center hover:opacity-75 transition-opacity">
              <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-0.5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
              <span class="hidden sm:inline">Atrás</span>
            </button>
          </div>
          
          <div class="flex-1 text-center font-bold text-[14px] sm:text-[18px] text-black truncate px-1 max-w-[100px] sm:max-w-none">
            <input v-model="title" class="bg-transparent text-center focus:outline-none w-full placeholder-gray-800 font-black text-black" />
          </div>
          
          <div class="flex items-center gap-1.5 sm:gap-3">
            <!-- Plan Toggle Switch in Editor Header -->
            <div class="flex items-center bg-black/10 p-0.5 rounded-full border border-black/15 shadow-inner">
              <button 
                @click="setPlan('FREE')" 
                :class="currentPlan === 'FREE' ? 'bg-black text-[#8EE000] shadow-sm font-black' : 'text-gray-800 font-bold hover:text-black'"
                class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] rounded-full transition-all duration-300"
              >
                FREE
              </button>
              <button 
                @click="setPlan('PRO')" 
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-black' : 'text-gray-800 font-bold hover:text-black'"
                class="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] rounded-full transition-all duration-300 flex items-center gap-0.5"
              >
                👑 PRO
              </button>
            </div>
            
            <button @click="exportPdf" class="text-white bg-black hover:bg-gray-900 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-black text-[12px] sm:text-[14px] w-20 sm:w-24 text-center shadow-md shadow-black/10 transition-all">
              Exportar
            </button>
          </div>
        </header>
        <!-- TOOLBAR (Key & Repeats) -->
        <div class="px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap justify-between items-center z-40 gap-3">
          
          <div class="flex flex-wrap items-center gap-2">
            <!-- Custom Main Key Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainKey')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#8EE000] transition-colors">
                {{ key }} <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'mainKey'" class="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-5 gap-1 z-50">
                  <button v-for="k in [...keysNatural, ...keysSharp, ...keysFlat]" :key="k" @click="selectKey(k)" :class="key === k ? 'bg-[#8EE000] text-black' : 'hover:bg-gray-100 text-gray-700'" class="py-2 rounded-lg font-bold text-sm text-center transition-colors">{{k}}</button>
                </div>
              </transition>
            </div>
            <!-- Custom Main Scale Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainScale')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#8EE000] transition-colors">
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
                      <span v-if="scaleType === s.id" class="text-[#6CA600]">✓</span>
                      <span v-else-if="s.isPro && currentPlan !== 'PRO'" class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <!-- Custom Global Groove Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('globalGroove')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1.5 hover:border-[#8EE000] transition-colors">
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
                      :class="globalGroove === g ? 'bg-[#8EE000]/10 text-[#6CA600]' : 'text-gray-700'"
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
                          <span v-if="globalGroove === g" class="text-[#6CA600]">✓</span>
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
                        <div class="text-[#6CA600] font-bold whitespace-pre mt-0.5">{{ GROOVE_DETAILS[g]?.previewLine }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
            
            <!-- Deshacer (Undo) Button -->
            <button 
              @click="undo" 
              :disabled="undoStack.length === 0" 
              class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1.5 hover:border-[#8EE000] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer"
              title="Deshacer última acción"
            >
              <span>↩️</span>
              <span>Deshacer</span>
            </button>
          </div>
          <div class="flex items-center gap-3">
            <!-- Segmented Control for Compact/Expanded mode (PRO only, Promo in FREE) -->
            <div v-if="currentPlan === 'PRO'" class="hidden md:flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 shadow-inner">
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
            
            <div v-else class="hidden md:flex p-0.5 bg-gray-100/50 rounded-lg border border-gray-200 opacity-70 cursor-pointer" @click="upgradeReason = 'feature'; isUpgradeModalOpen = true">
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
                ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#8EE000] text-black border-transparent shadow-sm') 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              {{ isSelectionMode ? 'Seleccionando...' : 'Seleccionar compases' }}
            </button>
            
            <!-- Mobile extra tools dropdown trigger -->
            <div class="relative md:hidden dropdown-container">
              <button 
                @click="toggleDropdown('extraTools')" 
                class="text-[14px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1.5 hover:border-[#8EE000] transition-colors"
              >
                <span>🛠️ Herramientas</span>
                <svg class="w-3.5 h-3.5 text-gray-400 transition-transform" :class="{'rotate-180': activeDropdown === 'extraTools'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'extraTools'" class="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-150 p-3.5 z-50 flex flex-col gap-3.5 text-left font-sans">
                  
                  <!-- Segmented Control for Compact/Expanded mode inside dropdown (PRO only, Promo in FREE) -->
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[10px] text-gray-400 font-black uppercase tracking-wider">Visualización</span>
                    <div v-if="currentPlan === 'PRO'" class="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 shadow-inner">
                      <button 
                        @click="viewMode = 'compact'; activeDropdown = null" 
                        :class="viewMode === 'compact' ? 'bg-white shadow-sm text-gray-800 font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'" 
                        class="flex-1 text-center py-1.5 text-[11px] rounded-md transition-all"
                      >
                        Con Repetir
                      </button>
                      <button 
                        @click="viewMode = 'expanded'; activeDropdown = null" 
                        :class="viewMode === 'expanded' ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'" 
                        class="flex-1 text-center py-1.5 text-[11px] rounded-md transition-all"
                      >
                        Expandido
                      </button>
                    </div>
                    <div v-else class="flex p-0.5 bg-gray-100/50 rounded-lg border border-gray-200 opacity-70 cursor-pointer" @click="activeDropdown = null; upgradeReason = 'feature'; isUpgradeModalOpen = true">
                      <button class="flex-1 text-center py-1.5 text-[11px] text-gray-400 font-bold" disabled>Mostrar repeticiones</button>
                      <button class="flex-1 text-center py-1.5 text-[11px] text-gray-400 font-bold flex items-center justify-center gap-0.5" disabled>
                        Expandir <span class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[7px] px-1 rounded font-black">PRO</span>
                      </button>
                    </div>
                  </div>

                  <div class="border-t border-gray-100 my-0.5"></div>
                  
                  <span class="text-[10px] text-gray-400 font-black uppercase tracking-wider -mb-1">Acciones Estructura</span>

                  <!-- Ver lista de repeticiones inside dropdown -->
                  <button 
                    @click="activeDropdown = null; isRepeatMenuOpen = true" 
                    class="text-left text-[13px] font-bold flex items-center justify-between px-3 py-2 rounded-lg transition-all border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 w-full"
                  >
                    <span class="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Ver lista de repeticiones
                    </span>
                    <span v-if="repeats.length" class="bg-gray-200 text-gray-800 text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-black border border-gray-300">{{ repeats.length }}</span>
                  </button>

                  <!-- Ordenar compases inside dropdown -->
                  <button 
                    @click="activeDropdown = null; currentPlan === 'PRO' ? (isOrderingModeActive = !isOrderingModeActive) : (upgradeReason = 'custom_layout', isUpgradeModalOpen = true)" 
                    class="text-left text-[13px] font-bold flex items-center justify-between px-3 py-2 rounded-lg transition-all border w-full text-gray-750"
                    :class="isOrderingModeActive 
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'"
                  >
                    <span class="flex items-center gap-2">
                      <span>⚙️</span>
                      <span>Ordenar compases</span>
                    </span>
                    <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[7px] px-1.5 py-0.5 rounded font-black">PRO</span>
                  </button>

                  <!-- Transportar inside dropdown -->
                  <button 
                    @click="activeDropdown = null; handleTransposeButtonClick()" 
                    class="text-left text-[13px] font-bold flex items-center justify-between px-3 py-2 rounded-lg transition-all border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 w-full"
                  >
                    <span class="flex items-center gap-2">
                      <span>🔄</span>
                      <span>Transportar</span>
                    </span>
                    <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[7px] px-1.5 py-0.5 rounded font-black">PRO</span>
                  </button>

                </div>
              </transition>
            </div>
            
            <!-- Ver lista de repeticiones -->
            <button 
              @click="isRepeatMenuOpen = true" 
              class="hidden md:flex text-[14px] font-bold items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
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
              class="hidden md:flex text-[14px] font-bold items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              :class="isOrderingModeActive 
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' 
                : 'bg-white hover:bg-gray-50 text-gray-700'"
            >
              <span>⚙️ Ordenar compases</span>
              <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black">PRO</span>
            </button>
            <!-- Transportar -->
            <button 
              @click="handleTransposeButtonClick" 
              class="hidden md:flex text-[14px] font-bold items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              <span>🔄 Transportar</span>
              <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black">PRO</span>
            </button>
          </div>
        </div>
        <!-- SUB-TOOLBAR PROMO/EXPLANATION CAPTION -->
        <div class="px-4 py-1.5 bg-gray-50 border-b border-gray-200/80 text-[12px] text-gray-500 flex items-center gap-1.5 select-none shrink-0">
          <span v-if="currentPlan === 'FREE'" class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-[#8EE000] rounded-full animate-ping"></span>
            <span><strong>FREE:</strong> Usa repeticiones para optimizar tu estructura.</span>
          </span>
          <span v-else class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-violet-500 rounded-full animate-ping"></span>
            <span><strong>PRO:</strong> Expande tu música y visualízala completamente, sin límites ni repeticiones ocultas.</span>
          </span>
        </div>
        <!-- GRID AREA -->
        <main class="flex-1 overflow-y-auto px-2 py-6 md:px-4 md:py-8 relative" @click="closeDropdowns">
          <div class="w-full max-w-[1450px] mx-auto flex flex-col md:flex-row gap-4 md:gap-4 px-1 md:px-2">
            
            <!-- GLOBAL INDICATORS -->
            <div class="flex flex-row md:flex-col items-center pt-2 flex-shrink-0 select-none text-center w-full md:w-auto overflow-x-auto md:overflow-x-visible gap-3 pb-3 md:pb-0 scrollbar-none scroll-smooth">
              <!-- Interactive Key Signature Info Badge (Now above Time Signature) -->
              <button 
                @click="isKeyInfoOpen = true; isVerMasExpanded = false" 
                class="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-[#8EE000] active:scale-[0.97] transition-all w-32 md:w-full h-20 md:h-auto flex-shrink-0 text-center shadow-sm animate-scale-up"
                :class="{'hover:border-violet-500': currentPlan === 'PRO'}"
              >
                <span class="text-[10px] md:text-[11px] font-black text-gray-700 leading-tight uppercase tracking-wider block w-full truncate">
                  {{ translateNoteToSpanish(key) }} {{ currentScaleName }}
                </span>
                <span 
                  :class="keySignatureFormatted === 'Limpia' ? 'text-gray-400 bg-gray-200/80' : (currentPlan === 'PRO' ? 'text-violet-600 bg-violet-50 border border-violet-100/50' : 'text-[#6CA600] bg-[#8EE000]/10 border border-[#8EE000]/20')" 
                  class="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black tracking-wide animate-pulse-subtle flex items-center justify-center gap-0.5 w-max mx-auto"
                >
                  {{ keySignatureFormatted }}
                </span>
              </button>
              <!-- Interactive Global Time Signature Button (Opens Educational / Metric Selection Modal) -->
              <div class="relative w-28 md:w-full flex justify-center mt-0 md:mt-2 select-none z-35 flex-shrink-0">
                <button
                  @click.stop="isMetricInfoModalOpen = true"
                  class="group flex flex-col items-center justify-center p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-[#8EE000] active:scale-[0.97] transition-all w-full h-20 md:h-auto text-center shadow-sm"
                  :class="{'hover:border-violet-500': currentPlan === 'PRO'}"
                >
                  <span class="text-[8px] md:text-[8.5px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5 md:mb-1">Métrica</span>
                  <div class="flex items-center md:flex-col leading-none gap-1 md:gap-0">
                    <div class="text-2xl md:text-4xl font-serif font-black text-gray-850 flex items-center justify-center">
                      <span>{{ timeSignature }}</span>
                    </div>
                    <!-- line separator -->
                    <div class="hidden md:block w-6 h-0.5 bg-gray-400 my-0.5 group-hover:bg-[#8EE000] transition-colors" :class="{'group-hover:bg-violet-500': currentPlan === 'PRO'}"></div>
                    <span class="md:hidden text-gray-400 font-serif text-lg">/</span>
                    <div class="text-2xl md:text-4xl font-serif font-black text-gray-850">{{ timeSignatureUnit }}</div>
                  </div>
                  <span class="text-[7.5px] md:text-[8px] text-gray-400 font-bold mt-0.5 md:mt-1 group-hover:text-gray-600 flex items-center gap-0.5">
                    Ver info ℹ️
                  </span>
                </button>
              </div>
              
              <!-- Global Subdivisions Toggle (visible per-score in sidebar) -->
              <div class="w-32 md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1.5 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Mostrar/ocultar subdivisiones en todos los compases">
                  <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-tight">‖ Sub</span>
                  <div class="relative">
                    <input 
                      type="checkbox" 
                      :checked="globalShowSubdivisions"
                      @change="toggleAllSubdivisions($event)"
                      class="sr-only peer"
                    >
                    <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8EE000]"></div>
                  </div>
                </label>
              </div>

              <!-- Global showObligado (Modo Rítmico / Ritmo Armónico) Toggle -->
              <div class="w-32 md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Modo Rítmico: Los acordes respetarán la duración exacta de las figuras">
                  <div class="flex flex-col text-center md:text-left">
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-none">♩ Ritmo</span>
                    <span class="text-[7.5px] text-gray-400 font-bold leading-none mt-0.5">Armónico</span>
                  </div>
                  <div class="relative">
                    <input 
                      type="checkbox" 
                      :checked="globalShowObligado"
                      @change="toggleGlobalShowObligado($event)"
                      class="sr-only peer"
                    >
                    <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8EE000]"></div>
                  </div>
                </label>
              </div>

              <!-- Global showLyrics Toggle -->
              <div class="w-32 md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Mostrar/ocultar letras y anotaciones en los compases">
                  <div class="flex flex-col text-center md:text-left">
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-none">✎ Letras</span>
                    <span class="text-[7.5px] text-gray-400 font-bold leading-none mt-0.5">Anotaciones</span>
                  </div>
                  <div class="relative">
                    <input 
                      type="checkbox" 
                      v-model="showLyricsGlobal"
                      class="sr-only peer"
                    >
                    <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8EE000]"></div>
                  </div>
                </label>
              </div>
              
              <!-- Suggestions Toggle Button -->
              <div class="w-28 md:w-full mt-0 md:mt-2 flex-shrink-0 animate-scale-up">
                <button
                  @click="isSuggestionsPanelOpen = !isSuggestionsPanelOpen"
                  class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1.5 md:gap-2 px-2 py-2 rounded-xl border w-full h-20 md:h-auto hover:bg-gray-100 transition-colors"
                  :class="isSuggestionsPanelOpen 
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm shadow-amber-100/50' 
                    : 'bg-gray-50/80 border-gray-200 text-gray-500'"
                  title="Mostrar/ocultar panel de sugerencias y asistente de ideas"
                >
                  <span class="text-[9px] font-black uppercase tracking-wider leading-none">💡 Ideas</span>
                  <div class="flex items-center">
                    <span class="w-2.5 h-2.5 rounded-full transition-all" :class="allSuggestionsPool.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-gray-305'"></span>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- MEASURES SYSTEMS GRID -->
            <div class="flex-1 space-y-8 min-w-0 overflow-x-auto md:overflow-x-visible">
              <!-- Asistente de Sugerencias Panel -->
              <transition name="fade">
                <div v-if="isSuggestionsPanelOpen" class="bg-gradient-to-tr from-amber-50/80 to-amber-100/35 backdrop-blur-md border border-amber-250/70 rounded-3xl p-5 shadow-lg shadow-amber-100/10 animate-scale-up space-y-4">
                  <div class="flex items-center justify-between border-b border-amber-200/50 pb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">💡</span>
                      <div>
                        <h3 class="text-xs font-black text-amber-950 uppercase tracking-wider">Asistente de Sugerencias Inteligentes (PRO)</h3>
                        <p class="text-[10px] text-amber-800/80 font-medium">
                          <span v-if="allSuggestionsPool.length > 0">Se detectaron {{ allSuggestionsPool.length }} consejos específicos para tu progresión</span>
                          <span v-else>Plantillas educativas e ideas de progresión listas para usar</span>
                        </p>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <button @click="refreshSuggestions" class="bg-white hover:bg-amber-50 text-amber-800 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-amber-200 shadow-xs flex items-center gap-1 active:scale-[0.97] transition-all">
                        🔄 Refrescar
                      </button>
                      <button @click="isSuggestionsPanelOpen = false" class="text-amber-800 hover:text-amber-950 text-xs font-bold bg-amber-200/40 w-6 h-6 rounded-full flex items-center justify-center">✕</button>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div v-for="(sug, idx) in displayedSuggestions" :key="idx" class="bg-white/80 backdrop-blur-xs border border-amber-200/50 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition-all">
                      <div class="space-y-1.5">
                        <span class="inline-block text-[9px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {{ sug.type === 'rule' ? 'Análisis Progresión' : 'Idea de Progresión' }}
                        </span>
                        <h4 class="text-xs font-bold text-gray-900">{{ sug.title }}</h4>
                        <p class="text-[11px] text-gray-650 leading-relaxed font-medium" v-html="sug.description"></p>
                      </div>
                      
                      <div class="mt-4 pt-3 border-t border-gray-100">
                        <button 
                          @click="runSuggestion(sug)"
                          class="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-[11px] rounded-xl transition-all shadow-xs flex items-center justify-center gap-1"
                        >
                          <span>Aplicar Sugerencia</span>
                          <span v-if="currentPlan !== 'PRO'" class="bg-white/20 text-white text-[8px] px-1 py-0.5 rounded font-black">PRO</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>

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
                    <span class="text-[#6CA600] font-bold">{{ GROOVE_DETAILS[globalGroove]?.previewLine }}</span>
                  </div>
                </div>
                <div class="text-[11px] text-violet-600 font-medium italic hidden md:block pr-1">
                  "{{ GROOVE_DETAILS[globalGroove]?.description }}"
                </div>
              </div>
              <div 
                v-for="(system, sIdx) in systems" 
                :key="system.id"
                :id="'system-row-' + system.id"
                class="flex flex-col gap-y-3 w-full relative system-row"
              >
                <!-- SVG Connectors overlay -->
                <svg 
                  class="absolute inset-0 pointer-events-none w-full h-full z-25 overflow-visible"
                  v-if="currentPlan === 'PRO' && showLyricsGlobal"
                >
                  <path
                    v-for="conn in activeConnectors.filter(c => c.systemId === system.id)"
                    :key="conn.id"
                    :d="conn.path"
                    :stroke="conn.active ? '#8B5CF6' : '#C4B5FD'"
                    :stroke-width="conn.active ? 2.5 : 1.5"
                    :stroke-dasharray="conn.active ? 'none' : '3,3'"
                    fill="none"
                    class="transition-all duration-200"
                    :opacity="conn.active ? 1 : 0.45"
                  />
                </svg>

                <!-- MEASURES ROW -->
                <div 
                  class="system-row gap-x-3 gap-y-10 w-full relative"
                  :class="{ 'z-30': isSystemActive(system), 'z-10': !isSystemActive(system) }"
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
                        {{ translateNoteToSpanish(measure.keyChange.key) }} {{ SCALES[measure.keyChange.scaleType]?.name || measure.keyChange.scaleType }}
                      </span>
                      <span 
                        class="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black tracking-wide"
                        :class="getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) === 'Limpia' ? 'text-gray-400 bg-gray-200/80' : 'text-violet-600 bg-violet-50 border border-violet-100/50'"
                      >
                        {{ getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) }}
                      </span>
                    </button>
                  </div>

                  <!-- Recuadro de nueva métrica local (Between measures, only in PRO, skip first displayed measure) -->
                  <div 
                    v-if="currentPlan === 'PRO' && measure.timeSignature && measure.displayedMeasureIndex > 0 && (measure.timeSignature.beats !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).beats || measure.timeSignature.unit !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).unit)"
                    class="flex flex-col items-center justify-center pt-2 flex-shrink-0 select-none text-center min-w-[64px] md:min-w-[72px] max-w-[90px] h-28 self-center animate-scale-up"
                  >
                    <button 
                      @click.stop="openLocalMetricInfo(measure)"
                      class="flex flex-col items-center p-1.5 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-violet-500 active:scale-[0.97] transition-all w-full text-center shadow-sm animate-pulse-subtle"
                    >
                      <span class="text-[7.5px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Métrica</span>
                      <div class="flex flex-col items-center leading-none">
                        <div class="text-xl md:text-2xl font-serif font-black text-gray-850 flex items-center justify-center">
                          <span>{{ measure.timeSignature.beats }}</span>
                        </div>
                        <div class="w-4 h-0.5 bg-gray-400 my-0.5 transition-colors"></div>
                        <div class="text-xl md:text-2xl font-serif font-black text-gray-850">{{ measure.timeSignature.unit }}</div>
                      </div>
                    </button>
                  </div>

                  <!-- Measure Card -->
                  <div 
                    class="relative bg-white border-2 border-gray-300 rounded-lg flex overflow-visible h-28 shadow-sm transition-all hover:border-[#8EE000] group"
                    :class="{
                      'border-l-[4px] border-l-black': getRepeatStart(measure.originalMeasureIndex), 
                      'border-r-[4px] border-r-black': getRepeatEnd(measure.originalMeasureIndex),
                      'border-[#a78bfa] hover:border-[#8b5cf6]': measure.isExpandedCopy,
                      'border-[#8EE000] bg-[#8EE000]/5': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'FREE',
                      'border-violet-500 bg-violet-50/50 shadow-md shadow-violet-100': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'PRO',
                      'z-40': isRhythmSelectorActiveForMeasure(measure.originalMeasureIndex)
                    }"
                    :style="getMeasureFlexStyle(measure)"
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
                          ? (currentPlan === 'PRO' ? 'bg-violet-500/10 hover:bg-violet-500/20' : 'bg-[#8EE000]/10 hover:bg-[#8EE000]/20')
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
                    <div v-if="measure.sectionLabel" class="absolute top-1.5 left-2 bg-[#8EE000] text-black px-1.5 py-0.5 text-[10px] font-black rounded z-10 shadow-sm uppercase tracking-wider">
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
                    <div v-if="measure.displayedMeasureIndex === 0" class="absolute top-1 right-2 text-[10px] font-black text-[#6CA600]/50">
                      {{ key }}{{ scaleType === 'minor' ? 'm' : '' }}
                    </div>

                    <!-- Harmonic Rhythm Indicators (♪, ♬, ↷, 3, 5) -->
                    <div 
                      v-if="getActiveMeasureRhythms(measure).length > 0" 
                      class="absolute -top-6 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full px-2 py-0.5 shadow-sm text-gray-600 flex items-center gap-1 z-20 text-[9px] font-black"
                      :class="measure.displayedMeasureIndex === 0 ? 'right-12' : (getRepeatEnd(measure.originalMeasureIndex) ? 'right-12' : 'right-2')"
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
                      class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white text-gray-400 hover:text-[#6CA600] hover:border-[#8EE000] border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-xs z-20 shadow-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >⚙️</button>
                    
                    <!-- MEASURE INDEX & PROJECTION BADGE -->
                    <div class="absolute bottom-1 left-2 text-[10px] font-bold text-gray-300 pointer-events-none flex items-center gap-1.5 z-10 select-none">
                      <span>#{{ measure.displayedMeasureIndex + 1 }}</span>
                      <span v-if="measure.isExpandedCopy" class="text-violet-600 font-extrabold bg-violet-50 px-1 rounded-sm border border-violet-100 text-[9px] scale-90 origin-left">
                        Original {{ measure.originalMeasureIndex + 1 }} (Vta. {{ measure.displayPass }})
                      </span>
                      
                      <!-- Auto Subdivision Badge -->
                      <template v-if="measure.showSubdivisions !== false && getMeasureTimeSignature(measure).unit === 8">
                        <!-- Match -->
                        <span 
                          v-if="analyzeMeasureSubdivision(measure).type === 'match'"
                          class="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up"
                          title="Subdivisión detectada automáticamente"
                        >
                          ✔ Sub: {{ analyzeMeasureSubdivision(measure).pattern.join('+') }}
                        </span>
                        <!-- Ambiguous Match -->
                        <span 
                          v-else-if="analyzeMeasureSubdivision(measure).type === 'ambiguous_match'"
                          class="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up cursor-help"
                          :title="'Podría completarse como: ' + analyzeMeasureSubdivision(measure).matchingPatterns.map(p => p.join('+')).join(' o ')"
                        >
                          💡 Podría ser: {{ analyzeMeasureSubdivision(measure).matchingPatterns[0].join('+') }}
                        </span>
                        <!-- Inconsistent -->
                        <span 
                          v-else-if="analyzeMeasureSubdivision(measure).type === 'inconsistent'"
                          class="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up"
                          :title="analyzeMeasureSubdivision(measure).message"
                        >
                          ⚠️ Ritmo irregular
                        </span>
                      </template>

                      <!-- Measure groove override indicator -->
                      <div 
                        v-if="measure.groove && measure.groove !== 'global'"  
                        class="bg-violet-100 text-violet-750 border border-violet-200 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wide pointer-events-auto"
                        title="Anulación de groove en este compás"
                      >
                        {{ measure.groove === 'neutral' ? 'Neutral' : 'Custom' }}
                      </div>
                    </div>
                    
                    <!-- BEATS -->
                    <div class="flex-1 flex z-0 relative ml-4 mr-4">
                      <!-- Center horizontal line -->
                      <div class="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -translate-y-1/2 pointer-events-none z-0"></div>

                      <!-- SVG Overlay for Ties (Ligados) -->
                      <svg 
                        v-if="currentPlan === 'PRO'"
                        class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                        viewBox="0 0 1000 100"
                        preserveAspectRatio="none"
                      >
                        <path 
                          v-for="(path, pIdx) in getMeasureTiesPaths(measure)" 
                          :key="pIdx"
                          :d="path.d"
                          fill="none"
                          stroke="#8EE000"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          class="tie-arc transition-all duration-300"
                        />
                      </svg>
                      
                      <template v-for="state in getMergedBeats(measure)" :key="state.index">
                        <div 
                          v-if="!state.isMerged"
                          class="flex h-full z-10 relative m-0.5 beat-container"
                          :style="{ 
                            flex: currentPlan === 'PRO' ? `${state.durationSlots} ${state.durationSlots} 0%` : getBeatFlexGrow(measure, state.beat, state.index),
                            minWidth: `${getBeatMinWidth(measure, state.beat, state)}px`
                          }"
                          :class="{
                            'bg-violet-600/[0.03] border-y border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).groupIndex % 2 === 0,
                            'bg-indigo-600/[0.03] border-y border-indigo-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).groupIndex % 2 !== 0,
                            'rounded-l-lg border-l border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst,
                            'rounded-r-lg border-r border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isLast,
                            'ml-2.5': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                            'ml-2': currentPlan === 'PRO' && measure.showSubdivisions === false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0
                          }"
                        >
                          <!-- Group separator line -->
                          <div 
                            v-if="currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0"
                            class="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-violet-400/80 -ml-[6px] rounded-full pointer-events-none"
                          ></div>

                          <div 
                            v-if="state.durationSlots > 1" 
                            class="absolute inset-0 flex pointer-events-none z-0 transition-opacity duration-200"
                            :class="measure.showSubdivisions !== false ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'"
                          >
                            <div v-for="n in state.durationSlots - 1" :key="n" class="flex-1 border-r border-gray-400/50"></div>
                            <div class="flex-1"></div>
                          </div>

                          <!-- Normal Beat -->
                          <div
                            v-if="!measure.showObligado || !isSubdividedRhythm(getEffectiveRhythm(measure, state.beat, state.index), getMeasureTimeSignature(measure).unit === 8, state.beat)"
                            @click.stop="clickBeat(measure.originalMeasureIndex, state.index, measure.displayedMeasureIndex)"
                            class="w-full h-full flex flex-col items-center justify-center active:bg-[#8EE000]/10 hover:bg-[#8EE000]/5 relative transition-colors rounded-lg group/beat cursor-pointer"
                          >
                            <!-- Chord name wrapped in white badge for clean margins and readability -->
                            <div 
                              v-if="state.beat.root"
                              :id="'chord-card-' + state.beat.id"
                              @mouseenter="hoveredChordId = state.beat.id"
                              @mouseleave="hoveredChordId = null"
                              class="bg-white/95 border border-gray-200/80 rounded-xl px-3 py-1 shadow-sm z-10 flex flex-col items-center justify-center gap-0.5 group-hover/beat:scale-105 transition-transform animate-scale-up"
                              :class="{ 'border-violet-500 ring-2 ring-violet-100 shadow-md shadow-violet-100': currentPlan === 'PRO' && (hoveredChordId === state.beat.id || (hoveredAnchor && isChordIdRelatedToBeat(hoveredAnchor.chordId, state.beat.id, measure))) }"
                            >
                              <div class="flex flex-col items-center justify-center">
                                <span :class="[getMeasureFontSizeClass(measure), 'text-gray-800 font-black leading-none']">
                                  {{ splitChordDisplay(state.beat).main }}
                                </span>
                                <span v-if="splitChordDisplay(state.beat).bass" class="text-xs text-gray-500 font-bold leading-none mt-0.5">
                                  {{ splitChordDisplay(state.beat).bass }}
                                </span>
                              </div>
                              <!-- Obligado symbol display -->
                              <span 
                                v-if="measure.showObligado" 
                                class="text-xs text-violet-600 font-mono leading-none mt-0.5"
                                title="Obligado Rítmico"
                              >
                                {{ getRhythmDisplayIcon(state.beat.harmonicRhythm || 'auto', measure) }}
                              </span>
                            </div>
                            <!-- Rest Badge / Slash line -->
                            <template v-if="!state.beat.root">
                              <div 
                                v-if="measure.showObligado && state.beat.harmonicRhythm"
                                class="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 shadow-sm z-10 flex flex-col items-center justify-center gap-0.5 opacity-60 hover:scale-105 transition-transform"
                              >
                                <span class="text-gray-400 font-bold leading-none text-[11px]">𝄾</span>
                                <span class="text-[8px] text-gray-400 font-mono leading-none mt-0.5" title="Silencio de ritmo armónico">
                                  {{ getRhythmDisplayIcon(state.beat.harmonicRhythm, measure) }}
                                </span>
                              </div>
                              <div 
                                v-else
                                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-gray-300 transform rotate-12 group-hover/beat:opacity-0"
                              ></div>
                            </template>
                            
                            <!-- Beat override icon -->
                            <span 
                              v-if="hasBeatRhythmOverride(measure, state.beat, state.index)" 
                              class="text-[9px] font-black text-violet-600 absolute top-1 right-2 select-none pointer-events-none transition-opacity duration-200 group-hover/beat:opacity-0"
                              title="Anulación de ritmo en este acorde"
                            >
                              {{ getSubdivisionIcon(state.beat.harmonicRhythm) }}
                            </span>

                            <!-- Tiny Rhythm edit button (only visible when Ritmo Armónico is ON) -->
                            <button 
                              v-if="measure.showObligado"
                              @click.stop="openRhythmSelector(measure.originalMeasureIndex, state.index)"
                              class="absolute top-1 right-1 text-[9px] text-[#6CA600]/50 hover:text-[#6CA600] hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/beat:opacity-100 z-20 w-4 h-4 flex items-center justify-center bg-gray-550 hover:bg-gray-100 rounded border border-gray-200/80 shadow-sm"
                              title="Cambiar figura rítmica"
                            >
                              ✏️
                            </button>

                            <!-- Rhythm Selector Popover for Normal Beat -->
                            <transition name="dropdown">
                              <div 
                                v-if="activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex && activeRhythmSelector.beatIndex === state.index"
                                class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] max-h-[420px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 rhythm-popover-container text-white text-left font-sans cursor-default scrollbar-thin scrollbar-thumb-slate-700"
                                @click.stop
                              >
                                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">Figuras Básicas</div>
                                <div class="grid grid-cols-2 gap-1.5">
                                  <button 
                                    v-for="fig in getAvailableRhythmFigures(measure).filter(f => f.value !== 'sixteenth')" 
                                    :key="fig.value"
                                    @click.stop="selectRhythmFigure(fig.value)"
                                    class="flex flex-col justify-center px-3 py-1.5 rounded-xl border transition-all text-left"
                                    :class="[
                                      getEffectiveRhythm(measure, state.beat, state.index) === fig.value 
                                        ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30' 
                                        : 'text-slate-200 bg-slate-850/50 border border-transparent',
                                      !isFigureValid(fig.value, measure, state.index)
                                        ? 'opacity-40 cursor-not-allowed'
                                        : ''
                                    ]"
                                  >
                                    <div class="flex items-center gap-1.5">
                                      <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(fig.value)"></svg>
                                      <span v-if="fig.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black shrink-0">PRO</span>
                                    </div>
                                    <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ fig.label }}</span>
                                  </button>
                                </div>
                                
                                <div class="border-t border-slate-800/80 my-1"></div>
                                
                                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none flex items-center justify-center gap-1.5">
                                  <span>♬</span> <span>{{ getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? 'Familia de Semicorcheas (2 Notas)' : 'Familia de Semicorcheas' }}</span>
                                  <span v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black uppercase tracking-wide">PRO</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                  <button 
                                    v-for="(pat, key) in (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS)" 
                                    :key="key"
                                    @click.stop="selectSixteenthPatternWrapper(measure, state.beat, key)"
                                    class="w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left"
                                    :class="isPatternActive(measure, state.beat, state.index, key)
                                      ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30' 
                                      : 'text-slate-200 bg-slate-850/30 border border-transparent'"
                                  >
                                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                                      <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key)"></svg>
                                      <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ pat.label }}</span>
                                    </div>
                                    <span v-if="isPatternActive(measure, state.beat, state.index, key)" class="text-[#6CA600] text-xs font-black shrink-0 ml-2">✓</span>
                                  </button>
                                </div>
                              </div>
                            </transition>
                          </div>
                          <!-- Subdivided Beat -->
                          <div 
                            v-else
                            class="w-full h-full flex flex-col border border-gray-200 rounded-lg overflow-visible bg-white relative shadow-sm group/sub-beat"
                          >
                            <!-- SVG Rhythmic Beam Display with Click to Edit Rhythm -->
                            <div 
                              @click.stop="openRhythmSelector(measure.originalMeasureIndex, state.index)"
                              class="h-6 w-full bg-gray-50/70 hover:bg-[#8EE000]/10 border-b border-gray-100 flex items-center justify-center select-none relative group/rhythm transition-colors outline-none cursor-pointer shrink-0"
                              title="Cambiar figura rítmica del pulso"
                            >
                              <svg 
                                class="h-4 text-[#6CA600] transition-all duration-200" 
                                :class="measure.showSubdivisions !== false ? 'w-full' : (getVisibleSlotsForRender(measure, state.beat, state.index).length === 1 ? 'w-16 mx-auto' : 'w-full')"
                                :style="{ opacity: (measure.showSubdivisions === false && state.index > 0) ? 0.65 : 1 }"
                                viewBox="0 0 100 24" 
                                preserveAspectRatio="none"
                              >
                                <!-- eighth -->
                                <template v-if="getEffectiveRhythm(measure, state.beat, state.index) === 'eighth'">
                                  <template v-if="getMeasureTimeSignature(measure).unit === 8 && state.beat.eighthPattern">
                                    <g v-html="getRhythmIconSVG(state.beat.eighthPattern)"></g>
                                  </template>
                                  <template v-else>
                                    <circle cx="25" cy="17" r="2.5" fill="currentColor"/>
                                    <circle cx="75" cy="17" r="2.5" fill="currentColor"/>
                                    <line x1="25" y1="17" x2="25" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                    <line x1="75" y1="17" x2="75" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                    <line x1="25" y1="5" x2="75" y2="5" stroke="currentColor" stroke-width="2.5"/>
                                  </template>
                                </template>
                                <!-- offbeat -->
                                <template v-else-if="getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat'">
                                  <g v-html="getEighthRestSVG(20)"></g>
                                  <circle cx="75" cy="17" r="2.5" fill="currentColor"/>
                                  <line x1="75" y1="17" x2="75" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                  <path d="M 75 5 Q 82 9 80 15" stroke="currentColor" stroke-width="1.5" fill="none"/>
                                </template>
                                <!-- sixteenth -->
                                <template v-else-if="getEffectiveRhythm(measure, state.beat, state.index) === 'sixteenth'">
                                  <g v-html="getRhythmIconSVG(state.beat.sixteenthPattern || '4_semi')"></g>
                                </template>
                                <!-- triplet -->
                                <template v-else-if="getEffectiveRhythm(measure, state.beat, state.index) === 'triplet'">
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
                                <template v-else-if="getEffectiveRhythm(measure, state.beat, state.index) === 'quintuplet'">
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
                              <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#6CA600]/75 group-hover/rhythm:text-[#6CA600] group-hover/rhythm:scale-110 transition-all font-bold">✏️</span>
                              
                              <!-- Rhythm Selector Popover for Subdivided Beat -->
                              <transition name="dropdown">
                                <div 
                                  v-if="activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex && activeRhythmSelector.beatIndex === state.index"
                                  class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] max-h-[420px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 rhythm-popover-container text-white text-left font-sans cursor-default scrollbar-thin scrollbar-thumb-slate-700"
                                  @click.stop
                                >
                                  <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">Figuras Básicas</div>
                                  <div class="grid grid-cols-2 gap-1.5">
                                    <button 
                                      v-for="fig in getAvailableRhythmFigures(measure).filter(f => f.value !== 'sixteenth')" 
                                      :key="fig.value"
                                      @click.stop="selectRhythmFigure(fig.value)"
                                      class="flex flex-col justify-center px-3 py-1.5 rounded-xl border transition-all text-left"
                                      :class="[
                                        getEffectiveRhythm(measure, state.beat, state.index) === fig.value 
                                          ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30' 
                                          : 'text-slate-200 bg-slate-850/50 border border-transparent',
                                        !isFigureValid(fig.value, measure, state.index)
                                          ? 'opacity-40 cursor-not-allowed'
                                          : ''
                                      ]"
                                    >
                                      <div class="flex items-center gap-1.5">
                                        <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(fig.value)"></svg>
                                        <span v-if="fig.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black shrink-0">PRO</span>
                                      </div>
                                      <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ fig.label }}</span>
                                    </button>
                                  </div>
                                  
                                  <div class="border-t border-slate-800/80 my-1"></div>
                                  
                                  <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none flex items-center justify-center gap-1.5">
                                    <span>♬</span> <span>{{ getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? 'Familia de Semicorcheas (2 Notas)' : 'Familia de Semicorcheas' }}</span>
                                    <span v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-black uppercase tracking-wide">PRO</span>
                                  </div>
                                  <div class="flex flex-col gap-1">
                                    <button 
                                      v-for="(pat, key) in (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS)" 
                                      :key="key"
                                      @click.stop="selectSixteenthPatternWrapper(measure, state.beat, key)"
                                      class="w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left"
                                      :class="isPatternActive(measure, state.beat, state.index, key)
                                        ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30' 
                                        : 'text-slate-200 bg-slate-850/30 border border-transparent'"
                                    >
                                      <div class="flex-1 min-w-0 flex flex-col justify-center">
                                        <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key)"></svg>
                                        <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ pat.label }}</span>
                                      </div>
                                      <span v-if="isPatternActive(measure, state.beat, state.index, key)" class="text-[#6CA600] text-xs font-black shrink-0 ml-2">✓</span>
                                    </button>
                                  </div>
                                </div>
                              </transition>
                            </div>
                            <!-- Subdivided Slots -->
                            <div :class="['flex-1 flex', measure.showSubdivisions !== false ? 'divide-x divide-gray-200' : 'divide-x divide-transparent group-hover/sub-beat:divide-gray-200/40 transition-colors duration-200']">
                              <button
                                v-for="sub in getVisibleSlotsForRender(measure, state.beat, state.index)"
                                :key="sub.originalIndex"
                                :disabled="getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0"
                                @click.stop="clickBeat(measure.originalMeasureIndex, state.index, measure.displayedMeasureIndex, sub.originalIndex)"
                                class="h-full flex flex-col items-center justify-center relative transition-colors"
                                :style="{ flexGrow: sub.flexGrow }"
                                :class="[
                                  getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0 
                                    ? (measure.showSubdivisions !== false ? 'bg-gray-105 cursor-not-allowed text-gray-450' : 'bg-transparent cursor-not-allowed text-gray-400') 
                                    : 'active:bg-[#8EE000]/10 hover:bg-[#8EE000]/5 text-gray-800'
                                ]"
                              >
                                <!-- Mini override rhythm indicator over chord -->
                                <span 
                                  v-if="hasBeatRhythmOverride(measure, state.beat, state.index) && !sub.isSilence"
                                  class="text-[9px] font-black text-violet-600 leading-none scale-75 select-none absolute top-1 pointer-events-none"
                                  title="Anulación de ritmo en este acorde"
                                >
                                  {{ getSubdivisionIcon(state.beat.harmonicRhythm) }}
                                </span>
                                <!-- Silence indicator for offbeat (contratiempo) or empty subdivisions -->
                                <div 
                                  v-if="getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0" 
                                  class="flex flex-col items-center justify-center pt-1"
                                >
                                  <span class="text-[9px] font-bold text-gray-400 select-none">𝄾</span>
                                  <span class="text-[7px] font-black text-gray-300 uppercase tracking-tight scale-90 mt-0.5">Silencio</span>
                                </div>
                                <span 
                                  v-else
                                  :class="[
                                    getSubdivisionFontSizeClass(getEffectiveRhythm(measure, state.beat, state.index) === 'sixteenth' ? (4 / sub.flexGrow) : getBeatSlots(measure, state.beat, state.index).length),
                                    'leading-none font-bold text-center mt-2 flex items-center justify-center gap-0.5'
                                  ]"
                                >
                                  <span v-if="!sub.root">𝄾</span>
                                  <span v-else 
                                    :id="'chord-card-' + sub.id"
                                    @mouseenter="hoveredChordId = sub.id"
                                    @mouseleave="hoveredChordId = null"
                                    class="flex flex-col items-center justify-center leading-none px-1 py-0.5 rounded border border-transparent transition-all"
                                    :class="{ 'border-violet-500 bg-violet-50 text-violet-750 font-black shadow-sm ring-1 ring-violet-100': currentPlan === 'PRO' && (hoveredChordId === sub.id || (hoveredAnchor && isChordIdRelatedToBeat(hoveredAnchor.chordId, sub.id, measure))) }"
                                  >
                                    <span>{{ splitChordDisplay(sub).main }}</span>
                                    <span v-if="splitChordDisplay(sub).bass" class="text-[9px] text-gray-500 font-semibold mt-0.5">
                                      {{ splitChordDisplay(sub).bass }}
                                    </span>
                                  </span>
                                  <span 
                                    v-if="sub.isSilence && sub.root" 
                                    class="text-amber-500 text-[11px] animate-pulse cursor-help shrink-0" 
                                    title="Advertencia: Acorde colocado en un silencio rítmico"
                                  >⚠️</span>
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </template>
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
                    <!-- strict mode completion badge -->
                    <div 
                      v-if="measure.showObligado && currentPlan === 'PRO'" 
                      class="absolute bottom-1 right-2 z-20 flex items-center gap-1 select-none"
                    >
                      <span 
                        v-if="getMeasureRemainingBeats(measure) === 0" 
                        class="text-[9px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                        title="Compás completo"
                      >
                        ✔ Completo
                      </span>
                      <span 
                        v-else
                        class="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-100 transition-colors animate-pulse pointer-events-auto"
                        @click.stop="autoCompleteMeasure(measure)"
                        title="Haga clic para completar automáticamente con silencios"
                      >
                        ⚠️ Falta {{ getMeasureRemainingBeats(measure) }} {{ getMeasureTimeSignature(measure).unit === 8 ? 'corchea' : 'negra' }}{{ getMeasureRemainingBeats(measure) !== 1 ? 's' : '' }}
                      </span>
                    </div>

                    <!-- Lyrics indicator icon (visible when showLyricsGlobal is false and measure has lyrics) -->
                    <div 
                      v-if="!showLyricsGlobal && measure.lyrics?.rawText && measure.lyrics.rawText.trim() !== ''"
                      @click.stop="activateLyricsForMeasure(measure.originalMeasureIndex)"
                      class="absolute top-1.5 right-2 text-[10px] bg-violet-100 hover:bg-violet-200 text-violet-700 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer shadow-sm border border-violet-200/50 z-25 transition-all transform hover:scale-105"
                      :class="{ 'mr-10': measure.displayedMeasureIndex === 0 }"
                      title="Ver letra / anotaciones"
                    >
                      💬
                    </div>
                  </div>
                </template>
                
                <!-- ADD MEASURE BUTTON (Hide in Expanded Mode) -->
                <button 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && (currentPlan === 'PRO' || measures.length < 20)"
                  @click="addMeasure"
                  class="h-28 border-2 border-dashed border-gray-300 bg-white/50 rounded-lg text-gray-400 flex items-center justify-center hover:bg-[#8EE000]/5 hover:border-[#8EE000] hover:text-[#6CA600] transition-all group"
                  :style="getAddButtonFlexStyle()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <!-- Promocional de compases cuando se llega al límite en versión FREE -->
                <button 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && currentPlan === 'FREE' && measures.length >= 20"
                  @click="upgradeReason = 'limit'; isUpgradeModalOpen = true"
                  class="h-28 border-2 border-dashed border-violet-300 bg-violet-50/20 rounded-lg text-violet-500 flex flex-col gap-1 items-center justify-center hover:bg-violet-50/50 hover:border-violet-400 hover:text-violet-600 transition-all group px-4 text-center cursor-pointer"
                  :style="getAddButtonFlexStyle()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:scale-110 transition-transform mb-0.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span class="text-xs font-black">20 compases max en FREE</span>
                  <span class="text-[10px] text-violet-600 font-bold">🚀 Pasar a PRO para ilimitados</span>
                </button>
              </div>

              <!-- LYRICS ROW -->
              <div 
                v-if="shouldShowLyricsRow(system)"
                class="flex flex-row w-full items-stretch gap-x-3 mt-1 select-none z-20 transition-all duration-300"
              >
                <template v-for="(measure, mIdx) in system.measures" :key="'lyrics-' + measure.id">
                  <!-- Spacer for key change -->
                  <div 
                    v-if="currentPlan === 'PRO' && measure.keyChange"
                    class="flex-shrink-0 min-w-[96px] md:min-w-[120px] max-w-[140px]"
                  ></div>
                  
                  <!-- Spacer for metric change -->
                  <div 
                    v-if="currentPlan === 'PRO' && measure.timeSignature && measure.displayedMeasureIndex > 0 && (measure.timeSignature.beats !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).beats || measure.timeSignature.unit !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).unit)"
                    class="flex-shrink-0 min-w-[64px] md:min-w-[72px] max-w-[90px]"
                  ></div>
                  
                  <!-- Lyric block column -->
                  <div 
                    :style="getMeasureFlexStyle(measure)"
                    class="relative transition-all duration-200 flex flex-col justify-stretch group"
                    @mouseenter="hoveredMeasureIndex = measure.originalMeasureIndex"
                    @mouseleave="hoveredMeasureIndex = null"
                  >
                    <!-- Mode Selector (Libre vs Sincro) -->
                    <div 
                      v-if="hoveredMeasureIndex === measure.originalMeasureIndex && (showLyricsGlobal || (measure.lyrics && measure.lyrics.rawText && measure.lyrics.rawText.trim() !== ''))"
                      class="absolute -top-6 right-2 flex bg-white/95 backdrop-blur-sm shadow-md rounded-full p-0.5 border border-gray-200 z-30 transition-all text-[10px] font-bold"
                    >
                      <button 
                        @click="measure.lyrics.mode = 'free'"
                        :class="measure.lyrics?.mode !== 'synced' ? 'bg-[#8EE000] text-black px-2 py-0.5 rounded-full shadow-sm' : 'text-gray-500 hover:text-gray-700 px-2 py-0.5'"
                      >
                        Libre
                      </button>
                      <button 
                        @click="currentPlan === 'PRO' ? (measure.lyrics.mode = 'synced') : (upgradeReason = 'synced_lyrics', isUpgradeModalOpen = true)"
                        :class="measure.lyrics?.mode === 'synced' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm' : 'text-gray-500 hover:text-gray-700 px-2 py-0.5 flex items-center gap-0.5'"
                      >
                        Sincro
                        <span v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 rounded-full font-black">PRO</span>
                      </button>
                    </div>

                    <!-- Tooltip and floating Assign Button for pending selection -->
                    <div 
                      v-if="pendingSelection && pendingSelection.measureIndex === measure.originalMeasureIndex"
                      class="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white shadow-xl rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-xs font-bold border border-slate-800 z-45 animate-scale-up whitespace-nowrap cursor-default animate-bounce"
                    >
                      <button 
                        @click.stop="assignPendingSelection(measure)"
                        class="bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs font-black shadow-md shadow-violet-900/20 active:scale-95 animate-scale-up"
                      >
                        <span>➕ Asignar</span>
                        <span v-if="getNextUnusedChord(measure)" class="bg-violet-850 text-[9px] px-1.5 py-0.5 rounded font-black text-violet-100 uppercase tracking-wide">
                          {{ formatDisplayChord(getNextUnusedChord(measure)) }}
                        </span>
                        <span v-else class="text-[9px] text-violet-300 font-normal italic">
                          (Sin acordes libres)
                        </span>
                      </button>
                      
                      <!-- Cancel button -->
                      <button 
                        @click.stop="pendingSelection = null" 
                        class="text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <!-- Edit / View Area (if visible) -->
                    <div 
                      v-if="showLyricsGlobal || (measure.lyrics && measure.lyrics.rawText && measure.lyrics.rawText.trim() !== '') || measure.originalMeasureIndex === activeEditingLyricsIndex"
                      class="w-full h-full min-h-[38px] flex items-stretch bg-white border-y border-gray-300 hover:border-y-gray-400 focus-within:border-y-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition-all overflow-hidden"
                      :class="{
                        'border-l border-gray-300 rounded-l-full hover:border-l-gray-400 focus-within:border-l-violet-500': isFirstOfGroup(system.measures, mIdx),
                        'border-r border-gray-300 rounded-r-full hover:border-r-gray-400 focus-within:border-r-violet-500': isLastOfGroup(system.measures, mIdx),
                        'border-r border-gray-250': !isLastOfGroup(system.measures, mIdx)
                      }"
                    >
                      <!-- MODE: FREE (standard textarea) -->
                      <div 
                        v-if="measure.lyrics?.mode !== 'synced'"
                        class="grid w-full h-full items-stretch"
                      >
                        <!-- Auto-grow hidden span -->
                        <span class="lyric-span select-none invisible col-start-1 row-start-1 whitespace-pre-wrap break-words leading-relaxed text-gray-800 font-sans text-[13px]" style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;">{{ measure.lyrics?.rawText || ' ' }}</span>
                        <!-- Actual Textarea -->
                        <textarea 
                          :id="'lyrics-textarea-' + measure.originalMeasureIndex"
                          v-model="measure.lyrics.rawText"
                          placeholder="Escribe..."
                          class="lyric-textarea col-start-1 row-start-1 w-full h-full resize-none bg-transparent outline-none leading-relaxed text-gray-800 font-sans border-0 shadow-none focus:ring-0 focus:outline-none text-[13px]"
                          style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;"
                          @keydown="handleLyricsKeydown($event, measure.originalMeasureIndex)"
                          @focus="activeEditingLyricsIndex = measure.originalMeasureIndex"
                          @blur="activeEditingLyricsIndex = null"
                        ></textarea>
                      </div>

                      <!-- MODE: SYNCED (interactive renderer matching beats row grid layout) -->
                      <div 
                        v-else
                        class="flex-1 flex flex-row items-stretch select-text cursor-text"
                        style="padding: 0 16px;" 
                      >
                        <template v-for="state in getMergedBeats(measure)" :key="state.index">
                          <div 
                            v-if="!state.isMerged"
                            class="flex h-full z-10 relative m-0.5 pointer-events-none"
                            :style="{ 
                              flex: currentPlan === 'PRO' ? `${state.durationSlots} ${state.durationSlots} 0%` : getBeatFlexGrow(measure, state.beat, state.index),
                              minWidth: `${getBeatMinWidth(measure, state.beat, state)}px`
                            }"
                            :class="{
                              'ml-2.5': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                              'ml-2': currentPlan === 'PRO' && measure.showSubdivisions === false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0
                            }"
                          >
                            <!-- Always render beat slot (never subdivided in lyrics row) -->
                            <div 
                              class="w-full h-full flex flex-col justify-center relative select-text pointer-events-none"
                              @mouseup="handleSlotLyricsMouseUp($event, measure, state.beat.id)"
                              @dblclick="handleSlotLyricsDblClick($event, measure)"
                            >
                              <div 
                                v-for="layout in [getSlotLayout(measure, state.beat.id)]"
                                :key="state.beat.id"
                                class="leading-relaxed text-gray-800 font-sans text-[13px] py-2 whitespace-nowrap overflow-visible select-text w-full"
                                :class="layout.hasLyrics ? 'pointer-events-auto' : 'pointer-events-none'"
                              >
                                <template v-if="!layout.hasLyrics">
                                  <span class="opacity-0 pointer-events-none select-none">.</span>
                                </template>
                                <template v-else-if="layout.hasAssociated">
                                  <div class="flex justify-center w-full relative">
                                    <div class="relative">
                                      <!-- Pre text aligned to the left of the syllable and flows left -->
                                      <div class="absolute right-full top-0 whitespace-nowrap pr-0.5 select-text">
                                        <span
                                          v-for="segment in layout.pre"
                                          :key="segment.start + '-' + segment.end"
                                          class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                          :class="{
                                            'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                            'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                          }"
                                          @click.stop="handleSegmentClick(segment, measure)"
                                        >{{ segment.text }}</span>
                                      </div>

                                      <!-- Centered syllable -->
                                      <span
                                        :id="'lyric-span-' + measure.originalMeasureIndex + '-' + layout.associated.start + '-' + layout.associated.end"
                                        class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                        :class="{
                                          'bg-violet-50 text-violet-750 font-black border border-violet-200 underline decoration-violet-400 decoration-wavy underline-offset-4 cursor-pointer hover:bg-violet-100': true,
                                          'bg-violet-100 ring-2 ring-violet-200': hoveredChordId === layout.associated.anchor.chordId || (hoveredAnchor && hoveredAnchor.chordId === layout.associated.anchor.chordId && hoveredAnchor.start === layout.associated.anchor.start)
                                        }"
                                        @mouseenter="hoveredAnchor = layout.associated.anchor"
                                        @mouseleave="hoveredAnchor = null"
                                        @click.stop="handleSegmentClick(layout.associated, measure)"
                                      >{{ layout.associated.text }}</span>

                                      <!-- Trailing text aligned to the right of the syllable and flows right -->
                                      <div class="absolute left-full top-0 whitespace-nowrap pl-0.5 select-text">
                                        <span
                                          v-for="segment in layout.post"
                                          :key="segment.start + '-' + segment.end"
                                          class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                          :class="{
                                            'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                            'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                          }"
                                          @click.stop="handleSegmentClick(segment, measure)"
                                        >{{ segment.text }}</span>
                                      </div>
                                    </div>
                                  </div>
                                </template>
                                <template v-else>
                                  <span
                                    v-for="segment in layout.normalSegments"
                                    :key="segment.start + '-' + segment.end"
                                    class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                    :class="{
                                      'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                      'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                    }"
                                    @click.stop="handleSegmentClick(segment, measure)"
                                  >{{ segment.text }}</span>
                                </template>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                    
                    <!-- Sutil Hint button (if hidden but hovered) -->
                    <button 
                      v-else-if="hoveredMeasureIndex === measure.originalMeasureIndex"
                      @click.stop="activateLyricsForMeasure(measure.originalMeasureIndex)"
                      class="w-full min-h-[38px] flex items-center justify-center border border-dashed border-gray-300 rounded-full hover:border-[#8EE000] hover:bg-[#8EE000]/5 text-gray-400 hover:text-[#6CA600] transition-all text-xs font-semibold cursor-pointer py-2"
                    >
                      + Letra
                    </button>
                    
                    <!-- Default invisible spacing block to preserve alignment -->
                    <div v-else class="w-full min-h-[38px] opacity-0 pointer-events-none"></div>
                  </div>
                </template>
                
                <!-- Spacer for ADD MEASURE BUTTON -->
                <div 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && (currentPlan === 'PRO' || measures.length < 20)"
                  class="flex-shrink-0"
                  :style="getAddButtonFlexStyle()"
                ></div>
                <!-- Spacer for Promocional button -->
                <div 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && currentPlan === 'FREE' && measures.length >= 20"
                  class="flex-shrink-0"
                  :style="getAddButtonFlexStyle()"
                ></div>
              </div>
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
            :class="currentPlan === 'PRO' ? 'border-violet-200 shadow-violet-100/50' : 'border-[#8EE000]/20 shadow-green-100/50'"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                   :class="currentPlan === 'PRO' ? 'bg-violet-100 text-violet-700' : 'bg-[#8EE000]/10 text-[#6CA600]'">
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
                class="flex-1 sm:flex-initial px-4 py-2 text-[14px] font-bold rounded-xl transition-all shadow-md active:scale-95"
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-200/50' : 'bg-[#8EE000] text-black shadow-[#8EE000]/20'"
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
            <span class="w-2 h-2 bg-[#8EE000] rounded-full animate-ping" :class="{'bg-violet-400': currentPlan === 'PRO'}"></span>
            <span>Haz clic/toca o arrastra sobre los compases para seleccionar un rango</span>
            <button @click="isSelectionMode = false" class="ml-2 text-gray-400 hover:text-white font-black">X</button>
          </div>
        </transition>
        <!-- Times Selector Modal (Inside Editor to align correctly) -->
        <transition name="fade">
          <div v-if="isTimesModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div class="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 text-center animate-scale-up">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md"
                   :class="currentPlan === 'PRO' ? 'bg-violet-100 text-violet-700' : 'bg-[#8EE000]/10 text-[#6CA600]'">
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
                    ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#8EE000] text-black border-transparent shadow-sm')
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
                  :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-200/50' : 'bg-[#8EE000] shadow-[#8EE000]/20'"
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
            <button @click="isRepeatMenuOpen = false" class="text-[#6CA600] text-[17px] font-bold ml-auto relative z-10 bg-[#8EE000]/10 px-3 py-1 rounded-full hover:bg-[#8EE000]/20 transition-colors">Hecho</button>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto">
            <div v-if="repeats.length > 0" class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div v-for="(r, i) in repeats" :key="r.id" class="flex items-center justify-between p-4" :class="{'border-b border-gray-100': i !== repeats.length - 1}">
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[16px] font-semibold text-gray-800">
                      Compás <span class="text-[#6CA600] font-bold">{{ r.startMeasure }}</span> al <span class="text-[#6CA600] font-bold">{{ r.endMeasure }}</span> 
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
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8EE000] text-black text-sm font-bold rounded-xl shadow-md hover:bg-[#7BC200] transition-colors"
              >
                Seleccionar compases
              </button>
            </div>
          </div>
        </div>
        <!-- MEASURE OPTIONS / KEY CHANGE MODAL -->
        <div v-if="isMeasureOptionsOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe z-10 flex flex-col max-h-[90vh]">
          
          <!-- MAIN MENU -->
          <template v-if="!isKeyChangeSubMenuOpen && !isLocalMetricSubMenuOpen">
            <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 rounded-t-[16px] shrink-0">
              <button @click="isMeasureOptionsOpen = false" class="text-gray-500 text-[17px] font-medium">Cancelar</button>
              <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Compás {{ selectedMeasureIndex + 1 }}</h3>
              <button @click="saveMeasureOptions" class="text-[#6CA600] text-[17px] font-bold">Guardar</button>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <!-- Section dropdown -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative dropdown-container">
                <button @click="toggleDropdown('sectionLabel')" class="w-full flex items-center justify-between p-4 active:bg-gray-50 rounded-2xl">
                  <span class="text-[17px] font-semibold text-gray-800">Sección</span>
                  <span class="text-[17px] text-[#6CA600] font-bold flex items-center gap-1">
                    {{ tempSectionLabel }} 
                    <svg class="w-4 h-4" :class="{'rotate-180': activeDropdown === 'sectionLabel'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </button>
                
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'sectionLabel'" class="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 z-40">
                    <button v-for="s in SECTIONS" :key="s" @click="tempSectionLabel = s; activeDropdown = null" class="w-full text-left p-4 border-b border-gray-100 font-semibold text-[16px] hover:bg-[#8EE000]/5" :class="tempSectionLabel === s ? 'text-[#6CA600]' : 'text-gray-700'">{{ s }}</button>
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
                    :class="tempMeasureGroove === 'global' ? 'border-[#8EE000] bg-[#8EE000]/5' : 'border-gray-200'"
                  >
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Usar Groove Global</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Sigue el patrón de la canción: <strong class="text-violet-650">{{ translateGrooveName(globalGroove) }}</strong></span>
                    </div>
                    <div class="w-5 h-5 rounded-full border flex items-center justify-center" :class="tempMeasureGroove === 'global' ? 'border-[#8EE000] bg-[#8EE000]' : 'border-gray-300'">
                      <div v-if="tempMeasureGroove === 'global'" class="w-2.5 h-2.5 rounded-full bg-white"></div>
                    </div>
                  </button>
                  <!-- Neutral -->
                  <button 
                    @click="tempMeasureGroove = 'neutral'"
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left active:scale-98 transition-all hover:bg-gray-550 bg-white"
                    :class="tempMeasureGroove === 'neutral' ? 'border-[#8EE000] bg-[#8EE000]/5' : 'border-gray-200'"
                  >
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Neutral (sin groove)</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Fuerza el compás a su comportamiento neutral (negras normales ♩)</span>
                    </div>
                    <div class="w-5 h-5 rounded-full border flex items-center justify-center" :class="tempMeasureGroove === 'neutral' ? 'border-[#8EE000] bg-[#8EE000]' : 'border-gray-300'">
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

              <!-- Visualización y Educación (Subdivisiones y Obligado) -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
                <span class="block text-xs font-bold text-gray-400 uppercase tracking-wider">🎓 Visualización / Ámbito Educativo</span>
                
                <div class="space-y-4 divide-y divide-gray-150">
                  <!-- Subdivisiones Toggle -->
                  <div class="flex items-center justify-between pt-1">
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Subdivisiones de Compás</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Muestra las líneas de subdivisión (slashes) y agrupa acordes según su duración.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        v-model="tempShowSubdivisions" 
                        class="sr-only peer"
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8EE000]"></div>
                    </label>
                  </div>
                  
                  <!-- Obligado Rítmico Toggle -->
                  <div class="flex items-center justify-between pt-3">
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Obligado Rítmico (Modo Avanzado)</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Muestra figuras musicales asociadas a los acordes para cortes rítmicos.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        v-model="tempShowObligado" 
                        class="sr-only peer"
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8EE000]"></div>
                    </label>
                  </div>

                  <!-- Status under Obligado Rítmico when ON -->
                  <div v-if="tempShowObligado && currentPlan === 'PRO'" class="pt-3 border-t border-gray-150 flex flex-col gap-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-bold text-gray-500">Estado del Compás:</span>
                      <span v-if="getMeasureRemainingBeats(measures[selectedMeasureIndex]) === 0" class="font-black text-green-600">✔ Compás completo</span>
                      <span v-else class="font-black text-amber-600">⚠️ Faltan {{ getMeasureRemainingBeats(measures[selectedMeasureIndex]) }} {{ getMeasureTimeSignature(selectedMeasureIndex).unit === 8 ? 'corcheas' : 'negras' }}</span>
                    </div>
                    <button 
                      v-if="getMeasureRemainingBeats(measures[selectedMeasureIndex]) > 0"
                      @click="autoCompleteMeasure(measures[selectedMeasureIndex])"
                      class="w-full py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-750 active:scale-98 transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      ✨ Completar compás con silencios
                    </button>
                  </div>
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
                <button @click="startLocalMetricSetup" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">⏱️</span>
                    <div>
                      <span class="block text-[16px] font-bold text-gray-800 flex items-center gap-2">
                        Cambiar métrica
                        <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                      </span>
                      <span class="block text-xs text-gray-400 mt-0.5">Redefinir métrica a partir de este compás</span>
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
              <button @click="isKeyChangeSubMenuOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-550 hover:bg-gray-100 px-3 py-1 rounded-full transition-colors">Atrás</button>
              <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Nueva Tonalidad</h3>
              <button @click="saveKeyChange" class="text-violet-650 text-[17px] font-bold">Aplicar</button>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <!-- "Selecciona nueva tonalidad" -->
              <div class="space-y-6">
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
                  
                  <!-- CUSTOM DROPDOWN: Tipo de Escala para Cambio de Tonalidad -->
                  <div class="relative dropdown-container bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
                    <button @click="toggleDropdown('keyChangeScale')" class="w-full flex items-center justify-between p-4 active:bg-gray-50 rounded-2xl text-left">
                      <span class="text-[17px] font-semibold text-gray-800">Tipo de Escala</span>
                      <span class="text-[17px] text-violet-650 font-bold flex items-center gap-1">
                        {{ SCALES[tempKeyChangeScale]?.name || tempKeyChangeScale }}
                        <svg class="w-4 h-4" :class="{'rotate-180': activeDropdown === 'keyChangeScale'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                      </span>
                    </button>
                    
                    <transition name="dropdown">
                      <div v-if="activeDropdown === 'keyChangeScale'" class="absolute bottom-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto mb-2 z-40 p-2 space-y-3 text-left">
                        <div v-for="group in groupedScales" :key="group.label" class="space-y-1">
                          <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1">{{ group.label }}</div>
                          <button v-for="s in group.items" :key="s.id" @click="tempKeyChangeScale = s.id; activeDropdown = null" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 text-[14px] flex justify-between font-medium items-center">
                            <div class="flex flex-col">
                              <span class="text-gray-850 font-bold leading-tight">{{ s.name }}</span>
                              <span class="text-[10px] text-gray-400 font-normal leading-tight mt-0.5">{{ s.characteristic }}</span>
                            </div>
                            <span v-if="tempKeyChangeScale === s.id" class="text-violet-600 font-black">✓</span>
                          </button>
                        </div>
                      </div>
                    </transition>
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
          
          <!-- LOCAL METRIC SETUP SUB-MENU -->
          <template v-else-if="isLocalMetricSubMenuOpen">
            <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 rounded-t-[16px] shrink-0">
              <button @click="isLocalMetricSubMenuOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-full transition-colors">Atrás</button>
              <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Métrica Local</h3>
              <button @click="saveLocalTimeSignature" class="text-violet-650 text-[17px] font-bold">Aplicar</button>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 class="text-base font-extrabold text-gray-800">Selecciona la métrica para este compás</h4>
                <p class="text-xs text-gray-500 mt-1 font-medium">Afectará a este compás y a los siguientes en el timeline hasta encontrar otro cambio de métrica.</p>
              </div>

              <!-- Metric selection options -->
              <div class="space-y-4">
                <div v-for="group in METRIC_GROUPS" :key="group.label" class="space-y-2">
                  <div class="text-[10px] font-black text-gray-400 uppercase tracking-wider">{{ group.label }}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <button 
                      v-for="item in group.items"
                      :key="item.name"
                      @click="selectLocalMetricItem(item.beats, item.unit)"
                      class="flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all active:scale-95 text-[14px] font-bold"
                      :class="localMetricBeats === item.beats && localMetricUnit === item.unit 
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'"
                    >
                      <div class="flex items-center gap-1">
                        <span>{{ item.name }}</span>
                        <span v-if="item.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-black shrink-0">PRO</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Métrica Personalizada (PRO) -->
              <div class="pt-4 border-t border-gray-200 space-y-3">
                <h5 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Métrica Personalizada (PRO)</h5>
                <div class="flex items-center gap-3">
                  <div class="flex-1">
                    <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Numerador</label>
                    <input 
                      type="number" 
                      v-model.number="localMetricBeats" 
                      @change="onLocalMetricCustomChange" 
                      min="2" 
                      max="16" 
                      class="w-full px-3 py-2 border border-gray-200 rounded-xl text-center text-sm font-bold text-gray-800 focus:outline-none focus:border-violet-500 bg-white"
                    />
                  </div>
                  <span class="text-xl font-black text-gray-400 self-end mb-1">/</span>
                  <div class="flex-1">
                    <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Denominador</label>
                    <select 
                      v-model.number="localMetricUnit" 
                      @change="onLocalMetricCustomChange" 
                      class="w-full px-3 py-2 border border-gray-200 rounded-xl text-center text-sm font-bold text-gray-800 focus:outline-none focus:border-violet-500 bg-white"
                    >
                      <option :value="4">4 (Negra)</option>
                      <option :value="8">8 (Corchea)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Advanced metric groupings selection -->
              <div v-if="isAdvancedLocalMetric" class="space-y-3 pt-4 border-t border-gray-200">
                <h5 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Agrupamiento de Pulsos (Subdivisión)</h5>
                <p class="text-[11px] text-gray-555">Elige cómo se agruparán visualmente los {{ localMetricBeats }} pulsos en este compás:</p>
                
                <div class="grid grid-cols-2 gap-2" v-if="getMetricGroupingPresets(localMetricBeats, localMetricUnit).length > 0">
                  <button
                    v-for="preset in getMetricGroupingPresets(localMetricBeats, localMetricUnit)"
                    :key="preset.join('+')"
                    @click="localMetricGrouping = preset; tempLocalGroupingStr = preset.join('+')"
                    class="py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition-all active:scale-95"
                    :class="localMetricGrouping && localMetricGrouping.join('+') === preset.join('+')
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200'
                      : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50 bg-white'"
                  >
                    {{ preset.join(' + ') }}
                  </button>
                </div>

                <!-- Custom grouping input -->
                <div class="mt-3">
                  <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Subdivisión Personalizada (ej: 5+3+3)</label>
                  <input 
                    type="text" 
                    :value="tempLocalGroupingStr"
                    @input="handleLocalGroupingInput"
                    placeholder="Ej: 2+3 o 3+2+2" 
                    class="w-full px-3 py-2 border rounded-xl text-sm font-bold text-gray-800 focus:outline-none"
                    :class="parseGroupingString(tempLocalGroupingStr, localMetricBeats) 
                      ? 'border-gray-200 focus:border-violet-500 bg-white' 
                      : 'border-red-300 focus:border-red-500 bg-red-50/30'"
                  />
                  <p class="text-[10px] mt-1 font-medium" :class="parseGroupingString(tempLocalGroupingStr, localMetricBeats) ? 'text-gray-400' : 'text-red-500'">
                    {{ parseGroupingString(tempLocalGroupingStr, localMetricBeats) 
                      ? 'La suma de las subdivisiones debe ser igual a ' + localMetricBeats 
                      : 'Inválido: la suma debe ser ' + localMetricBeats + ' (ej: 5+3+3)' }}
                  </p>
                </div>
              </div>

              <!-- Remove local time signature override if present -->
              <div v-if="measures[selectedMeasureIndex] && measures[selectedMeasureIndex].timeSignature" class="pt-4 border-t border-gray-200">
                <button 
                  @click="removeLocalTimeSignature"
                  class="w-full py-3 bg-red-50 text-red-650 font-extrabold rounded-xl border border-red-100 hover:bg-red-100 transition-colors active:scale-98"
                >
                  Eliminar métrica local (Heredar anterior/global)
                </button>
              </div>
            </div>
          </template>
          
        </div>
        <!-- CHORD SELECTION MODAL (Unified Chord Editor) -->
        <div v-if="isModalOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe flex flex-col max-h-[90vh] z-10 md:w-[600px] md:mx-auto md:rounded-3xl md:mb-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shrink-0 rounded-t-[16px] md:rounded-t-3xl shadow-sm">
            <button @click="isModalOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">Cerrar</button>
            <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none flex flex-col items-center">
              <span>{{ translateNoteToSpanish(activeModalKeyAndScale.key) }} {{ SCALES[activeModalKeyAndScale.scale]?.name || activeModalKeyAndScale.scale }}</span>
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
              <div class="absolute right-0 top-0 opacity-5 pointer-events-none font-black text-7xl select-none uppercase tracking-widest text-[#6CA600]">
                {{ activeChordExtensions ? activeChordExtensions.degree : '' }}
              </div>
              
              <span class="text-[11px] text-[#6CA600] font-black uppercase tracking-widest mb-1">
                {{ activeChordExtensions?.degree ? `${activeChordExtensions.degree} Grado` : 'Acorde Personalizado' }}
              </span>
              
              <span class="text-4xl font-black text-gray-800 tracking-tight mb-1">
                {{ formatDisplayChord(activeEditingBeat) }}
              </span>
              
              <span class="text-xs text-gray-400 font-bold" :class="{ 'mb-3': selectedBeat && selectedBeat.subdivisionIndex !== undefined && isSubdivisionCollapsed(measures[selectedBeat.measureIndex], measures[selectedBeat.measureIndex].beats[selectedBeat.beatIndex], selectedBeat.beatIndex) }">
                {{ activeEditingBeat.root }} {{ activeEditingBeat.type === 'maj' ? 'Mayor' : (activeEditingBeat.type === 'min' ? 'Menor' : activeEditingBeat.type) }}
              </span>
              
              <div 
                v-if="selectedBeat && selectedBeat.subdivisionIndex !== undefined && isSubdivisionCollapsed(measures[selectedBeat.measureIndex], measures[selectedBeat.measureIndex].beats[selectedBeat.beatIndex], selectedBeat.beatIndex)" 
                class="mt-2 pt-3 border-t border-gray-100 flex items-center gap-2.5 w-full justify-center"
              >
                <input 
                  type="checkbox" 
                  id="applyAllSub" 
                  v-model="applyToAllSubslots" 
                  class="rounded border-gray-300 text-violet-600 focus:ring-violet-500 w-4.5 h-4.5 cursor-pointer" 
                />
                <label for="applyAllSub" class="text-[11px] font-bold text-gray-600 cursor-pointer select-none leading-tight">
                  Aplicar cambio a todo el pulso (fusión activa)
                </label>
              </div>
            </div>
            
            <!-- EDUCATIONAL WARNING FOR CHORDS ON SILENCE SLOTS -->
            <div v-if="activeEditingBeat && activeEditingBeat.isSilence && activeEditingBeat.root" class="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
              <span class="text-xl shrink-0">⚠️</span>
              <div class="space-y-1">
                <h5 class="text-xs font-black text-amber-800 uppercase tracking-wider">Advertencia Educativa</h5>
                <p class="text-xs text-amber-700 leading-relaxed">
                  Has colocado un acorde en un <strong>silencio rítmico</strong>. 
                  En la teoría y práctica musical, los acordes se asocian a las figuras y tiempos activos (notas), no a los silencios.
                  Puedes cambiar la figura rítmica de este pulso en la sección "Ritmo Armónico" más abajo para seleccionar un patrón compatible que tenga una nota en este tiempo.
                </p>
              </div>
            </div>
            
            <!-- 2. BASS NOTE SELECTOR (SLASH CHORDS) -->
            <div v-if="currentPlan === 'PRO' && activeEditingBeat && activeEditingBeat.root && wasBeatAlreadySet" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-1.5">
                  <span>🎹</span> <span>Bajo Alternativo</span>
                </h4>
                <span v-if="activeEditingBeat.bass" class="text-xs text-[#6CA600] font-bold">
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
                      :class="!activeEditingBeat.bass ? 'bg-[#8EE000] text-black border-transparent' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                      class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors"
                    >
                      {{ translateNoteToSpanish(activeEditingBeat.root) }} (Fund.)
                    </button>
                    <button 
                      v-for="note in getScaleNotes(key, scaleType).filter(n => n !== activeEditingBeat.root)" 
                      :key="note"
                      @click="selectBassNote(note)"
                      :class="activeEditingBeat.bass === note ? 'bg-[#8EE000] text-black border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                      class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all"
                    >
                      /{{ translateNoteToSpanish(note) }}
                    </button>
                  </div>
                </div>
                
                <div class="pt-1.5">
                  <details class="group">
                    <summary class="list-none text-xs text-[#6CA600] font-black cursor-pointer hover:underline flex items-center gap-1">
                      <span>+ Ver todas las notas cromáticas</span>
                      <svg class="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div class="flex flex-wrap gap-1.5 mt-2 p-2 bg-gray-50 rounded-xl">
                      <button 
                        v-for="note in (keySignatureFormatted.includes('♭') ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']).filter(n => !getScaleNotes(key, scaleType).includes(n) && n !== activeEditingBeat.root)"
                        :key="note"
                        @click="selectBassNote(note)"
                        :class="activeEditingBeat.bass === note ? 'bg-[#8EE000] text-black border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
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
                      ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#8EE000] text-black border-transparent shadow-sm')
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
                    <span v-else class="text-[9px] bg-[#8EE000]/10 text-[#6CA600] px-1.5 py-0.5 rounded font-black uppercase">Recomendada</span>
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
            
            <!-- LIGADO DE TIEMPO (TIE CONTROL - PRO FEATURE) -->
            <div v-if="currentPlan === 'PRO' && activeEditingBeat && activeEditingBeat.root && canTieActiveSlot()" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-2">
                  <span>🔗</span> <span>Ligado de Tiempo</span>
                </h4>
                <span class="text-[9px] bg-violet-100 text-violet-750 font-black px-1.5 py-0.5 rounded uppercase tracking-wide">PRO</span>
              </div>
              
              <p class="text-xs text-gray-500 leading-relaxed text-left">
                Liga este acorde con la siguiente figura del compás (o del siguiente compás) para extender su duración. El acorde no volverá a atacarse.
              </p>
              
              <button 
                @click="toggleTieActiveSlot"
                class="w-full py-2.5 px-4 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                :class="isNextSlotTied() 
                  ? 'bg-red-500 hover:bg-red-650 text-white shadow-red-100' 
                  : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-100'"
              >
                <span>{{ isNextSlotTied() ? '🔗 Quitar Ligado' : '🔗 Ligar con Siguiente' }}</span>
              </button>
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
                    v-if="getMeasureTimeSignature(selectedBeat.measureIndex).unit !== 8"
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

                <!-- Sixteenth pattern sub-selector -->
                <div v-if="activeEditingBeat.harmonicRhythm === 'sixteenth'" class="mt-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100 space-y-2 text-left">
                  <span class="block text-[11px] font-black text-violet-750 uppercase tracking-wider">Patrón de la Familia de Semicorcheas</span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button 
                      v-for="(pat, key) in SIXTEENTH_PATTERNS" 
                      :key="key"
                      @click="selectSixteenthPatternInModal(pat, key)"
                      class="px-3 py-2 rounded-xl border transition-all text-left flex items-center justify-between"
                      :class="activeEditingBeat.sixteenthPattern === key || (!activeEditingBeat.sixteenthPattern && key === '4_semi')
                        ? 'bg-violet-600 border-violet-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 border-gray-200'"
                    >
                      <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <svg class="h-4 w-12 text-current shrink-0 select-none mb-0.5" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key)"></svg>
                        <span class="text-[9px] font-bold truncate block mt-0.5 select-none"
                              :class="activeEditingBeat.sixteenthPattern === key || (!activeEditingBeat.sixteenthPattern && key === '4_semi') ? 'text-white/70' : 'text-gray-400'">
                          {{ pat.label }}
                        </span>
                      </div>
                      <span v-if="activeEditingBeat.sixteenthPattern === key || (!activeEditingBeat.sixteenthPattern && key === '4_semi')" class="text-white text-xs font-black shrink-0 ml-2">✓</span>
                    </button>
                  </div>
                </div>

                <!-- Eighth pattern sub-selector -->
                <div v-if="activeEditingBeat.harmonicRhythm === 'eighth'" class="mt-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100 space-y-2 text-left">
                  <span class="block text-[11px] font-black text-violet-750 uppercase tracking-wider">Patrón de la Familia de Semicorcheas (2 Notas)</span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button 
                      v-for="(pat, key) in EIGHTH_PATTERNS" 
                      :key="key"
                      @click="selectEighthPatternInModal(pat, key)"
                      class="px-3 py-2 rounded-xl border transition-all text-left flex items-center justify-between"
                      :class="activeEditingBeat.eighthPattern === key || (!activeEditingBeat.eighthPattern && key === '2_notes' && getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit !== 8)
                        ? 'bg-violet-600 border-violet-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-550 border-gray-200'"
                    >
                      <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <svg class="h-4 w-12 text-current shrink-0 select-none mb-0.5" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key)"></svg>
                        <span class="text-[9px] font-bold truncate block mt-0.5 select-none"
                              :class="activeEditingBeat.eighthPattern === key || (!activeEditingBeat.eighthPattern && key === '2_notes' && getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit !== 8) ? 'text-white/70' : 'text-gray-400'">
                          {{ pat.label }}
                        </span>
                      </div>
                      <span v-if="activeEditingBeat.eighthPattern === key || (!activeEditingBeat.eighthPattern && key === '2_notes' && getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit !== 8)" class="text-white text-xs font-black shrink-0 ml-2">✓</span>
                    </button>
                  </div>
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
            
            <!-- 3.5. SECONDARY ALTERNATIVES GRID -->
            <div v-if="activeModalNextChord && secondaryAlternativeChords.length > 0" class="space-y-3 pt-4 border-t border-gray-200">
              <div class="flex items-center justify-between">
                <span class="block text-[11px] font-black text-violet-700 uppercase tracking-wider flex items-center gap-1 select-none">
                  <span>✨ Alternativas Secundarias (Hacia {{ formatDisplayChord(activeModalNextChord.chord) }})</span>
                  <span v-if="currentPlan !== 'PRO'" class="text-[9px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.2 rounded-full font-black shadow-sm shrink-0 ml-1">👑 PRO</span>
                </span>
                <span class="text-[10px] text-gray-400 font-bold">
                  {{ activeModalNextChord.distance === 99 ? 'Sig. compás' : `A ${activeModalNextChord.distance} pulso${activeModalNextChord.distance !== 1 ? 's' : ''}` }}
                </span>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  v-for="alt in secondaryAlternativeChords" 
                  :key="alt.root + alt.type"
                  @click="currentPlan === 'PRO' ? selectChord({ root: alt.root, type: alt.type }) : (isModalOpen = false, upgradeReason = 'alternativas_secundarias', isUpgradeModalOpen = true)"
                  :class="[
                    alt.isExotic 
                      ? (alt.styleType === 'gold' 
                          ? 'bg-gradient-to-br from-amber-50/60 via-amber-50/10 to-orange-50/30 border-amber-200 hover:border-amber-300 shadow-sm active:scale-98' 
                          : alt.styleType === 'indigo'
                            ? 'bg-gradient-to-br from-indigo-50/60 via-indigo-50/10 to-fuchsia-50/30 border-indigo-200 hover:border-indigo-300 shadow-sm active:scale-98'
                            : 'bg-gradient-to-br from-teal-50/60 via-teal-50/10 to-emerald-50/30 border-teal-200 hover:border-teal-300 shadow-sm active:scale-98')
                      : 'bg-white border border-violet-100 hover:border-violet-300 active:scale-98 shadow-sm',
                    'rounded-2xl p-3.5 text-left transition-all flex items-start gap-3.5 group'
                  ]"
                >
                  <!-- Left side: Chord Bubble + PRO Badge below -->
                  <div class="flex flex-col items-center gap-1.5 shrink-0 select-none">
                    <span 
                      :class="[
                        alt.isExotic 
                          ? (alt.styleType === 'gold' 
                              ? 'text-amber-800 bg-amber-50/80 border-amber-200 group-hover:bg-amber-100 group-hover:text-amber-900 shadow-inner' 
                              : alt.styleType === 'indigo'
                                ? 'text-indigo-800 bg-indigo-50/80 border-indigo-200 group-hover:bg-indigo-100 group-hover:text-indigo-900 shadow-inner'
                                : 'text-teal-800 bg-teal-50/80 border-teal-200 group-hover:bg-teal-100 group-hover:text-teal-900 shadow-inner')
                          : 'text-violet-700 bg-violet-50 border border-violet-100 shadow-inner group-hover:bg-violet-100/50 group-hover:text-violet-800',
                        'font-extrabold text-[11px] sm:text-xs rounded-xl px-2 py-1.5 min-w-[62px] min-h-[34px] flex items-center justify-center transition-colors text-center leading-none'
                      ]"
                    >
                      {{ alt.label }}
                    </span>
                    <span 
                      v-if="currentPlan !== 'PRO'" 
                      :class="[
                        alt.isExotic
                          ? (alt.styleType === 'gold'
                              ? 'text-amber-700 bg-amber-100/80 border-amber-200'
                              : alt.styleType === 'indigo'
                                ? 'text-indigo-700 bg-indigo-100/80 border-indigo-200'
                                : 'text-teal-700 bg-teal-100/80 border-teal-200')
                          : 'text-violet-750 bg-violet-100 border border-violet-250',
                        'text-[7.5px] px-1 py-0.5 rounded-md font-black uppercase tracking-tight flex items-center gap-0.5'
                      ]"
                    >
                      🔒 PRO
                    </span>
                  </div>
                  
                  <!-- Right side: Details -->
                  <div class="flex-1 min-w-0">
                    <div class="font-black text-xs text-gray-800 flex items-center justify-between gap-1.5 flex-wrap">
                      <span>{{ alt.degree }}</span>
                      <span 
                        :class="[
                          alt.isExotic
                            ? (alt.styleType === 'gold'
                                ? 'text-amber-700 bg-amber-50/80 border-amber-100'
                                : alt.styleType === 'indigo'
                                  ? 'text-indigo-700 bg-indigo-50/80 border-indigo-100'
                                  : 'text-teal-700 bg-teal-50/80 border-teal-100')
                            : 'text-violet-600 bg-violet-50 border border-violet-100/55',
                          'text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 select-none'
                        ]"
                      >
                        {{ alt.category }}
                      </span>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1 leading-normal font-medium select-none">{{ alt.description }}</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- 4. DIATONIC CHORDS GRID (To change the core root/type) -->
            <div class="space-y-3 pt-4 border-t border-gray-200">
              <span class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Cambiar acorde base (Grados Diatónicos)
              </span>
              
              <div class="flex p-1 bg-gray-200/80 rounded-xl mb-4 max-w-sm mx-auto shadow-inner">
                <button @click="modalComplexity = 'triad'" :class="modalComplexity === 'triad' ? 'bg-white shadow-sm text-[#6CA600] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tríadas</button>
                <button @click="modalComplexity = 'tetrad'" :class="modalComplexity === 'tetrad' ? 'bg-white shadow-sm text-[#6CA600] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tétradas</button>
              </div>
              
              <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <button 
                  v-for="chord in diatonicChords" 
                  :key="chord.degreeNumeral"
                  @click="selectChord(chord)"
                  class="bg-white border border-gray-100 rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm active:scale-95 active:bg-[#8EE000]/5 transition-all group"
                >
                  <span class="text-[11px] text-gray-400 font-bold mb-0.5 uppercase tracking-widest group-active:text-[#6CA600]/50">{{ chord.degreeNumeral }}</span>
                  <span class="text-lg font-black text-gray-800 group-active:text-[#6CA600]">{{ chord.label }}</span>
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
              <span class="text-xs text-[#6CA600] font-bold mt-0.5">Sistema {{ activeSystemIndex + 1 }} (Compases {{ activeSystemIndex * 4 + 1 }} - {{ (activeSystemIndex + 1) * 4 }})</span>
            </h3>
            <div class="w-16"></div>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto space-y-6">
            <div v-for="cat in [
              { key: 'enrich', label: '1. Enriquecer acordes', badgeClass: 'bg-emerald-100 text-emerald-700' },
              { key: 'movement', label: '2. Agregar movimiento', badgeClass: 'bg-amber-100 text-amber-700' },
              { key: 'color', label: '3. Color / Estilo', badgeClass: 'bg-blue-100 text-blue-700' },
              { key: 'voice_leading', label: '4. Voice Leading', badgeClass: 'bg-rose-100 text-rose-700' },
              { key: 'modulation', label: '5. Modulación / Tonalidad', badgeClass: 'bg-violet-100 text-violet-700' }
            ]" :key="cat.key">
              <div v-if="getSuggestionsByCategory(cat.key).length > 0" class="space-y-3">
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                  {{ cat.label }}
                </h4>
                
                <div v-for="suggestion in getSuggestionsByCategory(cat.key)" :key="suggestion.id" class="bg-white rounded-3xl p-5 shadow-sm border border-gray-150/60 space-y-4 relative overflow-hidden transition-all hover:shadow-md hover:border-gray-300">
                  <!-- Header: Category & Plan Badge -->
                  <div class="flex items-center justify-between">
                    <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-600" :class="cat.badgeClass">
                      {{ suggestion.metadata?.categoryLabel || cat.label.substring(3) }}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <span v-if="suggestion.metadata?.tension" class="text-[9px] bg-slate-900 text-slate-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        ⚡ {{ suggestion.metadata.tension }}
                      </span>
                      <span v-if="currentPlan !== 'PRO'" class="text-[9.5px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-0.5 rounded-full font-black shadow-sm flex items-center gap-0.5">👑 PRO</span>
                    </div>
                  </div>
                  
                  <!-- Title and Concept Name -->
                  <div>
                    <h5 class="text-base font-black text-gray-900 leading-tight">{{ suggestion.title }}</h5>
                    <div v-if="suggestion.metadata" class="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span class="text-xs text-gray-400 font-bold">Concepto:</span>
                      <span class="text-xs bg-violet-50 text-violet-750 px-2.5 py-0.5 rounded-lg font-black border border-violet-100/50">
                        {{ suggestion.metadata.name }}
                      </span>
                      <span v-if="suggestion.metadata.function" class="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg font-black border border-emerald-100/50">
                        {{ suggestion.metadata.function }}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Educational Metadata Fields (Grid) -->
                  <div v-if="suggestion.metadata" class="grid grid-cols-2 gap-2.5 text-xs bg-gray-50/50 p-3 rounded-2xl border border-gray-150/40">
                    <div>
                      <span class="text-[9.5px] text-gray-400 font-bold uppercase block">Origen</span>
                      <span class="font-bold text-gray-800">{{ suggestion.metadata.origin }}</span>
                    </div>
                    <div>
                      <span class="text-[9.5px] text-gray-400 font-bold uppercase block">Modo Asociado</span>
                      <span class="font-bold text-gray-800">{{ suggestion.metadata.mode || '-' }}</span>
                    </div>
                    <div class="col-span-2">
                      <span class="text-[9.5px] text-gray-400 font-bold uppercase block">Destino</span>
                      <span class="font-bold text-gray-800">{{ suggestion.metadata.target || '-' }}</span>
                    </div>
                    <div class="col-span-2 mt-0.5">
                      <span class="text-[9.5px] text-gray-400 font-bold uppercase block">Estilos Asociados</span>
                      <div class="flex gap-1 flex-wrap mt-1">
                        <span v-for="style in suggestion.metadata.styles" :key="style" class="bg-gray-150/60 text-gray-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide">
                          {{ style }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Explicación pedagógica -->
                  <p class="text-xs text-gray-600 leading-relaxed font-medium">
                    {{ suggestion.metadata?.explanation || suggestion.text }}
                  </p>
                  
                  <!-- Preview comparison box -->
                  <div class="bg-gray-50 rounded-2xl p-3 font-mono text-xs text-center border border-gray-100 flex flex-col items-center justify-center shadow-inner">
                    <span class="text-gray-400 block text-[9.5px] uppercase font-bold tracking-wider mb-1">Efecto / Cambio en Partitura</span>
                    <span class="font-extrabold text-[#6CA600] text-[13px] flex items-center gap-1">
                      {{ suggestion.preview }}
                    </span>
                  </div>
                  
                  <!-- Action button -->
                  <div class="pt-1 flex justify-end">
                    <button 
                      @click="runSuggestion(suggestion)"
                      class="px-5 py-2.5 text-xs font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                      :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-150 hover:shadow-violet-250' : 'bg-[#8EE000] text-black shadow-[#8EE000]/20 hover:bg-[#7BC200]'"
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
              :class="keyInfoData.accidentalsCountScale === 0 ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-[#8EE000]/10 border-[#8EE000]/20 text-[#6CA600]'">
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
                    <span :class="item.type === 'sharp' ? 'text-[#6CA600]' : 'text-blue-500'" class="font-black text-sm">
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
                  class="px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 border transition-all"
                  :class="isCharacteristicNote(scaleType, i) ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-sm font-black' : 'bg-gray-50 border-gray-100 text-gray-800'"
                >
                  <span class="text-[10px] font-bold" :class="isCharacteristicNote(scaleType, i) ? 'text-amber-600' : 'text-gray-400'">{{ i + 1 }}.</span>
                  {{ n }}
                  <span v-if="isCharacteristicNote(scaleType, i)" class="text-[9px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-black uppercase tracking-wider ml-1">★ Nota Característica</span>
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
                  <div v-for="(note, i) in keyInfoData.notesSpanish" :key="'n-'+i" 
                    class="text-[11px] font-black rounded-lg py-1.5 shadow-sm border transition-all"
                    :class="isCharacteristicNote(scaleType, i) ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-300/30' : 'bg-white text-gray-800 border-gray-100'"
                  >
                    {{ note }}
                  </div>
                  <!-- Intervalos -->
                  <div v-for="(inv, i) in keyInfoData.intervalLabels" :key="'inv-'+i" 
                    class="text-[9px] font-extrabold rounded-lg py-1 border transition-all"
                    :class="isCharacteristicNote(scaleType, i) ? 'bg-amber-600 text-white border-transparent' : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'"
                  >
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
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'synced_lyrics'">
            El modo de Letras Sincronizadas te permite enlazar sílabas o palabras de tus letras directamente con acordes específicos.<br><strong class="text-violet-600">🚀 Pásate a PRO para sincronizar tus letras y visualizarlas con conectores interactivos</strong>.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'transpose'">
            El transporte inteligente de acordes (tonal, modal y funcional) es una función PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para transportar tu partitura de forma inteligente</strong> y aprender cómo cambian los grados y las notas.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'alternativas_secundarias'">
            El Modo de Alternativas Secundarias es una función PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para insertar dominantes secundarios, sustitutos de tritono, ii relacionados e intercambios modales</strong> directamente en tu partitura.
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
    <!-- ==================== EDUCATIONAL METRIC INFO MODAL ==================== -->
    <transition name="fade">
      <div v-if="isMetricInfoModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="absolute inset-0" @click="isMetricInfoModalOpen = false"></div>
        
        <div class="relative bg-white rounded-3xl shadow-2xl p-6 max-w-lg w-full border border-gray-150 text-left animate-scale-up z-10 flex flex-col max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="text-xl">⏱️</span>
              <h3 class="text-lg font-black text-gray-900">Métrica y Cifra Indicadora</h3>
            </div>
            <button @click="isMetricInfoModalOpen = false" class="text-gray-400 hover:text-gray-600 text-sm font-bold bg-gray-100 w-7 h-7 rounded-full flex items-center justify-center">✕</button>
          </div>
          
          <div class="py-4 space-y-4 flex-1">
            <!-- Educational Section -->
            <div class="bg-violet-50/50 border border-violet-100 rounded-2xl p-4 space-y-3">
              <h4 class="text-xs font-black text-violet-750 uppercase tracking-widest">¿Qué es la cifra indicadora?</h4>
              <p class="text-xs text-gray-600 leading-relaxed">
                La cifra indicadora (o métrica) organiza el tiempo de la música en compases. Se expresa como una fracción:
              </p>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="bg-white p-2.5 rounded-xl border border-gray-200/60">
                  <strong class="text-gray-800 block text-sm font-bold mb-0.5">Numerador (Pulsos)</strong>
                  <span class="text-gray-500 block leading-tight">Cuántos pulsos tiene cada compás. Por ejemplo, en 4/4 hay 4 pulsos.</span>
                </div>
                <div class="bg-white p-2.5 rounded-xl border border-gray-200/60">
                  <strong class="text-gray-800 block text-sm font-bold mb-0.5">Denominador (Figura)</strong>
                  <span class="text-gray-500 block leading-tight">La figura que representa un pulso. <strong>4</strong> es Negra (♩) y <strong>8</strong> es Corchea (♪).</span>
                </div>
              </div>
            </div>

            <!-- Categories Guide -->
            <div class="space-y-3">
              <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider">Tipos de Métricas en HarmoniGrid</h4>
              <div class="space-y-2">
                <div class="flex gap-3 text-xs">
                  <span class="text-base shrink-0 select-none">🟢</span>
                  <div>
                    <strong class="text-gray-800 font-bold block">Métricas Simples (Subdivisión Binaria)</strong>
                    <span class="text-gray-500 block leading-tight">Cada pulso se divide naturalmente en dos (♩ = ♫). Ejemplos: 3/4 y 4/4.</span>
                  </div>
                </div>
                <div class="flex gap-3 text-xs">
                  <span class="text-base shrink-0 select-none">🔵</span>
                  <div>
                    <strong class="text-gray-800 font-bold block">Métricas Compuestas (Subdivisión Ternaria)</strong>
                    <span class="text-gray-500 block leading-tight">Los pulsos se agrupan en tres (♩. = ♫♪). Ejemplos: 6/8, 9/8, 12/8.</span>
                  </div>
                </div>
                <div class="flex gap-3 text-xs">
                  <span class="text-base shrink-0 select-none">🟣</span>
                  <div>
                    <strong class="text-gray-800 font-bold block">Métricas Avanzadas (Amalgama e Irregulares)</strong>
                    <span class="text-gray-500 block leading-tight">Pulsos asimétricos con agrupamientos rítmicos dinámicos (ej: 7/8 agrupado en 2+2+3).</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Global selector inside modal -->
            <div class="pt-4 border-t border-gray-200 space-y-3">
              <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider">Cambiar Métrica Global del Score</h4>
              <p class="text-[11px] text-gray-400">Puedes seleccionar una métrica para reestructurar todo tu score. Las métricas avanzadas requieren el plan PRO:</p>
              
              <div class="space-y-4">
                <div v-for="group in METRIC_GROUPS" :key="group.label" class="space-y-1.5">
                  <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider">{{ group.label }}</div>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="item in group.items"
                      :key="item.name"
                      @click="changeGlobalTimeSignature(item.beats, item.unit); isMetricInfoModalOpen = false"
                      class="flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all active:scale-95 text-xs font-bold"
                      :class="timeSignature === item.beats && timeSignatureUnit === item.unit
                        ? 'bg-violet-650 border-violet-650 text-white shadow-md'
                        : 'bg-gray-550 border-gray-200 text-gray-750 hover:bg-gray-100 bg-white'"
                    >
                      <div class="flex items-center gap-0.5">
                        <span>{{ item.name }}</span>
                        <span v-if="item.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.1 rounded font-black shrink-0 scale-90">PRO</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                  {{ translateNoteToSpanish(activeKeyChangeMeasure.keyChange.key) }} {{ SCALES[activeKeyChangeMeasure.keyChange.scaleType]?.name || activeKeyChangeMeasure.keyChange.scaleType }}
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
    <!-- ==================== RHYTHM TRANSITION PROMPT MODAL (EDUCATIONAL DIALOG) ==================== -->
    <transition name="fade">
      <div v-if="isRhythmPromptOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="absolute inset-0" @click="isRhythmPromptOpen = false"></div>
        
        <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-150 flex flex-col max-h-[85vh] animate-scale-up z-10">
          <!-- Header -->
          <div class="p-5 border-b border-gray-200 flex items-start gap-3 bg-amber-50">
            <span class="text-2xl shrink-0">⚠️</span>
            <div>
              <h4 class="text-base font-black text-amber-900 leading-tight">¿Quieres poner un acorde en este tiempo?</h4>
              <p class="text-xs text-amber-750 mt-1 leading-relaxed">
                El silencio será reemplazado por una semicorchea o corchea según corresponda. Selecciona la nueva figura rítmica que deseas usar de la familia de semicorcheas:
              </p>
            </div>
          </div>
          
          <!-- Content: List of matching patterns -->
          <div class="p-5 overflow-y-auto space-y-3 flex-1 bg-gray-50/50">
            <span class="block text-[11px] font-black text-gray-400 uppercase tracking-wider">Figuras rítmicas compatibles</span>
            
            <div class="grid grid-cols-1 gap-2">
              <button 
                v-for="pat in rhythmPromptMatchingPatterns" 
                :key="pat.key"
                @click="confirmRhythmPrompt(pat.key)"
                class="w-full flex items-center justify-between p-3.5 bg-white rounded-2xl border border-gray-200 hover:border-violet-500 hover:bg-violet-50/5 transition-all text-left group shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <div class="bg-violet-50 rounded-xl w-16 h-10 flex items-center justify-center text-violet-750 shrink-0 select-none border border-violet-100 group-hover:bg-violet-100/50 transition-colors px-1">
                    <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(pat.key)"></svg>
                  </div>
                  <div>
                    <span class="block text-xs font-bold text-gray-800 group-hover:text-violet-700 leading-tight">{{ pat.label }}</span>
                    <!-- Highlight how the slot configuration changes -->
                    <span class="block text-[10px] text-gray-400 mt-1">
                      Estructura:
                      <span v-for="(slot, sIdx) in pat.slots" :key="sIdx" class="mx-0.5">
                        <span v-if="sIdx === rhythmPromptSlotIndex" class="font-black text-violet-650 bg-violet-50 px-1 rounded border border-violet-100/50">
                          [Acorde]
                        </span>
                        <span v-else-if="slot === 'note'" class="text-gray-600 font-medium">Nota</span>
                        <span v-else-if="slot === 'silence'" class="text-gray-350">Silencio</span>
                        <span v-else-if="slot === 'merged'" class="text-gray-350 italic">Ligada</span>
                      </span>
                    </span>
                  </div>
                </div>
                <span class="text-violet-600 opacity-0 group-hover:opacity-100 transition-all font-bold text-xs shrink-0 flex items-center gap-0.5 ml-2">
                  Seleccionar <span class="translate-x-0 group-hover:translate-x-0.5 transition-transform">→</span>
                </span>
              </button>
            </div>
          </div>
          
          <!-- Footer buttons -->
          <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end gap-3 shrink-0">
            <button 
              @click="isRhythmPromptOpen = false" 
              class="px-4 py-2.5 text-xs font-bold text-gray-655 hover:text-gray-800 bg-gray-200 hover:bg-gray-250 rounded-xl transition-colors active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ==================== TRANSPOSE MODAL (PRO) ==================== -->
    <transition name="fade">
      <div v-if="isTransposeModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="absolute inset-0" @click="isTransposeModalOpen = false"></div>
        
        <div class="relative bg-white rounded-3xl shadow-2xl p-6 max-w-lg w-full border border-gray-150 text-left animate-scale-up z-10 flex flex-col max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="text-xl">🔄</span>
              <h3 class="text-lg font-black text-gray-900">Transportar (PRO)</h3>
            </div>
            <button @click="isTransposeModalOpen = false" class="text-gray-400 hover:text-gray-600 text-sm font-bold bg-gray-100 w-7 h-7 rounded-full flex items-center justify-center">✕</button>
          </div>
          
          <!-- Content -->
          <div class="py-4 space-y-4 flex-1">
            <!-- Tonalidad y Escala Destino -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Tónica selector -->
              <div>
                <label class="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Tónica Destino</label>
                <div class="space-y-1.5 bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                  <!-- Naturales -->
                  <div class="flex gap-1 justify-center">
                    <button v-for="k in keysNatural" :key="k" @click="transposeTargetKey = k" 
                      :class="transposeTargetKey === k ? 'bg-violet-600 text-white shadow-md shadow-violet-650/20' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/50'"
                      class="w-7 h-7 rounded-lg font-bold text-xs transition-all flex items-center justify-center">
                      {{ k }}
                    </button>
                  </div>
                  <!-- Sostenidos -->
                  <div class="flex gap-1 justify-center">
                    <button v-for="k in keysSharp" :key="k" @click="transposeTargetKey = k" 
                      :class="transposeTargetKey === k ? 'bg-violet-600 text-white shadow-md shadow-violet-650/20' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/50'"
                      class="w-7 h-7 rounded-lg font-bold text-xs transition-all flex items-center justify-center">
                      {{ k }}
                    </button>
                  </div>
                  <!-- Bemoles -->
                  <div class="flex gap-1 justify-center">
                    <button v-for="k in keysFlat" :key="k" @click="transposeTargetKey = k" 
                      :class="transposeTargetKey === k ? 'bg-violet-600 text-white shadow-md shadow-violet-650/20' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/50'"
                      class="w-7 h-7 rounded-lg font-bold text-xs transition-all flex items-center justify-center">
                      {{ k }}
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Escala Selector -->
              <div>
                <label class="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Escala Destino</label>
                <div class="bg-gray-50 p-2.5 rounded-2xl border border-gray-100 h-[106px] flex items-center">
                  <select v-model="transposeTargetScale" class="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all shadow-sm">
                    <optgroup v-for="group in groupedScales" :key="group.label" :label="group.label">
                      <option v-for="scale in group.items" :key="scale.id" :value="scale.id">
                        {{ scale.name }}
                      </option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
            
            <!-- Modo de transporte -->
            <div>
              <label class="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Modo de Transporte</label>
              <div class="bg-gray-100 p-1 rounded-xl flex gap-1 border border-gray-200/60 shadow-inner">
                <button @click="transposeMode = 'tonal'" 
                  :class="transposeMode === 'tonal' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'"
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center">
                  Tonal
                </button>
                <button @click="transposeMode = 'modal'" 
                  :class="transposeMode === 'modal' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'"
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center">
                  Modal
                </button>
                <button @click="transposeMode = 'functional'" 
                  :class="transposeMode === 'functional' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'"
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center">
                  Funcional
                </button>
              </div>
              
              <!-- Helper Text based on selected mode -->
              <p class="text-[11px] text-gray-500 mt-2 leading-relaxed bg-gray-50 p-3 rounded-2xl border border-gray-100 font-medium">
                <span v-if="transposeMode === 'tonal'">
                  <strong>Modo Tonal:</strong> Mueve todos los acordes preservando exactamente sus cualidades armónicas (ej. mayor, menor, séptima). Ideal para adaptar el tono a la tesitura de un cantante.
                </span>
                <span v-else-if="transposeMode === 'modal'">
                  <strong>Modo Modal:</strong> Cambia la sonoridad de la escala (ej. Mayor a Dórico) manteniendo la tónica. Recalcula las cualidades de los acordes según los nuevos grados diatónicos.
                </span>
                <span v-else-if="transposeMode === 'functional'">
                  <strong>Modo Funcional:</strong> Mapea los acordes de origen según sus funciones armónicas (Tónica, Subdominante, Dominante) a la escala de destino para una reinterpretación armónica avanzada.
                </span>
              </p>
            </div>
            
            <!-- Ámbito / Scope -->
            <div>
              <label class="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Ámbito de Aplicación</label>
              <div class="bg-gray-100 p-1 rounded-xl flex gap-1 border border-gray-200/60 shadow-inner">
                <button @click="transposeScope = 'all'" 
                  :class="transposeScope === 'all' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'"
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center">
                  Toda la partitura
                </button>
                <button @click="transposeScope = 'section'" 
                  :class="transposeScope === 'section' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'"
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center">
                  Solo sección actual
                </button>
              </div>
              <p class="text-[10px] text-gray-400 mt-1.5 px-1 font-medium">
                <span v-if="transposeScope === 'all'">Afectará a toda la partitura y cambiará la tonalidad global de la canción.</span>
                <span v-else>Afectará únicamente a la sección con la misma clave y escala. Se insertará un cambio local.</span>
              </p>
            </div>
            
            <!-- Vista Previa de Acordes -->
            <div>
              <label class="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Vista Previa de Acordes</label>
              <div class="bg-violet-50/20 border border-violet-100 rounded-2xl p-3 max-h-36 overflow-y-auto">
                <div v-if="!transposePreview.length" class="text-center py-4 text-xs text-gray-400 font-bold">
                  No hay acordes en la sección seleccionada para transformar.
                </div>
                <div v-else class="grid grid-cols-3 gap-2">
                  <div v-for="(item, idx) in transposePreview" :key="idx" class="bg-white border border-gray-150 rounded-xl p-2 text-center shadow-sm flex flex-col justify-center items-center">
                    <span class="text-[10px] text-gray-400 font-bold line-through">{{ item.from }}</span>
                    <span class="text-xs font-black text-violet-700 mt-0.5">{{ item.to }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Explicación Educativa -->
            <div v-if="transposeEducationNotes" class="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3 shadow-sm">
              <div class="flex items-center gap-1.5">
                <span class="text-base select-none">💡</span>
                <h4 class="text-xs font-black text-amber-900 uppercase tracking-wider">Concepto Armónico del Cambio</h4>
              </div>
              
              <p class="text-xs text-amber-950 font-medium leading-relaxed">
                {{ transposeEducationNotes.scaleDesc }}
              </p>
              
              <div v-if="transposeEducationNotes.changes && transposeEducationNotes.changes.length" class="space-y-2 pt-2 border-t border-amber-250/30">
                <span class="block text-[10px] font-black text-amber-900 uppercase tracking-wider">Modificaciones de Notas en la Escala:</span>
                <div class="flex flex-wrap gap-2">
                  <div v-for="chg in transposeEducationNotes.changes" :key="chg.degree" class="bg-white border border-amber-200/60 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-xs shadow-xs font-semibold">
                    <span class="text-amber-900 font-extrabold">{{ chg.degree }}:</span>
                    <span class="text-gray-400 line-through">{{ chg.from }}</span>
                    <span class="text-gray-400">➔</span>
                    <span class="text-amber-700 font-black">{{ chg.to }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer Buttons -->
          <div class="mt-5 pt-4 border-t border-gray-100 flex gap-3">
            <button @click="isTransposeModalOpen = false" class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-655 rounded-xl text-xs font-bold text-center active:scale-98 transition-all">
              Cancelar
            </button>
            <button @click="applyTranspose" class="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold text-center active:scale-98 transition-all shadow-md">
              Aplicar Transporte
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ==================== TOAST NOTIFICATION ==================== -->
    <transition name="toast-fade">
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 left-1/2 z-[200] bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800"
        style="transform: translate(-50%, 0);"
      >
        <span class="text-amber-500">⚠️</span>
        <span>{{ toastMessage }}</span>
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
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translate(-50%, 20px) scale(0.95) !important; }
.tie-arc {
  filter: drop-shadow(0px 1px 1.5px rgba(52, 199, 89, 0.25));
  opacity: 0.9;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.tie-arc:hover {
  stroke-width: 2.2px;
  stroke: #248A3D;
  opacity: 1;
}
.beat-container {
  transition: flex 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
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
/* Responsive layout for system rows using flex wrap and overflow visible */
.system-row {
  display: flex;
  flex-wrap: wrap;
  overflow: visible;
  align-items: center;
  width: 100%;
}
@media (max-width: 639px) {
  .system-row {
    gap: 0.75rem !important;
  }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .system-row {
    gap: 0.75rem !important;
  }
}

/* Lyrics Textarea & Auto-grow Span */
.lyric-textarea, .lyric-span {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: 0.02em;
  padding: 8px 12px;
  margin: 0;
  border: none;
  white-space: pre-wrap;
  word-break: break-word;
}
.lyric-textarea {
  resize: none;
  background: transparent;
  outline: none;
  width: 100%;
  height: 100%;
}
.lyric-span {
  visibility: hidden;
  pointer-events: none;
}
</style>
