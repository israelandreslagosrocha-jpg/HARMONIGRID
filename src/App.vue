<script setup>
import { ref, shallowRef, reactive, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { cloneMeasuresForPaste, pasteInternalTies } from './core/copyMeasures.js'
import { validateProjectDocument } from './core/projectDocument.js'
const CloudWorkspace = defineAsyncComponent(() => import('./components/CloudWorkspaceHost.vue'))
import ScoreViewport from './components/ScoreViewport.vue'
import ScoreSystem from './components/ScoreSystem.vue'
import MobileScoreOverview from './components/MobileScoreOverview.vue'
import LaunchNotice from './components/LaunchNotice.vue'
import logoUrl from './assets/logo.jpg'
import { getDiatonicChords, SCALES, getScaleNotes, getScaleDegreeLabels } from './core/scales.js'
import { formatChord, getRomanNumeralForChord } from './core/chords.js'
import { playClick, playChordNotes, getVoiceLedMidi, getRootPositionMidi } from './core/audio.js'
import { generatePDF } from './core/pdfExport.js'
import { buildExpandedSequence } from './core/repeatSequence.js'
import { FREE_MEASURE_LIMIT, PRO_MEASURE_LIMIT } from './core/projectLimits.js'
import { getKeySignatureString, getKeySignature, getParentKeyRoot, SCALE_PARENTS } from './core/keySignatures.js'
import { getSuggestionsForSystem, applySuggestion, getChordDegree, analyzeModulationRelationship } from './core/suggestions.js'
import { NOTE_TO_INDEX, transposeNote, getNoteName } from './core/notes.js'
import { getTransposedChord } from './core/transpose.js'
const generateUniqueId = () => {
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}
// --- FREE vs PRO STATE ---
// Public MVP: advanced tools remain in the engine for a future development branch.
const isFreeLaunch = true
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
// --- PDF EXPORT STATE ---
const isPdfExportModalOpen = ref(false)
const selectedPdfExportOption = ref('chords-only')

const isProOptionSelected = computed(() => {
  return ['chords-only-expanded', 'chords-and-lyrics-rhythm', 'chords-and-lyrics-synced'].includes(selectedPdfExportOption.value)
})

const triggerProUpgradeForExport = () => {
  isPdfExportModalOpen.value = false
  if (selectedPdfExportOption.value === 'chords-only-expanded') {
    upgradeReason.value = 'expanded_pdf'
  } else if (selectedPdfExportOption.value === 'chords-and-lyrics-rhythm') {
    upgradeReason.value = 'rhythm_lyrics'
  } else if (selectedPdfExportOption.value === 'chords-and-lyrics-synced') {
    upgradeReason.value = 'synced_lyrics'
  } else {
    upgradeReason.value = 'default'
  }
  isUpgradeModalOpen.value = true
}
// --- LYRICS STATE ---
const showLyricsGlobal = ref(false)
const hoveredMeasureIndex = ref(null)
const activeEditingLyricsIndex = ref(null)
const pendingSelection = ref(null)
const hoveredChordId = ref(null)
const hoveredAnchor = ref(null)
const activeConnectors = ref([])
let connectorUpdateTimer = null
const activeSyllableSelection = ref(null)
const lyricsTiedSlots = ref(new Set())
// --- RESPONSIVE STATE FOR AUTO-ORDERING ---
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
// Mobile navigation changes presentation only; composition data and export layout stay intact.
const mobilePanel = ref(null)
const mobileFocusedIndex = ref(null)
const editorScrollHost = ref(null)
const accountToolbarHost = ref(null)
let mobileOverviewScroll = 0
const isMobileEditor = computed(() => windowWidth.value < 768)
const toggleMobilePanel = panel => { mobilePanel.value = mobilePanel.value === panel ? null : panel }
const openMobileMeasure = async index => {
  if (mobileFocusedIndex.value === null) mobileOverviewScroll = editorScrollHost.value?.scrollTop || 0
  const measure = displayedMeasures.value[index]
  if (!measure) return
  mobileFocusedIndex.value = index
  selectedMeasureIndex.value = measure.originalMeasureIndex
  selectedBeat.value = null
  mobilePanel.value = null
  await nextTick()
  if (editorScrollHost.value) editorScrollHost.value.scrollTop = 0
  editorScrollHost.value?.querySelector('[data-mobile-detail-heading]')?.focus()
}
const closeMobileMeasure = async () => {
  const index = mobileFocusedIndex.value
  mobileFocusedIndex.value = null
  mobilePanel.value = null
  await nextTick()
  if (editorScrollHost.value) editorScrollHost.value.scrollTop = mobileOverviewScroll
  editorScrollHost.value?.querySelectorAll('.overview-measure')[index]?.focus({preventScroll:true})
}
const mobileFocusedSystem = computed(() => {
  const measure = displayedMeasures.value[mobileFocusedIndex.value]
  return measure ? {id:'mobile-detail-' + measure.id,measures:[measure]} : null
})
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
const cloudProjectGeneration = ref(0)
const title = ref('')
const timeSignature = ref(4)
const timeSignatureUnit = ref(4)
const key = ref('C')
const scaleType = ref('major')
const measures = ref([])
const measureWidthCache = new WeakMap()
const repeats = ref([])
const globalGroove = ref('Ninguno')
const globalShowObligado = ref(false)
const globalShowSubdivisions = ref(false)
const tempMeasureGroove = ref('global')
// --- UNDO HISTORY STATE & OPERATIONS ---
// Snapshots remain immutable plain data, shared only while a measure is unchanged.
const undoStack = shallowRef([])
const measureHistorySnapshots = new WeakMap()
const getMeasureHistorySnapshot = (measure) => {
  let snapshot = measureHistorySnapshots.get(measure)
  if (!snapshot) {
    snapshot = computed(() => JSON.parse(JSON.stringify(measure)))
    measureHistorySnapshots.set(measure, snapshot)
  }
  return snapshot.value
}
const saveHistory = () => {
  const stateCopy = {
    measures: measures.value.map(getMeasureHistorySnapshot),
    timeSignature: timeSignature.value,
    timeSignatureUnit: timeSignatureUnit.value,
    globalGrouping: globalGrouping.value ? [...globalGrouping.value] : null,
    globalGroove: globalGroove.value,
    keyRoot: key.value,
    scaleType: scaleType.value,
    tiedSlots: Array.from(tiedSlots.value),
    lyricsTiedSlots: Array.from(lyricsTiedSlots.value),
    repeats: JSON.parse(JSON.stringify(repeats.value))
  }
  
  undoStack.value = [...undoStack.value.slice(-49), stateCopy]
}
const undo = () => {
  if (undoStack.value.length === 0) return
  
  const prevState = undoStack.value[undoStack.value.length - 1]
  undoStack.value = undoStack.value.slice(0, -1)
  
  // Restore editable copies so later edits cannot mutate shared history snapshots.
  measures.value = JSON.parse(JSON.stringify(prevState.measures))
  timeSignature.value = prevState.timeSignature
  timeSignatureUnit.value = prevState.timeSignatureUnit
  globalGrouping.value = prevState.globalGrouping
  globalGroove.value = prevState.globalGroove
  key.value = prevState.keyRoot
  scaleType.value = prevState.scaleType
  tiedSlots.value = new Set(prevState.tiedSlots)
  lyricsTiedSlots.value = new Set(prevState.lyricsTiedSlots || [])
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
  if (isFreeLaunch && plan !== 'FREE') return
  currentPlan.value = plan
  if (plan === 'FREE') {
    viewMode.value = 'compact'
    if (configMeasuresCount.value > 20) {
      configMeasuresCount.value = 20
    }
    // Si la escala seleccionada en el wizard es PRO, revertir a Major
    const configScaleDef = SCALES[configScale.value]
    if (configScaleDef && configScaleDef.isPro) {
      configScale.value = 'major'
    }
    
    // Preserve the composition; plan gates control tools, not deletion of data.
  }
}
const startProject = () => {
  if (!Number.isSafeInteger(Number(configMeasuresCount.value)) || Number(configMeasuresCount.value) < 1) {
    showToast('Introduce una cantidad entera de compases válida.')
    return
  }
  cloudProjectGeneration.value++
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
  globalShowSubdivisions.value = false
  showLyricsGlobal.value = false
  
  const limit = currentPlan.value === 'PRO' ? PRO_MEASURE_LIMIT : FREE_MEASURE_LIMIT
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
    if (isFreeLaunch && val.isPro) continue
    if (groups[val.category]) {
      groups[val.category].items.push({ id: key, ...val })
    }
  }
  return Object.values(groups).filter(group => group.items.length)
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
  return `${scaleDef.explanation} En <strong>${scaleName}</strong>, las notas son <strong>${notesStr}</strong>. La sonoridad depende también del acorde, el ritmo, el registro y el fraseo; las descripciones de carácter orientan la escucha y no son reglas universales.`
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
  
  const intervalLabels = getScaleDegreeLabels(currentKey,currentScaleId)
  
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
  return buildExpandedSequence(measuresWithKey.value, repeats.value)
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
// --- CONSTRUCTOR DE ACORDE (CUSTOM CHORD BUILDER) ---
const builderState = reactive({
  rootBase: '',       // 'C', 'D', 'E', 'F', 'G', 'A', 'B' (Casilla 1 - Obligatoria)
  accidental: '',     // '', '#', 'b' (Casilla 2 - Alteración)
  quality: 'maj',     // 'maj', 'min', 'dim', 'aug' (Casilla 3 - Tríada Base)
  seventh: '',        // '', 'maj7', 'm7', '7', 'dim7' (Casilla 4 - Séptima)
  ext9: '',           // '', '9', 'b9', '#9' (Casilla 5 - Novena)
  ext11: '',          // '', '11', '#11' (Casilla 6 - Oncena)
  ext13: '',          // '', '13', 'b13', '#13' (Casilla 7 - Trecena)
  specialModifier: '' // '', '6', '69', 'sus4', 'sus2', 'omit3' (Casilla 8 - Modificadores)
})

const constructedChord = computed(() => {
  if (!builderState.rootBase) {
    return { root: '', type: '', tensions: [] }
  }
  const root = builderState.rootBase + builderState.accidental
  let type = builderState.quality

  // 7ma
  if (builderState.seventh === 'maj7') {
    type = builderState.quality === 'min' ? 'mM7' : 'maj7'
  } else if (builderState.seventh === 'm7' || builderState.seventh === '7') {
    if (builderState.quality === 'min') type = 'm7'
    else if (builderState.quality === 'dim') type = 'm7b5'
    else type = '7'
  } else if (builderState.seventh === 'dim7') {
    type = 'dim7'
  }

  // Modificadores especiales
  if (builderState.specialModifier === '6') {
    type = builderState.quality === 'min' ? 'm6' : '6'
  } else if (builderState.specialModifier === '69') {
    type = builderState.quality === 'min' ? 'm69' : '69'
  } else if (builderState.specialModifier === 'sus4') {
    type = 'sus4'
  } else if (builderState.specialModifier === 'sus2') {
    type = 'sus2'
  }

  const tensions = []
  if (builderState.ext9) tensions.push(builderState.ext9)
  if (builderState.ext11) tensions.push(builderState.ext11)
  if (builderState.ext13) tensions.push(builderState.ext13)
  if (builderState.specialModifier === 'omit3') tensions.push('omit3')

  return { root, type, tensions }
})

const loadChordIntoBuilder = (chordObj) => {
  if (!chordObj || !chordObj.root) {
    builderState.rootBase = ''
    builderState.accidental = ''
    builderState.quality = 'maj'
    builderState.seventh = ''
    builderState.ext9 = ''
    builderState.ext11 = ''
    builderState.ext13 = ''
    builderState.specialModifier = ''
    return
  }

  const r = chordObj.root
  if (r.includes('#')) {
    builderState.rootBase = r.replace('#', '')
    builderState.accidental = '#'
  } else if (r.includes('b')) {
    builderState.rootBase = r.replace('b', '')
    builderState.accidental = 'b'
  } else {
    builderState.rootBase = r
    builderState.accidental = ''
  }

  const type = chordObj.type || 'maj'
  if (['min', 'm7', 'm6', 'm69', 'mM7'].includes(type)) {
    builderState.quality = 'min'
  } else if (['dim', 'dim7', 'm7b5'].includes(type)) {
    builderState.quality = 'dim'
  } else if (['aug', 'maj7#5', '7#5'].includes(type)) {
    builderState.quality = 'aug'
  } else {
    builderState.quality = 'maj'
  }

  if (['maj7', 'mM7'].includes(type)) builderState.seventh = 'maj7'
  else if (['m7', '7'].includes(type)) builderState.seventh = 'm7'
  else if (['dim7', 'm7b5'].includes(type)) builderState.seventh = 'dim7'
  else builderState.seventh = ''

  if (['6', 'm6'].includes(type)) builderState.specialModifier = '6'
  else if (['69', 'm69'].includes(type)) builderState.specialModifier = '69'
  else if (type === 'sus4') builderState.specialModifier = 'sus4'
  else if (type === 'sus2') builderState.specialModifier = 'sus2'
  else builderState.specialModifier = ''

  const tensions = chordObj.tensions || (chordObj.tension ? [chordObj.tension] : [])
  builderState.ext9 = tensions.find(t => ['9', 'b9', '#9'].includes(t)) || ''
  builderState.ext11 = tensions.find(t => ['11', '#11'].includes(t)) || ''
  builderState.ext13 = tensions.find(t => ['13', 'b13', '#13'].includes(t)) || ''
  if (tensions.includes('omit3')) {
    builderState.specialModifier = 'omit3'
  }
}

const previewBuilderAudio = async () => {
  if (!constructedChord.value || !constructedChord.value.root) return
  try { await initAudio() } catch (error) { showToast(error.message); return }
  const midiNotes = getRootPositionMidi(constructedChord.value, 'fundamental', 'fundamental')
  if (audioCtx && midiNotes.length > 0) {
    playChordNotes(audioCtx, audioCtx.currentTime, midiNotes, 1.2, playbackInstrument.value || 'rhodes')
  }
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
const isSlotIdTiedToNextDirect = (measureIndex, beatIndex, sIdx, measure, beat) => {
  const slots = getBeatSlots(measure, beat, beatIndex)
  if (sIdx < slots.length - 1) {
    return tiedSlots.value.has(`${measureIndex}_${beatIndex}_${sIdx + 1}`)
  }
  
  if (beatIndex + 1 < measure.beats.length) {
    const nextBeat = measure.beats[beatIndex + 1]
    const nextRhythm = getEffectiveRhythm(measure, nextBeat, beatIndex + 1)
    const sig = getMeasureTimeSignature(measure)
    if (measure.showObligado && isSubdividedRhythm(nextRhythm, sig.unit === 8, nextBeat)) {
      return tiedSlots.value.has(`${measureIndex}_${beatIndex + 1}_0`)
    } else {
      return tiedSlots.value.has(`${measureIndex}_${beatIndex + 1}`)
    }
  }
  
  if (measureIndex + 1 < measures.value.length) {
    const nextMeasure = measures.value[measureIndex + 1]
    const nextBeat = nextMeasure?.beats[0]
    if (nextBeat) {
      const nextRhythm = getEffectiveRhythm(nextMeasure, nextBeat, 0)
      const sig = getMeasureTimeSignature(nextMeasure)
      if (nextMeasure.showObligado && isSubdividedRhythm(nextRhythm, sig.unit === 8, nextBeat)) {
        return tiedSlots.value.has(`${measureIndex + 1}_0_0`)
      } else {
        return tiedSlots.value.has(`${measureIndex + 1}_0`)
      }
    }
  }
  
  return false
}

const isSubdivisionCollapsed = (measure, beat, beatIdx) => {
  if (!measure || !beat) return false
  if (beat.forceSeparated) return false
  
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const isSub = measure.showObligado && isSubdividedRhythm(rhythm, sig.unit === 8, beat)
  if (!isSub) return false
  
  const slots = getBeatSlots(measure, beat, beatIdx)
  if (slots.length <= 1) return false
  
  // No colapsar si algún slot en esta subdivisión tiene un ligado (entrante o saliente)
  const origMIdx = measure.originalMeasureIndex
  for (let sIdx = 0; sIdx < slots.length; sIdx++) {
    const slotId = `${origMIdx}_${beatIdx}_${sIdx}`
    if (tiedSlots.value.has(slotId)) return false
    if (isSlotIdTiedToNextDirect(origMIdx, beatIdx, sIdx, measure, beat)) return false
  }
  
  const activeSlots = slots.filter(s => !s.isSilence && !s.isMerged)
  if (activeSlots.length === 0) return true
  
  const hasAllRoot = activeSlots.every(s => s.root)
  if (!hasAllRoot) return false
  
  return activeSlots.every(s => areChordsEqual(s, activeSlots[0]))
}
const shouldRenderAsSubdivided = (measure, beat, beatIdx) => {
  if (!measure || !beat) return false
  if (!measure.showObligado) return false
  
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const isSub = isSubdividedRhythm(rhythm, sig.unit === 8, beat)
  if (!isSub) return false
  
  if (isSubdivisionCollapsed(measure, beat, beatIdx)) {
    return false
  }
  
  return true
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
const systems = computed((previous) => {
  const result = []
  let currentSystem = []
  let currentSystemWidth = 0
  const gap = 12 // gap-x-3 = 12px
  
  displayedMeasures.value.forEach((measure, idx) => {
    const measureWidth = getCachedMeasureMinWidth(measure)
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
  
  // Preserve row identity when a nested edit leaves its grouping unchanged.
  // Measures remain reactive, so the edited row still updates its own content.
  const stable = result.map((system, index) => {
    const existing = previous?.[index]
    return existing && existing.measures.length === system.measures.length &&
      system.measures.every((measure, i) => measure === existing.measures[i])
      ? existing : system
  })
  return previous && previous.length === stable.length &&
    stable.every((system, index) => system === previous[index]) ? previous : stable
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
  const k = key.value
  const st = scaleType.value
  const spanishKey = translateNoteToSpanish(k)
  const scaleName = SCALES[st]?.name || st
  
  const getProgressionExample = (prog) => {
    return prog.map(num => {
      const resolved = resolveRomanNumeralToChord(num, k, st)
      let labelType = resolved.type
      if (labelType === 'maj') labelType = ''
      else if (labelType === 'min') labelType = 'm'
      return `${resolved.root}${labelType}`
    }).join(' - ')
  }

  const list = []

  if (st === 'major') {
    list.push({
      title: 'Progresión Pop Clásica',
      description: `Escribe la progresión más exitosa del pop mundial: **I - V - vi - IV** en ${spanishKey} ${scaleName}. Aporta balance y estabilidad (ej: ${getProgressionExample(['I', 'V', 'vi', 'IV'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'V', 'vi', 'IV']
      }
    })
    list.push({
      title: 'Cadencia Lidia Brillante (Intercambio)',
      description: `Añade un color brillante y cinematográfico usando el intercambio modal del IV grado mayor: **I - II - IV - I** (ej: ${getProgressionExample(['I', 'II', 'IV', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'II', 'IV', 'I']
      }
    })
    list.push({
      title: 'Cadencia Plagal de Jazz',
      description: `Progresión sofisticada ideal para puentes o coros: **ii7 - V7 - Imaj7**. Conecta la subdominante menor y el dominante con resolución de tónica (ej: ${getProgressionExample(['ii7', 'V7', 'Imaj7', 'Imaj7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['ii7', 'V7', 'Imaj7', 'Imaj7']
      }
    })
    list.push({
      title: 'Intercambio Modal Mixolidio',
      description: `Aporta una vibración rockera y abierta a tu progresión usando el acorde de bemol siete: **I - ♭VII - IV - I** (ej: ${getProgressionExample(['I', '♭VII', 'IV', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭VII', 'IV', 'I']
      }
    })
  } else if (st === 'minor') {
    list.push({
      title: 'Progresión Menor Clásica',
      description: `Escribe una progresión base menor sumamente expresiva: **i - ♭VI - ♭III - ♭VII** en ${spanishKey} ${scaleName}. Estándar de baladas (ej: ${getProgressionExample(['i', '♭VI', '♭III', '♭VII'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭VI', '♭III', '♭VII']
      }
    })
    list.push({
      title: 'Cadencia Frigia Española',
      description: `Color oscuro y flamenco: **i - ♭II - ♭III - ♭II** (ej: ${getProgressionExample(['i', '♭II', '♭III', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭II', '♭III', '♭II']
      }
    })
    list.push({
      title: 'Cadencia Menor Armónica',
      description: `Drama y fuerza dramática: **i - iv - V7 - i**. El V grado con tercera mayor proporciona resolución contundente (ej: ${getProgressionExample(['i', 'iv', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'iv', 'V7', 'i']
      }
    })
    list.push({
      title: 'Movimiento Dórico Elegante',
      description: `Elegancia y toque jazz-fusión: **i7 - IV7 - i7**. El IV mayor en escala menor introduce una sexta mayor brillante (ej: ${getProgressionExample(['i7', 'IV7', 'i7', 'i7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i7', 'IV7', 'i7', 'i7']
      }
    })
  } else if (st === 'dorian') {
    list.push({
      title: 'Progresión Dórica Clásica',
      description: `La progresión dórica por excelencia: **i - IV - ♭VII - i**. El IV grado mayor introduce la sexta mayor característica, aportando brillo (ej: ${getProgressionExample(['i', 'IV', '♭VII', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'IV', '♭VII', 'i']
      }
    })
    list.push({
      title: 'Groove Dórico Funk/Jazz',
      description: `Ideal para ritmos y vamps estáticos: **i7 - IV7 - i7 - IV7** (ej: ${getProgressionExample(['i7', 'IV7', 'i7', 'IV7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i7', 'IV7', 'i7', 'IV7']
      }
    })
    list.push({
      title: 'Movimiento Épico Dórico',
      description: `Progresión majestuosa y folk: **i - ♭VII - v - IV**, recurrente en bandas sonoras épicas y rock clásico (ej: ${getProgressionExample(['i', '♭VII', 'v', 'IV'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭VII', 'v', 'IV']
      }
    })
    list.push({
      title: 'Cadencia Dórica Extendida',
      description: `Movimiento ascendente y abierto: **i - ♭III - IV - ♭VII**, perfecto para secciones de transición (ej: ${getProgressionExample(['i', '♭III', 'IV', '♭VII'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭III', 'IV', '♭VII']
      }
    })
  } else if (st === 'phrygian') {
    list.push({
      title: 'Cadencia Frigia Típica',
      description: `Establece el carácter oscuro y místico del modo Frigio: **i - ♭II - ♭III - i**. Destaca el contraste inmediato con el segundo grado bemol (♭II) (ej: ${getProgressionExample(['i', '♭II', '♭III', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭II', '♭III', 'i']
      }
    })
    list.push({
      title: 'Cadencia Flamenca',
      description: `Movimiento tenso y folclórico: **i - ♭II - ♭VII - i**, recurrente en la música española y el metal (ej: ${getProgressionExample(['i', '♭II', '♭VII', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭II', '♭VII', 'i']
      }
    })
    list.push({
      title: 'Tensión Frigia Suspendida',
      description: `Resolución melancólica y misteriosa: **i - ♭II - iv - i** (ej: ${getProgressionExample(['i', '♭II', 'iv', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭II', 'iv', 'i']
      }
    })
    list.push({
      title: 'Oscilación Frigia con Séptimas',
      description: `Añade extensiones jazzeras sobre la base frigia: **i7 - ♭IImaj7 - ♭VII7 - i7** (ej: ${getProgressionExample(['i7', '♭IImaj7', '♭VII7', 'i7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i7', '♭IImaj7', '♭VII7', 'i7']
      }
    })
  } else if (st === 'lydian') {
    list.push({
      title: 'Oscilación Lidia Espacial',
      description: `Progresión etérea y cinematográfica típica del modo Lidio: **I - II**. El segundo grado mayor (II) destaca la cuarta aumentada (#4) de la escala (ej: ${getProgressionExample(['I', 'II', 'I', 'II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'II', 'I', 'II']
      }
    })
    list.push({
      title: 'Resolución Lidia Soñadora',
      description: `Sonoridad de ensueño y jazz: **Imaj7 - II7 - iii7 - Imaj7** (ej: ${getProgressionExample(['Imaj7', 'II7', 'iii7', 'Imaj7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['Imaj7', 'II7', 'iii7', 'Imaj7']
      }
    })
    list.push({
      title: 'Viaje Lidio Épico',
      description: `Progresión con resolución abierta y brillante: **I - II - V - I** (ej: ${getProgressionExample(['I', 'II', 'V', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'II', 'V', 'I']
      }
    })
    list.push({
      title: 'Cadencia Lidia a Menor',
      description: `Color interestelar con toque melancólico: **I - II - vi - I** (ej: ${getProgressionExample(['I', 'II', 'vi', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'II', 'vi', 'I']
      }
    })
  } else if (st === 'mixolydian') {
    list.push({
      title: 'Cadencia Mixolidia Clásica',
      description: `El sonido definitivo del rock clásico, blues y folk: **I - ♭VII - IV - I**. La presencia de ♭VII mayor reduce la tensión de dominante clásica (ej: ${getProgressionExample(['I', '♭VII', 'IV', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭VII', 'IV', 'I']
      }
    })
    list.push({
      title: 'Groove Mixolidio Moderno',
      description: `Progresión abierta y flotante: **I - v - ♭VII - IV**, con el quinto grado menor (v) suavizando la armonía (ej: ${getProgressionExample(['I', 'v', '♭VII', 'IV'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'v', '♭VII', 'IV']
      }
    })
    list.push({
      title: 'Oscilación Mixolidia',
      description: `Sonoridad relajada y psicodélica: **I7 - ♭VIImaj7 - IV - I** (ej: ${getProgressionExample(['I7', '♭VIImaj7', 'IV', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I7', '♭VIImaj7', 'IV', 'I']
      }
    })
    list.push({
      title: 'Tensión Mixolidia Directa',
      description: `Movimiento directo y enérgico: **I - ii - ♭VII - I** (ej: ${getProgressionExample(['I', 'ii', '♭VII', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'ii', '♭VII', 'I']
      }
    })
  } else if (st === 'locrian') {
    list.push({
      title: 'Resolución Locria Estable',
      description: `Armoniza la inestabilidad locria usando grados mayores de apoyo: **i° - ♭II - ♭iii - i°**. Mitiga la tensión de la quinta disminuida (ej: ${getProgressionExample(['i°', '♭II', '♭iii', 'i°'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i°', '♭II', '♭iii', 'i°']
      }
    })
    list.push({
      title: 'Oscilación Locria de Tensión',
      description: `Sonoridad oscura, tensa e industrial: **i° - ♭II - i° - ♭II** (ej: ${getProgressionExample(['i°', '♭II', 'i°', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i°', '♭II', 'i°', '♭II']
      }
    })
    list.push({
      title: 'Progresión Locria Misteriosa',
      description: `Camino armónico tenso pero resolutivo: **i° - iv - ♭VI - ♭II** (ej: ${getProgressionExample(['i°', 'iv', '♭VI', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i°', 'iv', '♭VI', '♭II']
      }
    })
    list.push({
      title: 'Cadencia Locria Pesada',
      description: `Movimiento característico de metal extremo: **i° - ♭V - ♭VI - ♭II** (ej: ${getProgressionExample(['i°', '♭V', '♭VI', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i°', '♭V', '♭VI', '♭II']
      }
    })
  } else if (st === 'harmonic_minor') {
    list.push({
      title: 'Drama Menor Armónico',
      description: `Fuerza y resolución dramática clásica: **i - iv - V7 - i**. El V grado mayor/dominante crea la tensión clásica para resolver a tónica (ej: ${getProgressionExample(['i', 'iv', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'iv', 'V7', 'i']
      }
    })
    list.push({
      title: 'Ciclo Armónico Tenso',
      description: `Cadencia académica e intensa: **i - ii° - V7 - i** (ej: ${getProgressionExample(['i', 'ii°', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'ii°', 'V7', 'i']
      }
    })
    list.push({
      title: 'Progresión Neoclásica',
      description: `Inspirada en el barroco y el metal neoclásico: **i - ♭VI - V7 - i** (ej: ${getProgressionExample(['i', '♭VI', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭VI', 'V7', 'i']
      }
    })
    list.push({
      title: 'Camino Exótico Menor',
      description: `Resolución retardada con gran carga emotiva: **i - iv - ♭VI - V7** (ej: ${getProgressionExample(['i', 'iv', '♭VI', 'V7'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'iv', '♭VI', 'V7']
      }
    })
  } else if (st === 'melodic_minor') {
    list.push({
      title: 'Resolución Melódica Jazz',
      description: `Sonido melódico clásico: **i - IV - V7 - i**. Combina el cuarto grado mayor (IV) con el quinto grado mayor/dominante (V7) (ej: ${getProgressionExample(['i', 'IV', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'IV', 'V7', 'i']
      }
    })
    list.push({
      title: 'Cadencia Jazz Melódica',
      description: `Movimiento jazzy y lineal: **i - ii - V7 - i** (ej: ${getProgressionExample(['i', 'ii', 'V7', 'i'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'ii', 'V7', 'i']
      }
    })
    list.push({
      title: 'Oscilación Melódica Elegante',
      description: `Ambiente flotante y sofisticado: **i - IV - i - IV** (ej: ${getProgressionExample(['i', 'IV', 'i', 'IV'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', 'IV', 'i', 'IV']
      }
    })
    list.push({
      title: 'Ascenso Melódico',
      description: `Movimiento cromático y melódico ascendente: **i - ♭III - IV - V** (ej: ${getProgressionExample(['i', '♭III', 'IV', 'V'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['i', '♭III', 'IV', 'V']
      }
    })
  } else if (st === 'phrygian_dominant') {
    list.push({
      title: 'Cadencia Flamenca Dominante',
      description: `La cadencia andaluza y flamenca más tradicional: **I - ♭II - ♭III - ♭II**. Aporta un sonido exótico de raíz española (ej: ${getProgressionExample(['I', '♭II', '♭III', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭II', '♭III', '♭II']
      }
    })
    list.push({
      title: 'Tensión Árabe',
      description: `Carácter oriental y místico: **I - iv - ♭II - I**, resolviendo firmemente sobre la tónica mayor (ej: ${getProgressionExample(['I', 'iv', '♭II', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', 'iv', '♭II', 'I']
      }
    })
    list.push({
      title: 'Oscilación Frigia Dominante',
      description: `Enfoque de máxima tensión y resolución inmediata: **I - ♭II - I - ♭II** (ej: ${getProgressionExample(['I', '♭II', 'I', '♭II'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭II', 'I', '♭II']
      }
    })
    list.push({
      title: 'Progresión Dominante Extendida',
      description: `Sonoridad profunda y pesada: **I - ♭vii - ♭II - I** (ej: ${getProgressionExample(['I', '♭vii', '♭II', 'I'])}).`,
      payload: {
        type: 'replace_progression',
        progression: ['I', '♭vii', '♭II', 'I']
      }
    })
  } else {
    const degs = SCALES[st]?.degrees || []
    if (degs.length > 0) {
      const p1 = [degs[0].numeral, degs[Math.min(3, degs.length - 1)].numeral, degs[Math.min(4, degs.length - 1)].numeral, degs[0].numeral]
      list.push({
        title: 'Progresión Diatónica Base',
        description: `Explora la sonoridad fundamental de esta escala con una cadencia base: **${p1.join(' - ')}** en ${spanishKey} ${scaleName} (ej: ${getProgressionExample(p1)}).`,
        payload: {
          type: 'replace_progression',
          progression: p1
        }
      })

      const p2 = [degs[0].numeral, degs[Math.min(5, degs.length - 1)].numeral, degs[Math.min(3, degs.length - 1)].numeral, degs[Math.min(4, degs.length - 1)].numeral]
      list.push({
        title: 'Viaje Diatónico Completo',
        description: `Disfruta del recorrido armónico expandido de esta escala: **${p2.join(' - ')}** en ${spanishKey} ${scaleName} (ej: ${getProgressionExample(p2)}).`,
        payload: {
          type: 'replace_progression',
          progression: p2
        }
      })

      const p3 = [degs[0].numeral, degs[Math.min(1, degs.length - 1)].numeral, degs[Math.min(4, degs.length - 1)].numeral, degs[0].numeral]
      list.push({
        title: 'Cadencia de Paso Suave',
        description: `Suave tensión a través del segundo grado de la escala: **${p3.join(' - ')}** en ${spanishKey} ${scaleName} (ej: ${getProgressionExample(p3)}).`,
        payload: {
          type: 'replace_progression',
          progression: p3
        }
      })

      const p4 = [degs[0].numeral, degs[Math.min(1, degs.length - 1)].numeral, degs[0].numeral, degs[Math.min(1, degs.length - 1)].numeral]
      list.push({
        title: 'Oscilación Característica',
        description: `Efecto hipnótico de balance entre el primer y segundo grado: **${p4.join(' - ')}** en ${spanishKey} ${scaleName} (ej: ${getProgressionExample(p4)}).`,
        payload: {
          type: 'replace_progression',
          progression: p4
        }
      })
    }
  }

  return list
}
// Rule windows only depend on their four measures and inherited key context.
const suggestionKeyContext = computed(() => {
  let activeKey = key.value
  let activeScale = scaleType.value
  return measures.value.map(m => {
    if (currentPlan.value === 'PRO' && m.keyChange) {
      activeKey = m.keyChange.key
      activeScale = m.keyChange.scaleType || 'major'
    }
    return { key: activeKey, scale: activeScale }
  })
})
const suggestionWindows = []
const updateSuggestionsPool = () => {
  if (!measures.value) return
  const pool = []
  const len = measures.value.length
  
  suggestionWindows.length = Math.min(suggestionWindows.length, Math.max(0, len - 3))
  for (let i = 0; i <= len - 4; i++) {
    if (!suggestionWindows[i]) {
      suggestionWindows[i] = computed(() => {
        const context = suggestionKeyContext.value[i]
        return getSuggestionsForSystem(measures.value.slice(i, i + 4), i, context.key || key.value, context.scale || scaleType.value)
      })
    }
    const windowSuggestions = suggestionWindows[i].value
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
// Suggestions inspect harmonic fields, not lyric text, anchors or UI metadata.
const suggestionInputs = computed(() => measures.value.map(m => ({
  keyChange: m.keyChange ? { key: m.keyChange.key, scaleType: m.keyChange.scaleType } : null,
  beats: m.beats.map(b => ({
    root: b.root, type: b.type, tension: b.tension,
    tensions: b.tensions ? [...b.tensions] : [], bass: b.bass
  }))
})))
watch([key, scaleType, suggestionInputs, currentPlan], (newVal, oldVal) => {
  if (oldVal && (newVal[0] !== oldVal[0] || newVal[1] !== oldVal[1])) {
    suggestionOffset.value = 0
  }
  updateSuggestionsPool()
}, { immediate: true })
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
  const beatIdx = state.index
  const isMobile = windowWidth.value < 768
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig?.unit === 8
  
  // 1. Calculate min-width needed by Chords
  let chordMinWidth = 0
  const chordBeat = measure.beats[beatIdx] || { root: '', type: '' }
  {
    const rhythm = getEffectiveRhythm(measure, chordBeat, beatIdx)
    const isSynced = currentPlan.value === 'PRO' && measure.lyrics?.mode === 'synced'
    let baseMin = state.durationSlots * (isSynced ? (isMobile ? 28 : 35) : (isMobile ? 40 : 50))
    
    if (rhythm === 'sixteenth') {
      baseMin = Math.max(baseMin, isSynced ? (isMobile ? 64 : 80) : (isMobile ? 96 : 112))
    } else if (rhythm === 'triplet') {
      baseMin = Math.max(baseMin, isSynced ? (isMobile ? 48 : 60) : (isMobile ? 72 : 84))
    } else if (rhythm === 'quintuplet') {
      baseMin = Math.max(baseMin, isSynced ? (isMobile ? 75 : 90) : (isMobile ? 100 : 120))
    }
    
    if (shouldRenderAsSubdivided(measure, chordBeat, beatIdx)) {
      const slots = getVisibleSlotsForRender(measure, chordBeat, beatIdx)
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
          
          const displayParts = splitChordDisplay(s, measure.originalMeasureIndex)
          const maxPartLen = Math.max(displayParts.main.length, displayParts.bass.length)
          slotMin = padding + maxPartLen * charWidth
        }
        
        const requiredBeatWidth = slotMin * (totalFlexGrow / (s.flexGrow || 1))
        subWidthNeeded = Math.max(subWidthNeeded, requiredBeatWidth)
      })
      baseMin = Math.max(baseMin, subWidthNeeded)
    } 
    else if (chordBeat.root) {
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
      
      const displayParts = splitChordDisplay(chordBeat, measure.originalMeasureIndex)
      const maxPartLen = Math.max(displayParts.main.length, displayParts.bass.length)
      let chordValMinWidth = padding + maxPartLen * charWidth
      
      baseMin = Math.max(baseMin, chordValMinWidth)
    }
    
    if (isSynced && chordBeat.id) {
      const layoutData = getMeasureLyricsLayout(measure)
      const slotRes = layoutData[chordBeat.id]
      if (slotRes && slotRes.hasLyrics) {
        const textLen = slotRes.hasAssociated 
          ? (slotRes.preText.length + slotRes.associatedText.length + slotRes.postText.length) 
          : slotRes.normalText.length
        const lyricMinWidth = textLen * 8.0 + 24
        baseMin = Math.max(baseMin, lyricMinWidth)
      }
    }
    chordMinWidth = baseMin
  }
  
  // 2. Calculate min-width needed by Lyrics
  let lyricsMinWidth = 0
  if (measure.lyrics?.mode === 'rhythm') {
    const lyricsBeat = measure.lyrics.beats?.[beatIdx]
    if (lyricsBeat) {
      const rhythm = getLyricsEffectiveRhythm(measure, lyricsBeat, beatIdx)
      const isSub = getLyricsBeatSlots(measure, lyricsBeat, beatIdx).length > 0
      
      let baseMin = state.durationSlots * (isMobile ? 40 : 50)
      
      if (rhythm === 'sixteenth') {
        baseMin = Math.max(baseMin, isMobile ? 112 : 128)
      } else if (rhythm === 'triplet') {
        baseMin = Math.max(baseMin, isMobile ? 84 : 96)
      } else if (rhythm === 'quintuplet') {
        baseMin = Math.max(baseMin, isMobile ? 120 : 144)
      }
      
      let charWidth = isMobile ? 7 : 8.5
      let padding = isMobile ? 12 : 16
      
      if (!isSub) {
        const syl = getSyllableAtSlot(measure, beatIdx, null)
        if (syl && syl.text) {
          const slotTextLen = syl.text.length + (syl.tied ? 1 : 0)
          let slotMinWidth = slotTextLen * charWidth + padding
          if (syl.isRoot) {
            slotMinWidth += 18
          }
          baseMin = Math.max(baseMin, slotMinWidth)
        }
      } else {
        const visibleSlots = getLyricsVisibleSlotsForRender(measure, lyricsBeat, beatIdx)
        const totalFlex = visibleSlots.reduce((sum, s) => sum + s.flexGrow, 0)
        
        let maxSubWidth = 0
        visibleSlots.forEach(sub => {
          const syl = getSyllableAtSlot(measure, beatIdx, sub.originalIndex)
          if (syl && syl.text) {
            const slotTextLen = syl.text.length + (syl.tied ? 1 : 0)
            let slotMinWidth = slotTextLen * charWidth + padding
            if (syl.isRoot) {
              slotMinWidth += 18
            }
            
            const requiredBeatWidth = slotMinWidth * (totalFlex / sub.flexGrow)
            maxSubWidth = Math.max(maxSubWidth, requiredBeatWidth)
          }
        })
        baseMin = Math.max(baseMin, maxSubWidth)
      }
      lyricsMinWidth = baseMin
    }
  }
  
  return Math.max(chordMinWidth, lyricsMinWidth)
}
const getMeasureMinWidth = (measure) => {
  const chordStates = getMergedBeats(measure)
  let chordsMinWidth = 0
  chordStates.forEach(state => {
    if (!state.isMerged) {
      chordsMinWidth += getBeatMinWidth(measure, state.beat, state)
    }
  })
  
  let lyricsMinWidth = 0
  if (measure.lyrics?.mode === 'rhythm') {
    const lyricsStates = getLyricsMergedBeats(measure)
    lyricsStates.forEach(state => {
      if (!state.isMerged) {
        lyricsMinWidth += getBeatMinWidth(measure, state.beat, state)
      }
    })
  } else if (measure.lyrics?.mode === 'synced') {
    lyricsMinWidth = chordsMinWidth
  }
  
  let totalMinWidth = Math.max(chordsMinWidth, lyricsMinWidth)
  totalMinWidth += 36 // Card base margins/paddings
  
  // Add spacers minWidth under PRO plan
  if (currentPlan.value === 'PRO') {
    if (measure.keyChange) {
      totalMinWidth += 120
    }
    const idx = measureMetricContext.value.indexById.get(measure.id) ?? -1
    if (idx > 0) {
      const prevSig = getMeasureTimeSignature(idx - 1)
      if (measure.timeSignature && (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit)) {
        totalMinWidth += 72
      }
    }
  }
  
  return totalMinWidth
}
// Projections keep identity during nested edits, so only affected widths recompute.
const getCachedMeasureMinWidth = (measure) => {
  let width = measureWidthCache.get(measure)
  if (!width) {
    width = computed(() => getMeasureMinWidth(measure))
    measureWidthCache.set(measure, width)
  }
  return width.value
}
const getMeasureFlexStyle = (measure) => {
  const sig = getMeasureTimeSignature(measure)
  const beats = sig.beats
  const minWidth = getCachedMeasureMinWidth(measure)
  
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
  const isRest = rhythm.startsWith('rest-')
  const base = isRest ? rhythm.substring(5) : rhythm
  
  if (isDenom8) {
    if (base === 'dotted-whole') return 12
    if (base === 'whole') return 8
    if (base === 'dotted-half') return 6
    if (base === 'double') return 4
    if (base === 'dotted-quarter') return 3
    if (base === 'quarter') return 2
    if (base === 'two-eighths') return 2
    if (base === 'sixteenth') return 2
    if (base === 'eighth') return 1
    if (base === 'triplet') return 2
    return 1
  } else {
    if (base === 'dotted-whole') return 6
    if (base === 'whole') return 4
    if (base === 'dotted-half') return 3
    if (base === 'double') return 2
    if (base === 'dotted-quarter') return 1.5
    if (base === 'quarter') return 1
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
    if (rhythmType === 'two-eighths') return 2
    if (rhythmType === 'sixteenth') return 2
    if (rhythmType === 'eighth') return 1
    if (rhythmType === 'triplet') return 2
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
  
  if (rhythm === 'triplet') {
    return beat.tripletPattern === key || (!beat.tripletPattern && key === '3_notes')
  }
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
  const base = rhythmType && rhythmType.startsWith('rest-') ? rhythmType.substring(5) : rhythmType
  if (isDenom8) {
    if (base === 'eighth') {
      return beat && beat.eighthPattern ? true : false
    }
    return ['sixteenth', 'triplet', 'quintuplet'].includes(base)
  } else {
    return ['eighth', 'sixteenth', 'triplet', 'quintuplet', 'offbeat'].includes(base)
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
const getPlaybackMergedBeats = (measure) => {
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
  
  if (currentPlan.value === 'PRO') {
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
    
    // 2. Fusion of adjacent identical tied beats
    for (let i = 0; i < numBeats; i++) {
      if (states[i].isMerged) continue
      
      let currentIdx = i
      let nextIdx = currentIdx + states[currentIdx].durationSlots
      
      while (nextIdx < numBeats) {
        const currentBeat = states[currentIdx].beat
        const nextBeat = states[nextIdx].beat
        
        const currentRhythm = getEffectiveRhythm(measure, currentBeat, currentIdx)
        const nextRhythm = getEffectiveRhythm(measure, nextBeat, nextIdx)
        const currentSubdivided = isSubdividedRhythm(currentRhythm, sig.unit === 8, currentBeat)
        const nextSubdivided = isSubdividedRhythm(nextRhythm, sig.unit === 8, nextBeat)
        
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
  return states
}
const shouldPlaybackRenderAsSubdivided = (measure, beat, beatIdx) => {
  if (!measure || !beat) return false
  
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const isSub = isSubdividedRhythm(rhythm, sig.unit === 8, beat)
  if (!isSub) return false
  
  return true
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
  const figures = []
  
  if (isDenom8) {
    if (sig.beats >= 12) {
      figures.push({ value: 'dotted-whole', label: 'Redonda con Punto (12 Corcheas)', icon: '\uD834\uDD5D.', isPro: true })
    }
    figures.push({ value: 'whole', label: 'Redonda (8 Corcheas)', icon: '\uD834\uDD5D', isPro: true })
    figures.push({ value: 'dotted-half', label: 'Blanca con Punto (6 Corcheas)', icon: '\uD834\uDD5E.', isPro: true })
    figures.push({ value: 'double', label: 'Blanca (4 Corcheas)', icon: '\uD834\uDD5E', isPro: true })
    figures.push({ value: 'dotted-quarter', label: 'Negra con Punto (3 Corcheas)', icon: '\uD834\uDD5F.', isPro: true })
    figures.push({ value: 'quarter', label: 'Negra', icon: '\uD834\uDD5F', isPro: false })
    figures.push({ value: 'two-eighths', label: '2 Corcheas', icon: '\u266B', isPro: false })
    figures.push({ value: 'eighth', label: '1 Corchea', icon: '\uD834\uDD60', isPro: false })
    figures.push({ value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '\uD834\uDD61', isPro: true })
    
    if (sig.beats >= 12) {
      figures.push({ value: 'rest-dotted-whole', label: 'Silencio de Redonda con Punto (12c)', icon: '𝄻.', isPro: true })
    }
    figures.push({ value: 'rest-whole', label: 'Silencio de Redonda (8c)', icon: '𝄻', isPro: true })
    figures.push({ value: 'rest-dotted-half', label: 'Silencio de Blanca con Punto (6c)', icon: '𝄼.', isPro: true })
    figures.push({ value: 'rest-double', label: 'Silencio de Blanca (4c)', icon: '𝄼', isPro: true })
    figures.push({ value: 'rest-dotted-quarter', label: 'Silencio de Negra con Punto (3c)', icon: '𝄽.', isPro: true })
    figures.push({ value: 'rest-quarter', label: 'Silencio de Negra (2c)', icon: '𝄽', isPro: true })
  } else {
    if (sig.beats >= 6) {
      figures.push({ value: 'dotted-whole', label: 'Redonda con Punto (6 Negras)', icon: '\uD834\uDD5D.', isPro: true })
    }
    figures.push({ value: 'whole', label: 'Redonda (4 Negras)', icon: '\uD834\uDD5D', isPro: true })
    figures.push({ value: 'dotted-half', label: 'Blanca con Punto (3 Negras)', icon: '\uD834\uDD5E.', isPro: true })
    figures.push({ value: 'double', label: 'Blanca (2 Negras)', icon: '\uD834\uDD5E', isPro: true })
    figures.push({ value: 'dotted-quarter', label: 'Negra con Punto (1.5 Negras)', icon: '\uD834\uDD5F.', isPro: true })
    figures.push({ value: 'quarter', label: 'Negra (1 Negra)', icon: '\uD834\uDD5F', isPro: false })
    figures.push({ value: 'eighth', label: 'Corcheas (2x)', icon: '\u266B', isPro: false })
    figures.push({ value: 'offbeat', label: 'Contratiempo', icon: '\u21B7', isPro: false })
    figures.push({ value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '\u266C', isPro: true })
    figures.push({ value: 'triplet', label: 'Tresillo (3x)', icon: '3\uFE0F\u20E3', isPro: true })
    
    if (sig.beats >= 6) {
      figures.push({ value: 'rest-dotted-whole', label: 'Silencio de Redonda con Punto (6t)', icon: '𝄻.', isPro: true })
    }
    figures.push({ value: 'rest-whole', label: 'Silencio de Redonda (4t)', icon: '𝄻', isPro: true })
    figures.push({ value: 'rest-dotted-half', label: 'Silencio de Blanca con Punto (3t)', icon: '𝄼.', isPro: true })
    figures.push({ value: 'rest-double', label: 'Silencio de Blanca (2t)', icon: '𝄼', isPro: true })
    figures.push({ value: 'rest-dotted-quarter', label: 'Silencio de Negra con Punto (1.5t)', icon: '𝄽.', isPro: true })
    figures.push({ value: 'rest-quarter', label: 'Silencio de Negra (1t)', icon: '𝄽', isPro: true })
  }
  return figures
}
const getRhythmDisplayIcon = (rhythm, measure) => {
  const isRest = rhythm.startsWith('rest-')
  if (isRest) {
    if (rhythm === 'rest-dotted-whole') return '𝄻.'
    if (rhythm === 'rest-whole') return '𝄻'
    if (rhythm === 'rest-dotted-half') return '𝄼.'
    if (rhythm === 'rest-double') return '𝄼'
    if (rhythm === 'rest-dotted-quarter') return '𝄽.'
    if (rhythm === 'rest-quarter') return '𝄽'
  }
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  if (isDenom8) {
    if (rhythm === 'dotted-whole') return '\uD834\uDD5D.'
    if (rhythm === 'whole') return '\uD834\uDD5D'
    if (rhythm === 'dotted-half') return '\uD834\uDD5E.'
    if (rhythm === 'double') return '\uD834\uDD5E'
    if (rhythm === 'dotted-quarter') return '\uD834\uDD5F.'
    if (rhythm === 'quarter') return '\uD834\uDD5F'
    if (rhythm === 'eighth' || rhythm === 'auto') return '\uD834\uDD60'
    if (rhythm === 'sixteenth') return '♫'
    if (rhythm === 'triplet') return '♫³'
    if (rhythm === 'quintuplet') return '♫⁵'
  } else {
    if (rhythm === 'dotted-whole') return '\uD834\uDD5D.'
    if (rhythm === 'whole') return '\uD834\uDD5D'
    if (rhythm === 'dotted-half') return '\uD834\uDD5E.'
    if (rhythm === 'double') return '\uD834\uDD5E'
    if (rhythm === 'dotted-quarter') return '\uD834\uDD5F.'
    if (rhythm === 'quarter' || rhythm === 'auto') return '\uD834\uDD5F'
    if (rhythm === 'eighth') return '♫'
    if (rhythm === 'sixteenth') return '♬'
    if (rhythm === 'triplet') return '♫³'
    if (rhythm === 'quintuplet') return '♫⁵'
  }
  return ''
}
const getRhythmDisplayIconSVG = (rhythm, measure, beat) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  
  if (rhythm === 'auto') {
    return getRhythmIconSVG(isDenom8 ? 'single-eighth' : 'quarter', isDenom8)
  }
  
  let resolvedRhythm = rhythm
  if (beat) {
    const isSub = isSubdividedRhythm(resolvedRhythm, isDenom8, beat)
    if (isSub) {
      if (resolvedRhythm === 'eighth') return getRhythmIconSVG(beat.eighthPattern || '2_notes', isDenom8)
      if (resolvedRhythm === 'sixteenth') return getRhythmIconSVG(beat.sixteenthPattern || '4_semi', isDenom8)
      if (resolvedRhythm === 'triplet') return getRhythmIconSVG(beat.tripletPattern || '3_notes', isDenom8)
      if (resolvedRhythm === 'quintuplet') return getRhythmIconSVG('quintuplet', isDenom8)
    }
  }
  if (isDenom8) {
    if (resolvedRhythm === 'two-eighths') {
      return getRhythmIconSVG('2_notes', false)
    }
    if (resolvedRhythm === 'eighth') {
      return getRhythmIconSVG('single-eighth', isDenom8)
    }
  }
  return getRhythmIconSVG(resolvedRhythm, isDenom8)
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
// Build inherited metric context once. Chord/lyric edits do not invalidate it.
const measureMetricContext = computed(() => {
  const indexById = new Map()
  const signatures = []
  const groupings = []
  let signature = { beats: timeSignature.value, unit: timeSignatureUnit.value }
  let grouping = null
  measures.value.forEach((measure, index) => {
    // Match findIndex's first-match behavior for legacy projects with repeated IDs.
    if (!indexById.has(measure.id)) indexById.set(measure.id, index)
    if (measure.timeSignature) {
      signature = { beats: measure.timeSignature.beats, unit: measure.timeSignature.unit }
    }
    if (measure.grouping) grouping = measure.grouping
    signatures.push(signature)
    groupings.push(grouping)
  })
  return { indexById, signatures, groupings }
})
const getMeasureIndex = (measureOrIdx) => {
  if (measureOrIdx && typeof measureOrIdx === 'object') {
    return measureOrIdx.originalMeasureIndex !== undefined
      ? measureOrIdx.originalMeasureIndex
      : (measureMetricContext.value.indexById.get(measureOrIdx.id) ?? -1)
  }
  return measureOrIdx
}
const getMeasureTimeSignature = (measureOrIdx) => {
  const idx = getMeasureIndex(measureOrIdx)
  const signatures = measureMetricContext.value.signatures
  const signature = idx !== null && idx !== undefined && idx >= 0
    ? signatures[Math.min(idx, signatures.length - 1)]
    : null
  return signature
    ? { ...signature }
    : { beats: timeSignature.value, unit: timeSignatureUnit.value }
}
const getMeasureGrouping = (measureOrIdx) => {
  const idx = getMeasureIndex(measureOrIdx)
  const m = measureOrIdx && typeof measureOrIdx === 'object'
    ? measureOrIdx
    : measures.value[idx]
  if (!m) {
    return getDefaultGrouping(timeSignature.value, timeSignatureUnit.value)
  }
  const sig = getMeasureTimeSignature(m)
  if (sig.unit === 8) {
    const analysis = analyzeMeasureSubdivision(m)
    if (analysis.type === 'match') return analysis.pattern
  }
  const grouping = idx !== null && idx !== undefined && idx >= 0
    ? measureMetricContext.value.groupings[Math.min(idx, measures.value.length - 1)]
    : null
  return grouping || getDefaultGrouping(sig.beats, sig.unit)
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
const saveLocalTimeSignature = (onlyThisMeasure = false) => {
  if (selectedMeasureIndex.value !== null) {
    saveHistory()
    const idx = selectedMeasureIndex.value
    const m = measures.value[idx]
    if (!m) return
    
    const newTimeSig = {
      beats: localMetricBeats.value,
      unit: localMetricUnit.value
    }
    const parsed = parseGroupingString(tempLocalGroupingStr.value, localMetricBeats.value)
    const newGrouping = parsed || getDefaultGrouping(localMetricBeats.value, localMetricUnit.value)

    if (onlyThisMeasure) {
      if (idx < measures.value.length - 1) {
        const nextM = measures.value[idx + 1]
        if (nextM && !nextM.timeSignature) {
          const prevActiveSig = getMeasureTimeSignature(idx)
          const prevActiveGrouping = getMeasureGrouping(idx)
          nextM.timeSignature = {
            beats: prevActiveSig.beats,
            unit: prevActiveSig.unit
          }
          nextM.grouping = [...prevActiveGrouping]
        }
      }
      m.timeSignature = { ...newTimeSig }
      m.grouping = [...newGrouping]
      m.showSubdivisions = tempShowSubdivisions.value
    } else {
      // Apply to this measure AND ALL SUBSEQUENT MEASURES
      for (let i = idx; i < measures.value.length; i++) {
        const targetM = measures.value[i]
        targetM.timeSignature = { ...newTimeSig }
        targetM.grouping = [...newGrouping]
        targetM.showSubdivisions = tempShowSubdivisions.value
      }
    }

    syncMeasuresBeats()
    
    isLocalMetricSubMenuOpen.value = false
    isMeasureOptionsOpen.value = false
    const scopeMsg = onlyThisMeasure ? "sólo a este compás" : "a partir de este compás"
    showToast(`Métrica y subdivisión aplicadas ${scopeMsg}: ${localMetricBeats.value}/${localMetricUnit.value}`)
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
const mobileRangeFrom = ref('')
const mobileRangeTo = ref('')
const mobileRangeAnchor = ref(null)
const mobileRangeError = ref('')
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
// Mobile taps choose an inclusive range in original measure coordinates.
const selectMobileMeasure = index => {
  if (!Number.isInteger(index) || index < 0 || index >= measures.value.length) return
  mobileRangeError.value = ''
  if (mobileRangeAnchor.value === null) {
    mobileRangeAnchor.value = index
    selectedRangeStart.value = index
    selectedRangeEnd.value = index
  } else {
    selectedRangeStart.value = Math.min(mobileRangeAnchor.value,index)
    selectedRangeEnd.value = Math.max(mobileRangeAnchor.value,index)
    mobileRangeAnchor.value = null
  }
}
const applyMobileRange = () => {
  const from = Number(mobileRangeFrom.value), to = Number(mobileRangeTo.value)
  if (String(mobileRangeFrom.value).trim() === '' || String(mobileRangeTo.value).trim() === '' ||
      !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1 || from > measures.value.length || to > measures.value.length) {
    mobileRangeError.value = `Escribe números enteros entre 1 y ${measures.value.length}.`
    return false
  }
  selectedRangeStart.value = Math.min(from,to)-1
  selectedRangeEnd.value = Math.max(from,to)-1
  mobileRangeAnchor.value = null
  mobileRangeError.value = ''
  return true
}
watch([selectedRangeStart,selectedRangeEnd],([start,end]) => {
  mobileRangeFrom.value = start === null ? '' : Math.min(start,end ?? start)+1
  mobileRangeTo.value = end === null ? '' : Math.max(start ?? end,end)+1
})
const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  if (isMobileEditor.value) {mobileFocusedIndex.value = null; mobilePanel.value = null}
  clearSelection()
}
const clearSelection = () => {
  mobileRangeAnchor.value = null; mobileRangeError.value = ''; mobileRangeFrom.value = ''; mobileRangeTo.value = ''
  selectedRangeStart.value = null
  selectedRangeEnd.value = null
  isSelectionDragging.value = false
}

const copiedMeasures = ref(null)
const copiedMeasureIndexes = ref([])
const copiedMusicalTies = ref([])
const copiedLyricsTies = ref([])
const copySelectedMeasures = () => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  const start = minSelectedMeasure.value - 1, end = maxSelectedMeasure.value - 1
  copiedMeasureIndexes.value = Array.from({length:end-start+1},(_,i)=>start+i)
  copiedMeasures.value = JSON.parse(JSON.stringify(measures.value.slice(start,end+1)))
  copiedMusicalTies.value = [...tiedSlots.value]
  copiedLyricsTies.value = [...lyricsTiedSlots.value]
  showToast(`${copiedMeasures.value.length} compases copiados`)
}
const pasteCopiedMeasures = () => {
  if (!copiedMeasures.value?.length || selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  const targetStartIdx = minSelectedMeasure.value - 1, count = copiedMeasures.value.length
  if (!canGrowProjectTo(Math.max(measures.value.length,targetStartIdx+count))) return
  const copies = cloneMeasuresForPaste(copiedMeasures.value,copiedMeasureIndexes.value,targetStartIdx,()=>crypto.randomUUID())
  saveHistory()
  copies.forEach((copy,i)=>{
    const index=targetStartIdx+i
    // Keep the destination measure identity so repeat/layout references survive.
    if(index<measures.value.length)copy.id=measures.value[index].id
    measures.value[index]=copy
  })
  tiedSlots.value=pasteInternalTies(tiedSlots.value,copiedMusicalTies.value,copiedMeasureIndexes.value,targetStartIdx,count)
  lyricsTiedSlots.value=pasteInternalTies(lyricsTiedSlots.value,copiedLyricsTies.value,copiedMeasureIndexes.value,targetStartIdx,count)
  syncMeasuresBeats();clearSelection();showToast('Compases pegados con éxito')
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
  'silencio_corchea_2_semi': {
    label: 'Silencio de corchea - 2 Semicorcheas',
    slots: ['silence', 'merged', 'note', 'note'],
    icon: '𝄾 ♫'
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
  '2_semi_silencio_corchea': {
    label: '2 Semicorcheas - Silencio de corchea',
    slots: ['note', 'note', 'silence', 'merged'],
    icon: '♫ 𝄾'
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
  'semi_corchea_punto': {
    label: 'Semicorchea - Corchea con punto',
    slots: ['note', 'note', 'merged', 'merged'],
    icon: '♬ ♩.'
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
    label: '2 Corcheas',
    slots: ['note', 'note'],
    icon: '♫'
  },
  'silence_note': {
    label: 'Silencio de Corchea - Corchea',
    slots: ['silence', 'note'],
    icon: '𝄾 ♪'
  },
  'note_silence': {
    label: 'Corchea - Silencio de Corchea',
    slots: ['note', 'silence'],
    icon: '♪ 𝄾'
  }
}
const TRIPLET_PATTERNS = {
  '3_notes': {
    label: '3 Corcheas de Tresillo',
    slots: ['note', 'note', 'note'],
    icon: '3️⃣'
  },
  'silencia_1': {
    label: 'Silencio - 2 Corcheas',
    slots: ['silence', 'note', 'note'],
    icon: '𝄾 ♫'
  },
  'silencia_2': {
    label: 'Corchea - Silencio - Corchea',
    slots: ['note', 'silence', 'note'],
    icon: '♫ 𝄾 ♫'
  },
  'silencia_3': {
    label: '2 Corcheas - Silencio',
    slots: ['note', 'note', 'silence'],
    icon: '♫ 𝄾'
  },
  'silencia_1_3': {
    label: 'Silencio - Corchea - Silencio',
    slots: ['silence', 'note', 'silence'],
    icon: '𝄾 ♪ 𝄾'
  },
  'silencia_1_2': {
    label: 'Silencio de Negra - Corchea',
    slots: ['silence', 'merged', 'note'],
    icon: '𝄽 ♫'
  },
  'silencia_2_3': {
    label: 'Corchea - Silencio de Negra',
    slots: ['note', 'silence', 'merged'],
    icon: '♫ 𝄽'
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
const isSystemActiveOrHasActiveLyrics = (system) => {
  if (!system || !system.measures) return false
  const hasActiveChord = activeRhythmSelector.value &&
    system.measures.some(m => m.originalMeasureIndex === activeRhythmSelector.value.measureIndex)
  const hasActiveLyrics = activeLyricsRhythmSelector.value &&
    system.measures.some(m => m.originalMeasureIndex === activeLyricsRhythmSelector.value.measureIndex)
  return !!(hasActiveChord || hasActiveLyrics)
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
const selectTripletPattern = (measure, beat, patternKey) => {
  const pattern = TRIPLET_PATTERNS[patternKey]
  if (!pattern) return
  saveHistory()
  
  beat.harmonicRhythm = 'triplet'
  beat.tripletPattern = patternKey
  
  const newSubs = []
  for (let i = 0; i < 3; i++) {
    const slotType = pattern.slots[i]
    const isNote = slotType === 'note'
    
    newSubs.push({
      id: generateUniqueId(),
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
  } else if (rhythm === 'triplet') {
    selectTripletPattern(m, beat, patternKey)
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
    id: `${origMIdx}_${beatIdx}_${idx}`,
    originalIndex: idx,
    flexGrow: 1,
    isMerged: s.isMerged || false
  }))
  
  let visible = []
  if (rhythm === 'sixteenth' || rhythm === 'triplet') {
    for (let i = 0; i < states.length; i++) {
      if (states[i].isMerged) continue
      
      let flexGrow = 1
      let j = i + 1
      while (j < states.length && states[j].isMerged) {
        flexGrow++
        j++
      }
      
      states[i].flexGrow = flexGrow
      visible.push(states[i])
    }
  } else {
    visible = states
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
const selectTripletPatternInModal = (patternObj, patternKey) => {
  if (selectedBeat.value) {
    saveHistory()
    const { measureIndex, beatIndex } = selectedBeat.value
    const m = measures.value[measureIndex]
    const beat = m.beats[beatIndex]
    if (beat) {
      const newSubs = []
      for (let i = 0; i < 3; i++) {
        const slotType = patternObj.slots[i]
        const isNote = slotType === 'note'
        
        newSubs.push({
          id: generateUniqueId(),
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
      beat.tripletPattern = patternKey
      beat.harmonicRhythm = 'triplet'
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
  if (connectorUpdateTimer !== null) clearTimeout(connectorUpdateTimer)
  document.removeEventListener('click', closeDropdowns)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyDown)
  stopPlayback()
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
const modalInterchangeGroups = computed(() => {
  const { key: activeKey, scale: activeScale } = activeModalKeyAndScale.value
  const isTetrad = modalComplexity.value === 'tetrad'
  const rootIndex = NOTE_TO_INDEX[activeKey]
  if (rootIndex === undefined) return []

  const groups = []

  const createChord = (degreeNumeral, semitones, typeTriad, typeTetrad, suffixTriad, suffixTetrad) => {
    const rootName = getNoteName(rootIndex + semitones, activeKey)
    const type = isTetrad ? typeTetrad : typeTriad
    const suffix = isTetrad ? suffixTetrad : suffixTriad
    return {
      degreeNumeral,
      root: rootName,
      type,
      label: `${rootName}${suffix}`,
      isModalInterchange: true
    }
  }

  const isMajorFamily = ['major', 'lydian', 'mixolydian'].includes(activeScale)
  const isMinorFamily = ['minor', 'dorian', 'phrygian', 'locrian', 'harmonic_minor', 'melodic_minor'].includes(activeScale)

  if (isMajorFamily) {
    groups.push({
      id: 'aeolian',
      title: 'Menor Paralela (Eólico)',
      badge: 'Oscuro / Expresivo',
      chords: [
        createChord('v', 7, 'min', 'm7', 'm', 'm7'),
        createChord('♭VII', 10, 'maj', '7', '', '7'),
        createChord('iv', 5, 'min', 'm7', 'm', 'm7'),
        createChord('♭VI', 8, 'maj', 'maj7', '', 'maj7'),
        createChord('♭III', 3, 'maj', 'maj7', '', 'maj7'),
        createChord('iiø', 2, 'dim', 'm7b5', 'dim', 'm7b5')
      ]
    })

    groups.push({
      id: 'phrygian',
      title: 'Frigio & Napolitano',
      badge: 'Dramático / Tensión',
      chords: [
        createChord('♭II', 1, 'maj', 'maj7', '', 'maj7'),
        createChord('♭vii', 10, 'min', 'm7', 'm', 'm7')
      ]
    })

    groups.push({
      id: 'lydian',
      title: 'Lidio & Mayor de 2º Grado',
      badge: 'Luminoso / Brillante',
      chords: [
        createChord('II', 2, 'maj', '7', '', '7'),
        createChord('vii', 11, 'min', 'm7', 'm', 'm7')
      ]
    })

    groups.push({
      id: 'dorian',
      title: 'Dórico',
      badge: 'Jazz / Neo-Soul',
      chords: [
        createChord('IV7', 5, 'maj', '7', '', '7')
      ]
    })
  } else if (isMinorFamily) {
    groups.push({
      id: 'ionian',
      title: 'Mayor Paralela (Jónico)',
      badge: 'Brillante / Picardía',
      chords: [
        createChord('I', 0, 'maj', 'maj7', '', 'maj7'),
        createChord('IV', 5, 'maj', 'maj7', '', 'maj7'),
        createChord('V', 7, 'maj', '7', '', '7'),
        createChord('VIø', 9, 'dim', 'm7b5', 'dim', 'm7b5')
      ]
    })

    groups.push({
      id: 'harmonic',
      title: 'Menor Armónica & Melódica',
      badge: 'Tensión Dominante',
      chords: [
        createChord('V7', 7, 'maj', '7', '', '7'),
        createChord('vii°', 11, 'dim', 'dim7', 'dim', 'dim7'),
        createChord('IV7', 5, 'maj', '7', '', '7')
      ]
    })

    groups.push({
      id: 'phrygian',
      title: 'Frigio & Napolitano',
      badge: 'Misterioso',
      chords: [
        createChord('♭II', 1, 'maj', 'maj7', '', 'maj7')
      ]
    })
  }

  return groups
})

const modalInterchangeChords = computed(() => {
  return modalInterchangeGroups.value.flatMap(g => g.chords)
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
  
  let resolvedSubIndex = subdivisionIndex
  if (resolvedSubIndex === undefined && b) {
    const rhythm = getEffectiveRhythm(m, b, beatIndex)
    const sig = getMeasureTimeSignature(m)
    if (isSubdividedRhythm(rhythm, sig.unit === 8, b)) {
      const slots = getBeatSlots(m, b, beatIndex)
      const active = slots.find(s => !s.isSilence && !s.isMerged)
      resolvedSubIndex = active ? slots.indexOf(active) : 0
    }
  }
  
  applyToAllSubslots.value = b ? isSubdivisionCollapsed(m, b, beatIndex) : false
  
  selectedBeat.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex: resolvedSubIndex }
  selectedMeasureIndex.value = measureIndex
  
  let wasSet = false
  if (b) {
    const slots = getBeatSlots(m, b, beatIndex)
    if (resolvedSubIndex !== undefined && slots[resolvedSubIndex]) {
      wasSet = !!slots[resolvedSubIndex].root
    } else {
      wasSet = !!b.root
    }
  }
  
  wasBeatAlreadySet.value = wasSet
  activeTensionExplanation.value = null // Reset explanation
  loadChordIntoBuilder(activeEditingBeat.value)
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
        tensions: chordObj.tensions ? [...chordObj.tensions] : [],
        tension: chordObj.tension || null,
        bass: chordObj.bass || null,
        isSilence: !chordObj.root
      }
      
      const isOffbeat = rhythm === 'offbeat'
      if ((subdivisionIndex === 0 && !isOffbeat) || (subdivisionIndex === 1 && isOffbeat)) {
        beat.root = chordObj.root
        beat.type = chordObj.type
        beat.tensions = chordObj.tensions ? [...chordObj.tensions] : []
        beat.tension = chordObj.tension || null
        beat.bass = chordObj.bass || null
      }
      
      m.groove = 'custom'
    } else {
      m.beats[beatIndex] = {
        root: chordObj.root,
        type: chordObj.type,
        tensions: chordObj.tensions ? [...chordObj.tensions] : [],
        tension: chordObj.tension || null,
        bass: chordObj.bass || null
      }
    }
    activeTensionExplanation.value = null
    
    if (oldChord) {
      const newChord = {
        root: chordObj.root,
        type: chordObj.type,
        tension: chordObj.tension || null,
        bass: chordObj.bass || null,
        tensions: chordObj.tensions ? [...chordObj.tensions] : [],
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
const getBeatPatternKey = (beat, rhythm) => {
  if (!beat) return ''
  if (rhythm === 'sixteenth') return beat.sixteenthPattern || '4_semi'
  if (rhythm === 'eighth') return beat.eighthPattern || '2_notes'
  if (rhythm === 'triplet') return beat.tripletPattern || '3_notes'
  return ''
}
const getPatternLabel = (key, pat, isDenom8) => {
  if (isDenom8) {
    if (key === '2_notes') return '2 Semicorcheas'
    if (key === 'silence_note') return 'Silencio de Semicorchea - Semicorchea'
    if (key === 'note_silence') return 'Semicorchea - Silencio de Semicorchea'
  }
  return pat.label
}
const getLyricsBeatPatternKey = (beat, rhythm, measure = null, beatIdx = null) => {
  if (beat && beat.syncWithHarmonic && measure && beatIdx !== null) {
    const mainBeat = measure.beats[beatIdx]
    return getBeatPatternKey(mainBeat, rhythm)
  }
  if (!beat) return rhythm === 'triplet' ? '3_notes' : (rhythm === 'sixteenth' ? '4_semi' : (rhythm === 'eighth' ? '2_notes' : ''))
  if (rhythm === 'sixteenth') return beat.sixteenthPattern || '4_semi'
  if (rhythm === 'eighth') return beat.eighthPattern || '2_notes'
  if (rhythm === 'triplet') return beat.tripletPattern || '3_notes'
  return ''
}
const getDynamicRhythmSVG = (rhythmType, patternKey, visibleSlots, isDenom8 = false) => {
  if (!visibleSlots || visibleSlots.length === 0) {
    if (isDenom8) {
      if (rhythmType === 'two-eighths') return getRhythmIconSVG('2_notes')
      if (rhythmType === 'eighth') return getRhythmIconSVG('single-eighth')
    }
    return getRhythmIconSVG(rhythmType)
  }
  
  const totalFlex = visibleSlots.reduce((sum, s) => sum + s.flexGrow, 0)
  let currentFlex = 0
  const slotPoints = visibleSlots.map((s, idx) => {
    const width = (s.flexGrow / totalFlex) * 100
    const cx = ((currentFlex + s.flexGrow / 2) / totalFlex) * 100
    currentFlex += s.flexGrow
    return {
      cx,
      width,
      isSilence: s.isSilence,
      isMerged: s.isMerged,
      flexGrow: s.flexGrow,
      originalIndex: s.originalIndex
    }
  })
  
  const stemTopY = 5
  const noteY = 17
  let svg = ''
  
  // Helpers
  const getEighthRestPath = (cx) => {
    const x = cx - 4
    return `<line x1="${x + 6}" y1="6" x2="${x + 2}" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="${x + 2}" cy="9.5" r="1.3" fill="currentColor"/>
            <path d="M ${x + 2} 9.5 Q ${x + 4.5} 6.5 ${x + 6} 9" stroke="currentColor" stroke-width="1.2" fill="none"/>`
  }
  
  const getSixteenthRestPath = (cx) => {
    const x = cx - 4
    return `<line x1="${x + 6}" y1="4" x2="${x + 1.5}" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="${x + 2.5}" cy="7.5" r="1.3" fill="currentColor"/>
            <path d="M ${x + 2.5} 7.5 Q ${x + 4.5} 4.5 ${x + 6.5} 7.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <circle cx="${x + 0.5}" cy="12.5" r="1.3" fill="currentColor"/>
            <path d="M ${x + 0.5} 12.5 Q ${x + 2} 9.5 ${x + 4.5} 12.5" stroke="currentColor" stroke-width="1.2" fill="none"/>`
  }
  
  const getQuarterRestPath = (cx) => {
    return `<path d="M ${cx - 2.5} 5.5 L ${cx + 1.5} 9.5 L ${cx - 2} 13.5 C ${cx - 0.5} 15.5, ${cx + 2.5} 16.5, ${cx + 1} 19.5 C ${cx - 1} 22.5, ${cx - 3.5} 20, ${cx - 2.5} 17.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`
  }
  
  const getEighthFlagPath = (cx) => {
    return `<path d="M ${cx} ${stemTopY} Q ${cx + 7} ${stemTopY + 4} ${cx + 5} ${stemTopY + 10}" stroke="currentColor" stroke-width="1.3" fill="none"/>`
  }
  
  const getSixteenthFlagPath = (cx) => {
    return `<path d="M ${cx} ${stemTopY} Q ${cx + 7} ${stemTopY + 4} ${cx + 5} ${stemTopY + 9}" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <path d="M ${cx} ${stemTopY + 3.5} Q ${cx + 7} ${stemTopY + 7.5} ${cx + 5} ${stemTopY + 12.5}" stroke="currentColor" stroke-width="1.2" fill="none"/>`
  }
  
  // Draw rests and active note heads + stems
  const activePoints = []
  slotPoints.forEach((point) => {
    if (point.isSilence) {
      if (rhythmType === 'triplet' && point.flexGrow === 2) {
        svg += getQuarterRestPath(point.cx)
      } else if (rhythmType === 'triplet' || rhythmType === 'eighth' || rhythmType === 'offbeat') {
        if (isDenom8 && rhythmType === 'eighth') {
          svg += getSixteenthRestPath(point.cx)
        } else {
          svg += getEighthRestPath(point.cx)
        }
      } else if (rhythmType === 'sixteenth') {
        svg += getSixteenthRestPath(point.cx)
      }
    } else {
      activePoints.push(point)
      let r = 2.5
      let stemW = 1.5
      if (rhythmType === 'triplet') { r = 2.2; stemW = 1.3 }
      else if (rhythmType === 'sixteenth' || (isDenom8 && rhythmType === 'eighth')) { r = 2.0; stemW = 1.2 }
      else if (rhythmType === 'quintuplet') { r = 1.8; stemW = 1.0 }
      
      // Draw note head
      svg += `<circle cx="${point.cx}" cy="${noteY}" r="${r}" fill="currentColor"/>`
      // Draw stem
      svg += `<line x1="${point.cx}" y1="${noteY}" x2="${point.cx}" y2="${stemTopY}" stroke="currentColor" stroke-width="${stemW}"/>`
    }
  })
  
  // Draw beams or flags
  if (activePoints.length >= 2) {
    const xStart = activePoints[0].cx
    const xEnd = activePoints[activePoints.length - 1].cx
    
    let beamW = 2.5
    if (rhythmType === 'triplet') beamW = 2
    else if (rhythmType === 'sixteenth' || (isDenom8 && rhythmType === 'eighth')) beamW = 2
    else if (rhythmType === 'quintuplet') beamW = 1.8
    
    // Primary beam
    svg += `<line x1="${xStart}" y1="${stemTopY}" x2="${xEnd}" y2="${stemTopY}" stroke="currentColor" stroke-width="${beamW}"/>`
    
    // Secondary beam for sixteenth notes or eighths in denominator 8
    if (rhythmType === 'sixteenth' || (isDenom8 && rhythmType === 'eighth')) {
      svg += `<line x1="${xStart}" y1="${stemTopY + 3.5}" x2="${xEnd}" y2="${stemTopY + 3.5}" stroke="currentColor" stroke-width="${beamW}"/>`
    } else if (rhythmType === 'quintuplet') {
      svg += `<line x1="${xStart}" y1="${stemTopY + 3.0}" x2="${xEnd}" y2="${stemTopY + 3.0}" stroke="currentColor" stroke-width="1.8"/>`
    }
  } else if (activePoints.length === 1) {
    // Single active note -> draw flag
    const cx = activePoints[0].cx
    if (rhythmType === 'sixteenth' || (isDenom8 && rhythmType === 'eighth')) {
      svg += getSixteenthFlagPath(cx)
    } else {
      svg += getEighthFlagPath(cx)
    }
  }
  
  // Draw group text label (3 for triplets, 5 for quintuplets)
  if (rhythmType === 'triplet' && slotPoints.length >= 2) {
    const midX = (slotPoints[0].cx + slotPoints[slotPoints.length - 1].cx) / 2
    svg += `<text x="${midX}" y="${stemTopY - 1}" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`
  } else if (rhythmType === 'quintuplet' && slotPoints.length >= 2) {
    const midX = (slotPoints[0].cx + slotPoints[slotPoints.length - 1].cx) / 2
    svg += `<text x="${midX}" y="${stemTopY - 1}" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">5</text>`
  }
  
  return svg
}
const getQuarterRestSVG = (x) => {
  return `<path d="M ${x - 2.5} 5.5 L ${x + 1.5} 9.5 L ${x - 2} 13.5 C ${x - 0.5} 15.5, ${x + 2.5} 16.5, ${x + 1} 19.5 C ${x - 1} 22.5, ${x - 3.5} 20, ${x - 2.5} 17.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`;
}
const getRhythmIconSVG = (key, isDenom8 = false) => {
  if (isDenom8) {
    if (key === '2_notes') return getRhythmIconSVG('2_semi')
    if (key === 'silence_note') return getRhythmIconSVG('silence_semi_note')
    if (key === 'note_silence') return getRhythmIconSVG('semi_note_silence')
  }
  if (key === 'sixteenth') {
    return getRhythmIconSVG('4_semi')
  }
  if (key === '3_notes') {
    return getRhythmIconSVG('triplet')
  }
  if (key === 'two-eighths') {
    return getRhythmIconSVG('2_notes')
  }
  if (key === '2_semi') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="30" y1="5" x2="70" y2="5" stroke="currentColor" stroke-width="1.8"/>
            <line x1="30" y1="8" x2="70" y2="8" stroke="currentColor" stroke-width="1.3"/>`;
  }
  if (key === 'silence_semi_note') {
    return getSixteenthRestSVG(30) + 
           `<circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M 70 5 Q 75 9 74 14" stroke="currentColor" stroke-width="1.3" fill="none"/>
            <path d="M 70 8.5 Q 75 12.5 74 17.5" stroke="currentColor" stroke-width="1.3" fill="none"/>`;
  }
  if (key === 'semi_note_silence') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M 30 5 Q 35 9 34 14" stroke="currentColor" stroke-width="1.3" fill="none"/>
            <path d="M 30 8.5 Q 35 12.5 34 17.5" stroke="currentColor" stroke-width="1.3" fill="none"/>` +
           getSixteenthRestSVG(70);
  }
  if (key === 'single-eighth') {
    return `<circle cx="50" cy="17" r="2.5" fill="currentColor"/>
            <line x1="50" y1="17" x2="50" y2="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M 50 5 Q 55 9 54 14" stroke="currentColor" stroke-width="1.5" fill="none"/>`;
  }
  // Patrones de 2 notas (Eighth notes)
  if (key === '2_notes') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>
            <line x1="30" y1="5" x2="70" y2="5" stroke="currentColor" stroke-width="2"/>`;
  }
  if (key === 'silence_note') {
    return getEighthRestSVG(20) +
           `<circle cx="70" cy="17" r="2.2" fill="currentColor"/>
            <line x1="70" y1="17" x2="70" y2="5" stroke="currentColor" stroke-width="1.3"/>` +
            getEighthSingleFlagSVG(70);
  }
  if (key === 'note_silence') {
    return `<circle cx="30" cy="17" r="2.2" fill="currentColor"/>
            <line x1="30" y1="17" x2="30" y2="5" stroke="currentColor" stroke-width="1.3"/>` +
            getEighthSingleFlagSVG(30) +
            getEighthRestSVG(60);
  }
  // Figuras Básicas
  if (key === 'dotted-whole') {
    return `<ellipse cx="40" cy="12" rx="6" ry="4.5" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="53" cy="12" r="1.5" fill="currentColor"/>`;
  }
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
  // Silencios Básicos
  if (key === 'rest-dotted-whole') {
    return `<line x1="38" y1="12" x2="58" y2="12" stroke="currentColor" stroke-width="1.5"/>
            <rect x="42" y="12" width="12" height="4" fill="currentColor"/>
            <circle cx="63" cy="14" r="1.5" fill="currentColor"/>`;
  }
  if (key === 'rest-whole') {
    return `<line x1="40" y1="12" x2="60" y2="12" stroke="currentColor" stroke-width="1.5"/>
            <rect x="44" y="12" width="12" height="4" fill="currentColor"/>`;
  }
  if (key === 'rest-dotted-half') {
    return `<line x1="38" y1="12" x2="58" y2="12" stroke="currentColor" stroke-width="1.5"/>
            <rect x="42" y="8" width="12" height="4" fill="currentColor"/>
            <circle cx="63" cy="10" r="1.5" fill="currentColor"/>`;
  }
  if (key === 'rest-double') {
    return `<line x1="40" y1="12" x2="60" y2="12" stroke="currentColor" stroke-width="1.5"/>
            <rect x="44" y="8" width="12" height="4" fill="currentColor"/>`;
  }
  if (key === 'rest-dotted-quarter') {
    return getQuarterRestSVG(46) +
           `<circle cx="56" cy="15" r="1.5" fill="currentColor"/>`;
  }
  if (key === 'rest-quarter') {
    return getQuarterRestSVG(50);
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
  if (key === 'silencia_1') {
    return getEighthRestSVG(15) +
           `<circle cx="50" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="80" cy="17" r="2.2" fill="currentColor"/>
            <line x1="50" y1="17" x2="50" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="80" y1="17" x2="80" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="50" y1="6" x2="80" y2="6" stroke="currentColor" stroke-width="2"/>
            <text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'silencia_2') {
    return `<circle cx="20" cy="17" r="2.2" fill="currentColor"/>
            <line x1="20" y1="17" x2="20" y2="6" stroke="currentColor" stroke-width="1.3"/>` +
            getEighthRestSVG(45) +
           `<circle cx="80" cy="17" r="2.2" fill="currentColor"/>
            <line x1="80" y1="17" x2="80" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="20" y1="6" x2="80" y2="6" stroke="currentColor" stroke-width="2"/>
            <text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'silencia_3') {
    return `<circle cx="20" cy="17" r="2.2" fill="currentColor"/>
            <circle cx="50" cy="17" r="2.2" fill="currentColor"/>
            <line x1="20" y1="17" x2="20" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="50" y1="17" x2="50" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <line x1="20" y1="6" x2="50" y2="6" stroke="currentColor" stroke-width="2"/>` +
            getEighthRestSVG(75) +
           `<text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'silencia_1_3') {
    return getEighthRestSVG(15) +
           `<circle cx="50" cy="17" r="2.2" fill="currentColor"/>
            <line x1="50" y1="17" x2="50" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <path d="M 50 6 Q 57 10 55 16" stroke="currentColor" stroke-width="1.3" fill="none"/>` +
            getEighthRestSVG(75) +
           `<text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'silencia_1_2') {
    const cx = 35
    return `<path d="M ${cx - 2.5} 5.5 L ${cx + 1.5} 9.5 L ${cx - 2} 13.5 C ${cx - 0.5} 15.5, ${cx + 2.5} 16.5, ${cx + 1} 19.5 C ${cx - 1} 22.5, ${cx - 3.5} 20, ${cx - 2.5} 17.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
           `<circle cx="80" cy="17" r="2.2" fill="currentColor"/>
            <line x1="80" y1="17" x2="80" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <path d="M 80 6 Q 87 10 85 16" stroke="currentColor" stroke-width="1.3" fill="none"/>
            <text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
  }
  if (key === 'silencia_2_3') {
    const cx = 65
    return `<circle cx="20" cy="17" r="2.2" fill="currentColor"/>
            <line x1="20" y1="17" x2="20" y2="6" stroke="currentColor" stroke-width="1.3"/>
            <path d="M 20 6 Q 27 10 25 16" stroke="currentColor" stroke-width="1.3" fill="none"/>` +
            `<path d="M ${cx - 2.5} 5.5 L ${cx + 1.5} 9.5 L ${cx - 2} 13.5 C ${cx - 0.5} 15.5, ${cx + 2.5} 16.5, ${cx + 1} 19.5 C ${cx - 1} 22.5, ${cx - 3.5} 20, ${cx - 2.5} 17.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
           `<text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>`;
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
  if (key === 'silencio_corchea_2_semi') {
    return getEighthRestSVG(12.5) +
           `<circle cx="62.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
            <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="62.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
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
  if (key === '2_semi_silencio_corchea') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="37.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="37.5" y2="8.5" stroke="currentColor" stroke-width="2"/>` +
           getEighthRestSVG(62.5);
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
  if (key === 'semi_corchea_punto') {
    return `<circle cx="12.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
            <circle cx="44" cy="17" r="0.75" fill="currentColor"/>
            <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="12.5" y1="5" x2="37.5" y2="5" stroke="currentColor" stroke-width="2"/>
            <line x1="12.5" y1="8.5" x2="20" y2="8.5" stroke="currentColor" stroke-width="2"/>`;
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
  
  if (prevRhythm === rhythmType) {
    if (rhythmType === 'eighth' && isDenom8) {
      if (beat.eighthPattern) {
        saveHistory();
        delete beat.eighthPattern;
        delete beat.subdivisions;
        measure.groove = 'custom';
      }
    } else if (rhythmType === 'sixteenth') {
      if (beat.sixteenthPattern && beat.sixteenthPattern !== '4_semi') {
        saveHistory();
        beat.sixteenthPattern = '4_semi';
        const pat = SIXTEENTH_PATTERNS['4_semi'];
        beat.subdivisions = pat.slots.map(() => ({
          root: beat.root,
          type: beat.type,
          tensions: [...(beat.tensions || [])],
          tension: beat.tension,
          bass: beat.bass
        }));
        measure.groove = 'custom';
      }
    } else if (rhythmType === 'triplet') {
      if (beat.tripletPattern && beat.tripletPattern !== '3_notes') {
        saveHistory();
        beat.tripletPattern = '3_notes';
        const pat = TRIPLET_PATTERNS['3_notes'];
        beat.subdivisions = pat.slots.map(() => ({
          root: beat.root,
          type: beat.type,
          tensions: [...(beat.tensions || [])],
          tension: beat.tension,
          bass: beat.bass
        }));
        measure.groove = 'custom';
      }
    }
    return;
  }
  
  const isRest = rhythmType.startsWith('rest-');
  const baseRhythm = isRest ? rhythmType.substring(5) : rhythmType;
  
  beat.harmonicRhythm = rhythmType;
  
  if (isRest) {
    beat.isSilence = true;
    beat.root = '';
    beat.type = '';
    beat.tensions = [];
    beat.tension = null;
    beat.bass = null;
  } else {
    beat.isSilence = false;
  }
  
  const isSubdivided = isDenom8 
    ? (['sixteenth', 'triplet', 'quintuplet'].includes(baseRhythm) || (baseRhythm === 'eighth' && beat && beat.eighthPattern))
    : ['eighth', 'sixteenth', 'triplet', 'quintuplet', 'offbeat'].includes(baseRhythm);
  
  if (!isSubdivided) {
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
    let pat = null;
    if (baseRhythm === 'eighth') {
      subCount = 2;
      if (!isDenom8) {
        beat.eighthPattern = '2_notes';
      }
      pat = EIGHTH_PATTERNS['2_notes'];
    }
    else if (baseRhythm === 'sixteenth') {
      subCount = 4;
      beat.sixteenthPattern = '4_semi';
      pat = SIXTEENTH_PATTERNS['4_semi'];
    }
    else if (baseRhythm === 'triplet') {
      subCount = 3;
      beat.tripletPattern = '3_notes';
      pat = TRIPLET_PATTERNS['3_notes'];
    }
    else if (baseRhythm === 'offbeat') subCount = 2;
    else if (baseRhythm === 'quintuplet') subCount = 5;
    
    const existingSubs = beat.subdivisions || [];
    const newSubs = [];
    
    for (let i = 0; i < subCount; i++) {
      if (baseRhythm === 'offbeat' && i === 0) {
        newSubs.push({
          id: generateUniqueId(),
          root: '',
          type: '',
          tensions: [],
          tension: null,
          bass: null,
          isSilence: true
        });
      } else {
        let existing = existingSubs[i];
        
        let defaultIsNote = true;
        if (pat && pat.slots) {
          defaultIsNote = pat.slots[i] === 'note';
        } else if (baseRhythm === 'offbeat') {
          defaultIsNote = i === 1;
        } else {
          defaultIsNote = i === 0;
        }
        
        if (!existing && beat.root) {
          existing = {
            root: defaultIsNote ? beat.root : '',
            type: defaultIsNote ? beat.type : '',
            tensions: defaultIsNote ? [...(beat.tensions || [])] : [],
            tension: defaultIsNote ? beat.tension : null,
            bass: defaultIsNote ? beat.bass : null,
            isSilence: defaultIsNote ? (beat.isSilence || !beat.root) : true
          };
        }
        
        newSubs.push({
          id: existing?.id || generateUniqueId(),
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
    if (baseRhythm !== 'offbeat' && newSubs[0]) {
      beat.root = newSubs[0].root;
      beat.type = newSubs[0].type;
      beat.tensions = [...newSubs[0].tensions];
      beat.tension = newSubs[0].tension;
      beat.bass = newSubs[0].bass;
    } else if (baseRhythm === 'offbeat' && newSubs[1]) {
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
          isSilence: !beat.root || beat.isSilence || rhythm.startsWith('rest-')
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
// Read-only render/audio views share one traversal; mutation tools keep fresh lists.
const musicalRenderBlocks = computed(() => getLinearBlocks())
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
    const isSubdivided = shouldRenderAsSubdivided(measure, state.beat, bIdx)
    
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
  if (!measure || tiedSlots.value.size === 0) return paths
  const origMIdx = measure.originalMeasureIndex
  
  const coords = getMeasureBlockCoordinates(measure)
  const linearBlocks = musicalRenderBlocks.value
  
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
const getMeasureLyricsSlotCoordinates = (measure) => {
  const coords = []
  if (!measure) return coords
  const origMIdx = measure.originalMeasureIndex
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  
  const mergedBeats = getLyricsMergedBeats(measure)
  const totalWeight = numBeats // because sum of state.durationSlots = sig.beats
  
  let currentX = 0
  mergedBeats.forEach((state) => {
    if (state.isMerged) return
    const beatWidth = (state.durationSlots / totalWeight) * 1000
    const rhythm = getLyricsEffectiveRhythm(measure, state.beat, state.index)
    const isSubdivided = getLyricsBeatSlots(measure, state.beat, state.index).length > 0
    
    if (!isSubdivided) {
      coords.push({
        id: `lyrics_${origMIdx}_${state.index}`,
        x: currentX + beatWidth / 2,
        measureIndex: origMIdx,
        beatIndex: state.index,
        subdivisionIndex: null
      })
    } else {
      const visibleSlots = getLyricsVisibleSlotsForRender(measure, state.beat, state.index)
      const totalFlex = visibleSlots.reduce((sum, s) => sum + s.flexGrow, 0)
      let slotOffset = 0
      visibleSlots.forEach((sub) => {
        const slotWidth = (sub.flexGrow / totalFlex) * beatWidth
        coords.push({
          id: `lyrics_${origMIdx}_${state.index}_${sub.originalIndex}`,
          x: currentX + slotOffset + slotWidth / 2,
          measureIndex: origMIdx,
          beatIndex: state.index,
          subdivisionIndex: sub.originalIndex
        })
        slotOffset += slotWidth
      })
    }
    currentX += beatWidth
  })
  return coords
}
const getMeasureLyricsTiesPaths = (measure) => {
  const paths = []
  if (!measure || lyricsTiedSlots.value.size === 0) return paths
  const origMIdx = measure.originalMeasureIndex
  
  const coords = getMeasureLyricsSlotCoordinates(measure)
  const linearBlocks = lyricRenderBlocks.value
  
  coords.forEach((coord) => {
    const currentLinearIdx = linearBlocks.findIndex(b => b.id === coord.id)
    if (currentLinearIdx === -1) return
    
    const nextBlock = linearBlocks[currentLinearIdx + 1]
    if (nextBlock && lyricsTiedSlots.value.has(nextBlock.id)) {
      if (nextBlock.measureIndex === origMIdx) {
        const nextCoord = coords.find(c => c.id === nextBlock.id)
        if (nextCoord) {
          const startX = coord.x
          const endX = nextCoord.x
          
          paths.push({
            d: `M ${startX} 5 Q ${(startX + endX) / 2} 22 ${endX} 5`,
            type: 'internal'
          })
        }
      } else {
        const startX = coord.x
        paths.push({
          d: `M ${startX} 5 Q ${(startX + 1040) / 2} 22 1040 10`,
          type: 'outgoing'
        })
      }
    }
    
    if (lyricsTiedSlots.value.has(coord.id)) {
      const prevBlock = linearBlocks[currentLinearIdx - 1]
      if (prevBlock && prevBlock.measureIndex !== origMIdx) {
        const endX = coord.x
        paths.push({
          d: `M -40 10 Q ${(endX - 40) / 2} 22 ${endX} 5`,
          type: 'incoming'
        })
      }
    }
  })
  return paths
}
const validateTies = () => {
  if (tiedSlots.value.size === 0) return
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
  const currentIds = [...tiedSlots.value]
  if (newTies.size !== currentIds.length || [...newTies].some((id, index) => id !== currentIds[index])) {
    tiedSlots.value = newTies
  }
}
// Track musical structure, not syllable text; do not validate merely on tie creation.
const measureTieInputCache = new WeakMap()
const tieValidationInputs = computed(() => measures.value.map(m => {
  let input = measureTieInputCache.get(m)
  if (!input) {
    input = computed(() => JSON.stringify({
      id: m.id, timeSignature: m.timeSignature, grouping: m.grouping,
      showObligado: m.showObligado, showSubdivisions: m.showSubdivisions,
      groove: m.groove, beats: m.beats, lyricsBeats: m.lyrics?.beats
    }))
    measureTieInputCache.set(m, input)
  }
  return input.value
}))
watch(tieValidationInputs, () => {
  const beforeCount = tiedSlots.value.size
  validateTies()
  const afterCount = tiedSlots.value.size
  if (afterCount < beforeCount) {
    showToast("Ligado eliminado en este punto")
  }
  
  validateLyricsTies()
})
watch([timeSignature, timeSignatureUnit], () => {
  syncMeasuresBeats()
  const beforeCount = tiedSlots.value.size
  validateTies()
  const afterCount = tiedSlots.value.size
  if (afterCount < beforeCount) {
    showToast("Ligado eliminado en este punto")
  }
  
  validateLyricsTies()
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
  
  const m = measures.value[measureIndex]
  const b = m ? m.beats[beatIndex] : null
  
  let slotId = ''
  if (b && isSubdivisionCollapsed(m, b, beatIndex)) {
    const slots = getBeatSlots(m, b, beatIndex)
    slotId = `${measureIndex}_${beatIndex}_${slots.length - 1}`
  } else {
    slotId = subdivisionIndex !== undefined
      ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
      : `${measureIndex}_${beatIndex}`
  }
     
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
  
  const m = measures.value[measureIndex]
  const b = m ? m.beats[beatIndex] : null
  
  let slotId = ''
  if (b && isSubdivisionCollapsed(m, b, beatIndex)) {
    const slots = getBeatSlots(m, b, beatIndex)
    slotId = `${measureIndex}_${beatIndex}_${slots.length - 1}`
  } else {
    slotId = subdivisionIndex !== undefined
      ? `${measureIndex}_${beatIndex}_${subdivisionIndex}`
      : `${measureIndex}_${beatIndex}`
  }
     
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

const isSlotTiedFromPrev = (slotId) => {
  return tiedSlots.value.has(slotId)
}

const isSlotTiedToNext = (slotId) => {
  if (tiedSlots.value.size === 0) return false
  const linearBlocks = musicalRenderBlocks.value
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return false
  const nextBlock = linearBlocks[idx + 1]
  return nextBlock && tiedSlots.value.has(nextBlock.id)
}

const toggleTieBySlotId = (slotId) => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'feature'
    isUpgradeModalOpen.value = true
    return
  }
  saveHistory()
  const linearBlocks = getLinearBlocks()
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return
  
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
    showToast("Ligado creado")
  }
}
const getBeatSlots = (measure, beat, beatIdx) => {
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const subCount = getSubdivisionCount(rhythm, sig?.unit === 8, beat)
  
  if (subCount === 1) return []
  
  if (!beat.subdivisions || beat.subdivisions.length !== subCount) {
    const slots = []
    const patKey = rhythm === 'triplet' ? (beat.tripletPattern || '3_notes') : 
                   (rhythm === 'eighth' ? (beat.eighthPattern || '2_notes') :
                   (rhythm === 'sixteenth' ? (beat.sixteenthPattern || '4_semi') : null))
    
    const pat = patKey ? (rhythm === 'triplet' ? TRIPLET_PATTERNS[patKey] :
                          (rhythm === 'eighth' ? EIGHTH_PATTERNS[patKey] :
                           (rhythm === 'sixteenth' ? SIXTEENTH_PATTERNS[patKey] : null))) : null
    
    for (let i = 0; i < subCount; i++) {
      if (pat) {
        const slotType = pat.slots[i]
        const isNote = slotType === 'note'
        slots.push({
          id: generateUniqueId(),
          root: isNote ? beat.root : '',
          type: isNote ? beat.type : '',
          tensions: isNote ? [...(beat.tensions || [])] : [],
          tension: isNote ? beat.tension : null,
          bass: isNote ? beat.bass : null,
          isSilence: slotType === 'silence',
          isMerged: slotType === 'merged'
        })
      } else if (rhythm === 'offbeat' && i === 0) {
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
  if (rhythm === 'two-eighths') return '2 Corcheas'
  if (rhythm === 'eighth') return 'Corchea'
  if (rhythm === 'sixteenth') return 'Semicorcheas'
  if (rhythm === 'offbeat') return 'Contratiempo'
  if (rhythm === 'triplet') return 'Tresillo'
  if (rhythm === 'quintuplet') return 'Quintillo'
  if (rhythm === 'auto') return 'Automático'
  if (rhythm === 'dotted-whole') return 'Redonda con Punto'
  if (rhythm === 'whole') return 'Redonda'
  if (rhythm === 'dotted-half') return 'Blanca con Punto'
  if (rhythm === 'double') return 'Blanca'
  if (rhythm === 'dotted-quarter') return 'Negra con Punto'
  if (rhythm === 'quarter') return 'Negra'
  
  if (rhythm === 'rest-dotted-whole') return 'Silencio de Redonda con Punto'
  if (rhythm === 'rest-whole') return 'Silencio de Redonda'
  if (rhythm === 'rest-dotted-half') return 'Silencio de Blanca con Punto'
  if (rhythm === 'rest-double') return 'Silencio de Blanca'
  if (rhythm === 'rest-dotted-quarter') return 'Silencio de Negra con Punto'
  if (rhythm === 'rest-quarter') return 'Silencio de Negra'
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
  measures.value.forEach(m => {
    m.showSubdivisions = on
  })
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
const toggleLocalSubdivisions = (event) => {
  const on = event.target.checked
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'ritmo_armonico'
    isUpgradeModalOpen.value = true
    event.target.checked = false
    return
  }
  tempShowSubdivisions.value = on
}
const toggleLocalObligado = (event) => {
  const on = event.target.checked
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'ritmo_armonico'
    isUpgradeModalOpen.value = true
    event.target.checked = false
    return
  }
  tempShowObligado.value = on
}
const saveMeasureOptions = (onlyThisMeasure = true) => {
  if (selectedMeasureIndex.value !== null) {
    saveHistory()
    const startIdx = selectedMeasureIndex.value
    const endIdx = onlyThisMeasure ? startIdx : measures.value.length - 1

    for (let i = startIdx; i <= endIdx; i++) {
      const m = measures.value[i]
      if (!m) continue

      if (i === startIdx) {
        m.sectionLabel = tempSectionLabel.value === 'Ninguna' ? null : tempSectionLabel.value
      }
      m.showSubdivisions = tempShowSubdivisions.value
      m.showObligado = tempShowObligado.value
      
      const prevGroove = m.groove || 'global'
      if (tempMeasureGroove.value !== prevGroove) {
        m.groove = tempMeasureGroove.value
        
        if (tempMeasureGroove.value === 'global' || tempMeasureGroove.value === 'neutral') {
          m.beats.forEach(beat => {
            beat.harmonicRhythm = 'auto'
            delete beat.subdivisions
          })
        }
      }
    }
    syncMeasuresBeats()
    const scopeMsg = onlyThisMeasure ? "sólo a este compás" : "a partir de este compás"
    showToast(`Opciones de compás aplicadas ${scopeMsg}`)
  }
  isMeasureOptionsOpen.value = false
}
const openTimesSelector = () => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  customTimes.value = 2
  isTimesModalOpen.value = true
}
const confirmTimes = (timesVal) => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  const times = Number(timesVal)
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  const retainedRepeats = repeats.value.filter(r => {
    const rEnd = r.type === 'casilla' ? Math.max(r.endMeasure, r.casilla2End) : r.endMeasure
    return !(Math.max(r.startMeasure, start) <= Math.min(rEnd, end))
  })
  try {
    buildExpandedSequence(measuresWithKey.value, [...retainedRepeats, {type: 'simple', startMeasure: start, endMeasure: end, times}])
  } catch (error) {
    showToast(error.message)
    return
  }
  saveHistory()
  repeats.value = retainedRepeats

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
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  
  // Find repeat that covers the selected end measure (handles both full range and single-last-measure selection)
  const rep = repeats.value.find(r => r.type === 'simple' && r.startMeasure <= end && r.endMeasure >= end)
  if (!rep) return
  if (!canGrowProjectTo(Math.max(measures.value.length, rep.endMeasure + 1))) return
  const candidate = {...rep, type: 'casilla', casilla1Start: start, casilla2Start: rep.endMeasure + 1, casilla2End: rep.endMeasure + 1}
  try {
    const previewMeasures = measures.value.length < candidate.casilla2End ? [...measuresWithKey.value, {id: 'pending-casilla'}] : measuresWithKey.value
    buildExpandedSequence(previewMeasures, repeats.value.map(r => r === rep ? candidate : r))
  } catch (error) {
    showToast(error.message)
    return
  }
  saveHistory()
  
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
const canGrowProjectTo = (length) => {
  // Existing larger projects are preserved; an overwrite need not grow them.
  if (length <= measures.value.length) return true
  const limit = currentPlan.value === 'PRO' ? PRO_MEASURE_LIMIT : FREE_MEASURE_LIMIT
  if (!Number.isSafeInteger(length) || length > limit) {
    if (currentPlan.value === 'FREE') {
      upgradeReason.value = 'limit'
      isUpgradeModalOpen.value = true
    } else showToast(`El proyecto admite hasta ${limit} compases. Tu composición se conserva.`)
    return false
  }
  return true
}
const addMeasure = () => {
  if (!canGrowProjectTo(measures.value.length + 1)) return
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
// --- SPANISH SYLLABIFICATION ENGINE ---
const splitWordIntoSyllables = (word) => {
  if (!word) return []
  const cleanWord = word.replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ]/g, '')
  if (!cleanWord) return [word]
  
  const vowels = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ'
  const openVowels = 'aeoáéóAEOÁÉÓ'
  const accentedClosedVowels = 'íúÍÚ'
  
  const chars = cleanWord.split('')
  
  const sequences = []
  let currentSeq = null
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const isV = vowels.includes(char) || (char.toLowerCase() === 'y' && (i === chars.length - 1 || !vowels.includes(chars[i+1])))
    if (isV) {
      if (!currentSeq) {
        currentSeq = { start: i, text: char }
      } else {
        currentSeq.text += char
      }
    } else {
      if (currentSeq) {
        sequences.push(currentSeq)
        currentSeq = null
      }
    }
  }
  if (currentSeq) {
    sequences.push(currentSeq)
  }
  
  if (sequences.length <= 1) {
    return [word]
  }
  
  const nuclei = []
  sequences.forEach((seq) => {
    if (seq.text.length === 1) {
      nuclei.push({ start: seq.start, end: seq.start + 1, text: seq.text })
      return
    }
    
    let i = 0
    let startIdx = seq.start
    while (i < seq.text.length) {
      if (i === seq.text.length - 1) {
        nuclei.push({ start: startIdx, end: seq.start + seq.text.length, text: seq.text.substring(startIdx - seq.start) })
        break
      }
      
      const v1 = seq.text[i]
      const v2 = seq.text[i + 1]
      
      const isOpen1 = openVowels.includes(v1)
      const isOpen2 = openVowels.includes(v2)
      const isAccentedClosed1 = accentedClosedVowels.includes(v1)
      const isAccentedClosed2 = accentedClosedVowels.includes(v2)
      
      let hiatus = false
      if (isOpen1 && isOpen2) {
        hiatus = true
      } else if (isOpen1 && isAccentedClosed2) {
        hiatus = true
      } else if (isAccentedClosed1 && isOpen2) {
        hiatus = true
      }
      
      if (hiatus) {
        nuclei.push({ start: startIdx, end: seq.start + i + 1, text: seq.text.substring(startIdx - seq.start, i + 1) })
        startIdx = seq.start + i + 1
      }
      i++
    }
  })
  
  if (nuclei.length <= 1) {
    return [word]
  }
  
  const splitPoints = []
  for (let k = 0; k < nuclei.length - 1; k++) {
    const n1 = nuclei[k]
    const n2 = nuclei[k + 1]
    
    const consStart = n1.end
    const consEnd = n2.start
    const consLen = consEnd - consStart
    
    if (consLen === 0) {
      splitPoints.push(consStart)
    } else {
      const consText = cleanWord.substring(consStart, consEnd).toLowerCase()
      if (consLen === 1) {
        splitPoints.push(consStart)
      } else if (consLen === 2) {
        const isBlend = /^(ch|ll|rr|br|cr|dr|fr|gr|pr|tr|bl|cl|fl|gl|pl)$/.test(consText)
        if (isBlend) {
          splitPoints.push(consStart)
        } else {
          splitPoints.push(consStart + 1)
        }
      } else if (consLen === 3) {
        const lastTwo = consText.substring(1)
        const isBlend = /^(ch|ll|rr|br|cr|dr|fr|gr|pr|tr|bl|cl|fl|gl|pl)$/.test(lastTwo)
        if (isBlend) {
          splitPoints.push(consStart + 1)
        } else {
          splitPoints.push(consStart + 2)
        }
      } else if (consLen === 4) {
        splitPoints.push(consStart + 2)
      } else {
        splitPoints.push(consStart + Math.floor(consLen / 2))
      }
    }
  }
  
  const syllables = []
  let prevSplit = 0
  splitPoints.forEach((point) => {
    syllables.push(cleanWord.substring(prevSplit, point))
    prevSplit = point
  })
  syllables.push(cleanWord.substring(prevSplit))
  
  const prefixMatch = word.match(/^[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]+/)
  const suffixMatch = word.match(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]+$/)
  if (prefixMatch) {
    syllables[0] = prefixMatch[0] + syllables[0]
  }
  if (suffixMatch) {
    syllables[syllables.length - 1] = syllables[syllables.length - 1] + suffixMatch[0]
  }
  
  return syllables
}
const getSyllableListForMeasure = (measure) => {
  const text = measure.lyrics?.rawText || ''
  if (!text.trim()) return []
  
  const words = text.trim().split(/\s+/)
  const list = []
  let wordIdx = 0
  words.forEach((word) => {
    const cleanWord = word.trim()
    if (!cleanWord) return
    
    let syllables = []
    if (cleanWord.includes('-')) {
      syllables = cleanWord.split('-').filter(s => s.trim() !== '')
    } else {
      syllables = [cleanWord]
    }
    
    syllables.forEach((s) => {
      list.push({
        text: s,
        wordId: `w_${wordIdx}`
      })
    })
    wordIdx++
  })
  return list
}
const getSyllableSuggestionsForMeasure = (measure) => {
  const text = measure.lyrics?.rawText || ''
  if (!text.trim()) return null
  
  const words = text.trim().split(/\s+/)
  const suggestedWords = words.map(word => {
    if (word.includes('-')) return word
    const syllables = splitWordIntoSyllables(word)
    return syllables.join('-')
  })
  
  const suggestedText = suggestedWords.join(' ')
  if (suggestedText === text) return null
  
  return suggestedText
}
const applySyllableSuggestion = (measure) => {
  const suggestion = measure.lyrics?.syllableSuggestion
  if (suggestion) {
    saveHistory()
    measure.lyrics.rawText = suggestion
    measure.lyrics.ignoreSuggestion = true
  }
}
const hasHyphensOrCommas = (text) => {
  if (!text) return false
  return text.includes('-') || text.includes(',')
}
const applySyllableSuggestionToAllMeasures = () => {
  saveHistory()
  measures.value.forEach(m => {
    if (m.lyrics && m.lyrics.rawText) {
      const suggestion = m.lyrics.syllableSuggestion
      if (suggestion) {
        m.lyrics.rawText = suggestion
        m.lyrics.ignoreSuggestion = true
      }
    }
  })
  showToast("División de sílabas aplicada a todos los compases")
}
const getMeasureChordsTotalDuration = (measure) => {
  if (!measure) return 0
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  let total = 0
  
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
      total += dur
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
    } else {
      total += 1
    }
  }
  return total
}
const getMeasureLyricsTotalDuration = (measure) => {
  if (!measure || !measure.lyrics || !measure.lyrics.beats) return 0
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  let total = 0
  
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.lyrics.beats[i] || { id: generateUniqueId(), harmonicRhythm: 'auto', subdivisions: [] },
    isMerged: false
  }))
  
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    const beat = states[i].beat
    const dur = getLyricsBeatSlotDuration(measure, beat, i)
    total += dur
    for (let j = 1; j < dur; j++) {
      if (i + j < numBeats) {
        states[i + j].isMerged = true
      }
    }
  }
  return total
}
const getMeasureCapacityExceededMessage = (measure) => {
  if (!measure) return null
  const sig = getMeasureTimeSignature(measure)
  const capacity = sig.beats
  
  const chordsTotal = getMeasureChordsTotalDuration(measure)
  const lyricsTotal = getMeasureLyricsTotalDuration(measure)
  
  if (chordsTotal > capacity || lyricsTotal > capacity) {
    if (sig.unit === 8) {
      return `no es posible sumar más de ${capacity} corcheas en un compás de ${sig.beats}/8`
    } else {
      return `no es posible sumar más de ${capacity} tiempos en un compás de ${sig.beats}/4`
    }
  }
  return null
}
const isLyricsFigureValid = (rhythmType, measure, beatIdx) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  const duration = getRhythmFigureDuration(rhythmType, isDenom8)
  
  if (beatIdx + duration > sig.beats) {
    return false
  }
  
  const numBeats = sig.beats
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.lyrics?.beats?.[i] || { id: generateUniqueId(), harmonicRhythm: 'auto', subdivisions: [] },
    isMerged: false
  }))
  
  let usedOthers = 0
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    if (i >= beatIdx && i < beatIdx + duration) continue
    
    const beat = states[i].beat
    if (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto') {
      const dur = getLyricsBeatSlotDuration(measure, beat, i)
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
      usedOthers += dur
    }
  }
  
  if (states[beatIdx].isMerged) {
    return false
  }
  
  return duration <= (sig.beats - usedOthers)
}
// --- TIMELINE TICK GENERATOR & GRID SYNC (DECOUPLED LYRICS GRIDS) ---
const getLyricsEffectiveRhythm = (measure, beat, beatIdx) => {
  if (!beat) return 'quarter'
  if (beat.syncWithHarmonic) {
    const mainBeat = measure?.beats?.[beatIdx]
    return getEffectiveRhythm(measure, mainBeat, beatIdx)
  }
  
  const rhythm = beat.harmonicRhythm || 'auto'
  if (rhythm !== 'auto') return rhythm
  
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig?.unit === 8
  const defaultRhythm = isDenom8 ? 'eighth' : 'quarter'
  
  const mGroove = measure?.groove || 'global'
  const activeGrooveName = mGroove === 'global' ? globalGroove.value : mGroove
  if (activeGrooveName === 'Ninguno' || activeGrooveName === 'neutral' || mGroove === 'neutral' || mGroove === 'custom') {
    return defaultRhythm
  }
  
  const pattern = GROOVE_PATTERNS[activeGrooveName]
  if (pattern && pattern[beatIdx]) {
    const grooveRhythm = pattern[beatIdx]
    if (isDenom8 && grooveRhythm === 'quarter') {
      return 'eighth'
    }
    return grooveRhythm
  }
  
  return defaultRhythm
}
const getLyricsBeatSlots = (measure, beat, beatIdx) => {
  if (beat && beat.syncWithHarmonic) {
    const mainBeat = measure.beats[beatIdx]
    if (!mainBeat) return []
    const rhythm = getEffectiveRhythm(measure, mainBeat, beatIdx)
    const sig = getMeasureTimeSignature(measure)
    const subCount = getSubdivisionCount(rhythm, sig?.unit === 8, mainBeat)
    if (subCount === 1) return []
    
    if (!beat.subdivisions || beat.subdivisions.length !== subCount) {
      const slots = []
      const patKey = rhythm === 'triplet' ? (mainBeat.tripletPattern || '3_notes') : 
                     (rhythm === 'eighth' ? (mainBeat.eighthPattern || '2_notes') :
                     (rhythm === 'sixteenth' ? (mainBeat.sixteenthPattern || '4_semi') : null))
      
      const pat = patKey ? (rhythm === 'triplet' ? TRIPLET_PATTERNS[patKey] :
                            (rhythm === 'eighth' ? EIGHTH_PATTERNS[patKey] :
                             (rhythm === 'sixteenth' ? SIXTEENTH_PATTERNS[patKey] : null))) : null
      
      for (let i = 0; i < subCount; i++) {
        if (pat) {
          const slotType = pat.slots[i]
          slots.push({
            id: generateUniqueId(),
            isSilence: slotType === 'silence',
            isMerged: slotType === 'merged'
          })
        } else if (rhythm === 'offbeat' && i === 0) {
          slots.push({ id: generateUniqueId(), isSilence: true })
        } else {
          slots.push({
            id: generateUniqueId(),
            isSilence: false
          })
        }
      }
      beat.subdivisions = slots
    }
    
    beat.subdivisions.forEach(s => {
      if (!s.id) s.id = generateUniqueId()
    })
    
    return beat.subdivisions
  }
  
  if (!beat) {
    const rhythm = getLyricsEffectiveRhythm(measure, beat, beatIdx)
    const sig = getMeasureTimeSignature(measure)
    const subCount = getSubdivisionCount(rhythm, sig?.unit === 8, beat)
    if (subCount === 1) return []
    return Array.from({ length: subCount }, () => ({
      id: generateUniqueId(),
      isSilence: false,
      isMerged: false
    }))
  }
  const rhythm = getLyricsEffectiveRhythm(measure, beat, beatIdx)
  const sig = getMeasureTimeSignature(measure)
  const subCount = getSubdivisionCount(rhythm, sig?.unit === 8, beat)
  
  if (subCount === 1) return []
  
  if (!beat.subdivisions || beat.subdivisions.length !== subCount) {
    const slots = []
    const patKey = rhythm === 'triplet' ? (beat.tripletPattern || '3_notes') : 
                   (rhythm === 'eighth' ? (beat.eighthPattern || '2_notes') :
                   (rhythm === 'sixteenth' ? (beat.sixteenthPattern || '4_semi') : null))
    
    const pat = patKey ? (rhythm === 'triplet' ? TRIPLET_PATTERNS[patKey] :
                          (rhythm === 'eighth' ? EIGHTH_PATTERNS[patKey] :
                           (rhythm === 'sixteenth' ? SIXTEENTH_PATTERNS[patKey] : null))) : null
    
    for (let i = 0; i < subCount; i++) {
      if (pat) {
        const slotType = pat.slots[i]
        slots.push({
          id: generateUniqueId(),
          isSilence: slotType === 'silence',
          isMerged: slotType === 'merged'
        })
      } else if (rhythm === 'offbeat' && i === 0) {
        slots.push({ id: generateUniqueId(), isSilence: true })
      } else {
        slots.push({
          id: generateUniqueId(),
          isSilence: false
        })
      }
    }
    beat.subdivisions = slots
  }
  
  beat.subdivisions.forEach(s => {
    if (!s.id) s.id = generateUniqueId()
  })
  
  return beat.subdivisions
}
const getLyricsVisibleSlotsForRender = (measure, beat, beatIdx) => {
  const slots = getLyricsBeatSlots(measure, beat, beatIdx)
  const origMIdx = measure.originalMeasureIndex
  
  const states = slots.map((s, idx) => ({
    ...s,
    originalIndex: idx,
    flexGrow: 1,
    isMerged: s.isMerged || false
  }))
  
  const fused = []
  for (let i = 0; i < states.length; i++) {
    let current = states[i]
    let j = i + 1
    while (j < states.length) {
      const next = states[j]
      const nextSlotId = `lyrics_${origMIdx}_${beatIdx}_${next.originalIndex}`
      if (lyricsTiedSlots.value.has(nextSlotId)) {
        current.flexGrow += next.flexGrow
        j++
      } else {
        break
      }
    }
    fused.push(current)
    i = j - 1
  }
  
  return fused
}
const getLyricsBeatSlotDuration = (measure, beat, beatIdx) => {
  const sig = getMeasureTimeSignature(measure)
  const isDenom8 = sig.unit === 8
  const rhythm = beat ? (beat.harmonicRhythm || 'auto') : 'auto'
  const resolvedRhythm = rhythm === 'auto' ? getLyricsEffectiveRhythm(measure, beat, beatIdx) : rhythm
  const isRest = resolvedRhythm.startsWith('rest-')
  const baseRhythm = isRest ? resolvedRhythm.substring(5) : resolvedRhythm
  
  if (isDenom8) {
    if (baseRhythm === 'dotted-whole') return 12
    if (baseRhythm === 'whole') return 8
    if (baseRhythm === 'dotted-half') return 6
    if (baseRhythm === 'double') return 4
    if (baseRhythm === 'dotted-quarter') return 3
    if (baseRhythm === 'quarter') return 2
    if (baseRhythm === 'two-eighths') return 2
    if (baseRhythm === 'sixteenth') return 2
    if (baseRhythm === 'eighth') return 1
    if (baseRhythm === 'triplet') return 2
    return 1
  } else {
    if (baseRhythm === 'dotted-whole') return 6
    if (baseRhythm === 'whole') return 4
    if (baseRhythm === 'dotted-half') return 3
    if (baseRhythm === 'double') return 2
    if (baseRhythm === 'dotted-quarter') return 1.5
    if (baseRhythm === 'quarter') return 1
    return 1
  }
}
const toggleSyncWithHarmonic = (measure, beat, beatIdx) => {
  if (!beat) return
  saveHistory()
  beat.syncWithHarmonic = !beat.syncWithHarmonic
  if (beat.syncWithHarmonic) {
    const mainBeat = measure.beats[beatIdx]
    if (mainBeat) {
      beat.sixteenthPattern = mainBeat.sixteenthPattern
      beat.eighthPattern = mainBeat.eighthPattern
      beat.tripletPattern = mainBeat.tripletPattern
    }
  }
  beat.subdivisions = []
  syncRhythmLyricsTimeline(measure)
  activeLyricsRhythmSelector.value = null
}
const getLyricsMergedBeats = (measure) => {
  if (!measure) return []
  const sig = getMeasureTimeSignature(measure)
  const numBeats = sig.beats
  
  const states = Array.from({ length: numBeats }, (_, i) => ({
    index: i,
    beat: measure.lyrics?.beats?.[i] || { id: generateUniqueId(), harmonicRhythm: 'auto', subdivisions: [] },
    isMerged: false,
    durationSlots: 1
  }))
  
  for (let i = 0; i < numBeats; i++) {
    if (states[i].isMerged) continue
    const beat = states[i].beat
    const dur = getLyricsBeatSlotDuration(measure, beat, i)
    states[i].durationSlots = dur
    for (let j = 1; j < dur; j++) {
      if (i + j < numBeats) {
        states[i + j].isMerged = true
      }
    }
  }
  
  return states
}
const getMeasureLyricsRhythmSlots = (measure) => {
  if (!measure || !measure.lyrics || !measure.lyrics.beats) return []
  const sig = getMeasureTimeSignature(measure)
  const beatTicks = Math.round((4 / sig.unit) * 480)
  const origMIdx = measure.originalMeasureIndex
  
  const slots = []
  const mergedBeats = getLyricsMergedBeats(measure)
  
  mergedBeats.forEach((state) => {
    if (state.isMerged) return
    
    const beat = state.beat
    const bIdx = state.index
    const rhythm = getLyricsEffectiveRhythm(measure, beat, bIdx)
    const isSubdivided = getLyricsBeatSlots(measure, beat, bIdx).length > 0
    
    const beatStartTick = bIdx * beatTicks
    const slotDurationTicks = beatTicks * state.durationSlots
    
    if (!isSubdivided) {
      slots.push({
        id: `lyrics_${origMIdx}_${bIdx}`,
        measureIndex: origMIdx,
        beatIndex: bIdx,
        subdivisionIndex: null,
        startTick: beatStartTick,
        durationTicks: slotDurationTicks,
        isSilence: beat.isSilence,
        rhythmFigure: rhythm
      })
    } else {
      const subSlots = getLyricsBeatSlots(measure, beat, bIdx)
      const subCount = subSlots.length
      const subDurationTicks = Math.round(slotDurationTicks / subCount)
      
      subSlots.forEach((sub, sIdx) => {
        slots.push({
          id: `lyrics_${origMIdx}_${bIdx}_${sIdx}`,
          measureIndex: origMIdx,
          beatIndex: bIdx,
          subdivisionIndex: sIdx,
          startTick: beatStartTick + sIdx * subDurationTicks,
          durationTicks: subDurationTicks,
          isSilence: sub.isSilence,
          rhythmFigure: rhythm
        })
      })
    }
  })
  
  return slots
}
const isLyricsSlotSilence = (measure, beatIdx, subIdx) => {
  if (!measure || !measure.lyrics || !measure.lyrics.beats) return false
  const beat = measure.lyrics.beats[beatIdx]
  if (!beat) return false
  if (subIdx === null || subIdx === undefined) {
    return beat.isSilence || false
  }
  if (beat.subdivisions && beat.subdivisions[subIdx]) {
    return beat.subdivisions[subIdx].isSilence || false
  }
  return false
}
const getLyricsLinearBlocks = () => {
  const list = []
  measures.value.forEach((measure, mIdx) => {
    if (!measure.lyrics || !measure.lyrics.beats) return
    const sig = getMeasureTimeSignature(mIdx)
    const mergedBeats = getLyricsMergedBeats(measure)
    
    mergedBeats.forEach((state) => {
      if (state.isMerged) return
      
      const beat = state.beat
      const bIdx = state.index
      const rhythm = getLyricsEffectiveRhythm(measure, beat, bIdx)
      const isSubdivided = getLyricsBeatSlots(measure, beat, bIdx).length > 0
      
      if (!isSubdivided) {
        list.push({
          type: 'beat',
          measureIndex: mIdx,
          beatIndex: bIdx,
          subdivisionIndex: null,
          rhythm,
          id: `lyrics_${mIdx}_${bIdx}`,
          durationSlots: state.durationSlots,
          isSilence: beat.isSilence || false
        })
      } else {
        const slots = getLyricsBeatSlots(measure, beat, bIdx)
        slots.forEach((sub, sIdx) => {
          list.push({
            type: 'subdivision',
            measureIndex: mIdx,
            beatIndex: bIdx,
            subdivisionIndex: sIdx,
            rhythm,
            id: `lyrics_${mIdx}_${bIdx}_${sIdx}`,
            durationSlots: 1,
            isSilence: sub.isSilence || false
          })
        })
      }
    })
  })
  return list
}
const lyricRenderBlocks = computed(() => getLyricsLinearBlocks())
const syncRhythmLyricsTimeline = (measure) => {
  if (!measure || !measure.lyrics || measure.lyrics.mode !== 'rhythm') return
  if (!measure.lyrics.syllables) measure.lyrics.syllables = []
  
  const slots = getMeasureLyricsRhythmSlots(measure)
  const nonSilenceSlots = slots.filter(s => !s.isSilence)
  const slotMap = new Map(nonSilenceSlots.map(s => [s.id, s]))
  const linearBlocks = lyricsTiedSlots.value.size > 0 ? getLyricsLinearBlocks() : []
  
  measure.lyrics.syllables.forEach((syl) => {
    if (syl.rhythmEventId) {
      let slot = slotMap.get(syl.rhythmEventId)
      if (!slot) {
        if (syl.startTick !== null && nonSilenceSlots.length > 0) {
          let closestSlot = nonSilenceSlots[0]
          let minDiff = Math.abs(nonSilenceSlots[0].startTick - syl.startTick)
          
          for (let i = 1; i < nonSilenceSlots.length; i++) {
            const diff = Math.abs(nonSilenceSlots[i].startTick - syl.startTick)
            if (diff < minDiff) {
              minDiff = diff
              closestSlot = nonSilenceSlots[i]
            }
          }
          
          syl.rhythmEventId = closestSlot.id
          slot = closestSlot
        }
      }
      
      if (slot) {
        syl.startTick = slot.startTick
        syl.durationTicks = slot.durationTicks
        
        const blockIdx = linearBlocks.findIndex(b => b.id === slot.id)
        if (blockIdx !== -1) {
          let scanIdx = blockIdx
          let isTied = false
          const linked = []
          let totalDuration = slot.durationTicks
          
          while (scanIdx < linearBlocks.length - 1) {
            const nextBlock = linearBlocks[scanIdx + 1]
            if (nextBlock && lyricsTiedSlots.value.has(nextBlock.id)) {
              isTied = true
              linked.push(nextBlock.id)
              
              const nextMeasure = measures.value[nextBlock.measureIndex]
              const nextSig = getMeasureTimeSignature(nextMeasure)
              const nextBeatTicks = Math.round((4 / nextSig.unit) * 480)
              
              let nextDur = nextBeatTicks * (nextBlock.durationSlots || 1)
              if (nextBlock.type === 'subdivision') {
                const subSlots = getLyricsBeatSlots(nextMeasure, nextMeasure.lyrics.beats[nextBlock.beatIndex], nextBlock.beatIndex)
                nextDur = Math.round((nextBeatTicks * (nextBlock.durationSlots || 1)) / subSlots.length)
              }
              totalDuration += nextDur
              scanIdx++
            } else {
              break
            }
          }
          
          syl.tied = isTied
          syl.linkedEvents = linked
          syl.durationTicks = totalDuration
        } else {
          syl.tied = false
          syl.linkedEvents = []
        }
      } else {
        syl.rhythmEventId = null
        syl.startTick = null
        syl.durationTicks = null
        syl.tied = false
        syl.linkedEvents = []
      }
    } else {
      syl.startTick = null
      syl.durationTicks = null
      syl.tied = false
      syl.linkedEvents = []
    }
  })
}
const activeLyricsRhythmSelector = ref(null)
const openLyricsRhythmSelector = (measureIndex, beatIndex) => {
  activeDropdown.value = null
  activeRhythmSelector.value = null
  if (activeLyricsRhythmSelector.value && activeLyricsRhythmSelector.value.measureIndex === measureIndex && activeLyricsRhythmSelector.value.beatIndex === beatIndex) {
    activeLyricsRhythmSelector.value = null
  } else {
    activeLyricsRhythmSelector.value = { measureIndex, beatIndex }
  }
}
const selectLyricsRhythmFigure = (figValue) => {
  if (!activeLyricsRhythmSelector.value) return
  saveHistory()
  const { measureIndex, beatIndex } = activeLyricsRhythmSelector.value
  const m = measures.value[measureIndex]
  if (m && m.lyrics && m.lyrics.beats) {
    const beat = m.lyrics.beats[beatIndex]
    if (beat) {
      beat.harmonicRhythm = figValue
      beat.isSilence = figValue.startsWith('rest-')
      beat.subdivisions = []
      delete beat.eighthPattern
      delete beat.sixteenthPattern
      delete beat.tripletPattern
      syncRhythmLyricsTimeline(m)
    }
  }
  activeLyricsRhythmSelector.value = null
}
const selectLyricsSixteenthPatternWrapper = (measure, beat, patternKey) => {
  saveHistory()
  const isSixteenth = !!SIXTEENTH_PATTERNS[patternKey]
  const isTriplet = !!TRIPLET_PATTERNS[patternKey]
  
  if (isSixteenth) {
    beat.harmonicRhythm = 'sixteenth'
    beat.sixteenthPattern = patternKey
  } else if (isTriplet) {
    beat.harmonicRhythm = 'triplet'
    beat.tripletPattern = patternKey
  } else {
    beat.harmonicRhythm = 'eighth'
    beat.eighthPattern = patternKey
  }
  
  const pat = SIXTEENTH_PATTERNS[patternKey] || EIGHTH_PATTERNS[patternKey] || TRIPLET_PATTERNS[patternKey]
  if (pat) {
    const slots = pat.slots.map(type => ({
      id: generateUniqueId(),
      isSilence: type === 'silence',
      isMerged: type === 'merged'
    }))
    beat.subdivisions = slots
  }
  
  syncRhythmLyricsTimeline(measure)
  activeLyricsRhythmSelector.value = null
}
const isLyricsPatternActive = (measure, beat, beatIdx, patternKey) => {
  const eff = getLyricsEffectiveRhythm(measure, beat, beatIdx)
  if (eff === 'triplet') {
    return beat.tripletPattern === patternKey || (!beat.tripletPattern && patternKey === '3_notes')
  }
  if (eff === 'eighth') {
    return beat.eighthPattern === patternKey || (!beat.eighthPattern && patternKey === '2_notes')
  }
  return beat.sixteenthPattern === patternKey || (!beat.sixteenthPattern && patternKey === '4_semi')
}
const toggleLyricsTieSlot = (slotId) => {
  saveHistory()
  const linearBlocks = getLyricsLinearBlocks()
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return
  
  const currentBlock = linearBlocks[idx]
  const nextBlock = linearBlocks[idx + 1]
  if (!nextBlock || currentBlock.isSilence || nextBlock.isSilence) return
  
  if (lyricsTiedSlots.value.has(nextBlock.id)) {
    lyricsTiedSlots.value.delete(nextBlock.id)
    lyricsTiedSlots.value = new Set(lyricsTiedSlots.value)
    showToast("Ligado de letra eliminado")
  } else {
    lyricsTiedSlots.value.add(nextBlock.id)
    lyricsTiedSlots.value = new Set(lyricsTiedSlots.value)
    showToast("Ligado de letra creado")
  }
  
  const m1 = measures.value[currentBlock.measureIndex]
  if (m1) syncRhythmLyricsTimeline(m1)
  const m2 = measures.value[nextBlock.measureIndex]
  if (m2 && m1 !== m2) syncRhythmLyricsTimeline(m2)
}
const isLyricsNextSlotTied = (slotId) => {
  if (lyricsTiedSlots.value.size === 0) return false
  const linearBlocks = lyricRenderBlocks.value
  const idx = linearBlocks.findIndex(b => b.id === slotId)
  if (idx === -1 || idx === linearBlocks.length - 1) return false
  const currentBlock = linearBlocks[idx]
  const nextBlock = linearBlocks[idx + 1]
  if (currentBlock.isSilence || nextBlock.isSilence) return false
  return nextBlock && lyricsTiedSlots.value.has(nextBlock.id)
}
const selectSyllablePill = (measure, syl) => {
  if (activeSyllableSelection.value && activeSyllableSelection.value.syllableId === syl.id) {
    activeSyllableSelection.value = null
  } else {
    activeSyllableSelection.value = {
      measureIndex: measure.originalMeasureIndex,
      syllableId: syl.id
    }
  }
}
const clearSyllableAssignment = (measure, syl) => {
  saveHistory()
  syl.rhythmEventId = null
  syl.startTick = null
  syl.durationTicks = null
  syl.tied = false
  syl.linkedEvents = []
  if (activeSyllableSelection.value && activeSyllableSelection.value.syllableId === syl.id) {
    activeSyllableSelection.value = null
  }
}
const clearAllSyllableAssignments = (measure) => {
  if (!measure.lyrics?.syllables) return
  saveHistory()
  measure.lyrics.syllables.forEach((syl) => {
    syl.rhythmEventId = null
    syl.startTick = null
    syl.durationTicks = null
    syl.tied = false
    syl.linkedEvents = []
  })
  activeSyllableSelection.value = null
}
const resetLyricsSyllables = (measure) => {
  if (!measure.lyrics) return
  saveHistory()
  if (measure.lyrics.syllables) {
    measure.lyrics.syllables.forEach((syl) => {
      syl.rhythmEventId = null
      syl.startTick = null
      syl.durationTicks = null
      syl.tied = false
      syl.linkedEvents = []
    })
  }
  activeSyllableSelection.value = null
  measure.lyrics.rawText = (measure.lyrics.rawText || '').replace(/-/g, '')
  measure.lyrics.ignoreSuggestion = false
  syncRhythmLyricsTimeline(measure)
  showToast("Texto recompuesto (guiones eliminados) 🔄")
}
const getSyllableSlotDisplayLabel = (measure, rhythmEventId) => {
  if (!rhythmEventId) return ''
  const parts = rhythmEventId.split('_')
  if (parts.length < 3) return ''
  
  const beatIdx = parseInt(parts[2], 10)
  if (isNaN(beatIdx)) return ''
  
  const subIdx = parts[3] !== undefined ? parseInt(parts[3], 10) : null
  
  if (subIdx !== null && !isNaN(subIdx)) {
    return `P.${beatIdx + 1}.${subIdx + 1}`
  }
  return `P.${beatIdx + 1}`
}
const assignSyllableToSlot = (measure, beatIdx, subIdx) => {
  const measureIdx = measure.originalMeasureIndex
  if (isLyricsSlotSilence(measure, beatIdx, subIdx)) return
  
  if (activeSyllableSelection.value && activeSyllableSelection.value.measureIndex === measureIdx) {
    const sylId = activeSyllableSelection.value.syllableId
    const syl = measure.lyrics.syllables.find(s => s.id === sylId)
    if (syl) {
      const slotId = subIdx !== null && subIdx !== undefined
        ? `lyrics_${measureIdx}_${beatIdx}_${subIdx}`
        : `lyrics_${measureIdx}_${beatIdx}`
      
      saveHistory()
      syl.rhythmEventId = slotId
      syncRhythmLyricsTimeline(measure)
      
      const idx = measure.lyrics.syllables.findIndex(s => s.id === sylId)
      if (idx !== -1 && idx < measure.lyrics.syllables.length - 1) {
        activeSyllableSelection.value = {
          measureIndex: measureIdx,
          syllableId: measure.lyrics.syllables[idx + 1].id
        }
      } else {
        activeSyllableSelection.value = null
      }
      return
    }
  }
  
  const slotId = subIdx !== null && subIdx !== undefined
    ? `lyrics_${measureIdx}_${beatIdx}_${subIdx}`
    : `lyrics_${measureIdx}_${beatIdx}`
  const associatedSyl = measure.lyrics.syllables?.find(s => s.rhythmEventId === slotId)
  if (associatedSyl) {
    activeSyllableSelection.value = {
      measureIndex: measureIdx,
      syllableId: associatedSyl.id
    }
  }
}
const isSlotSelectedForSyllable = (measure, beatIdx, subIdx) => {
  if (!activeSyllableSelection.value || activeSyllableSelection.value.measureIndex !== measure.originalMeasureIndex) return false
  const sylId = activeSyllableSelection.value.syllableId
  const syl = measure.lyrics.syllables?.find(s => s.id === sylId)
  if (!syl) return false
  
  const slotId = subIdx !== null && subIdx !== undefined
    ? `lyrics_${measure.originalMeasureIndex}_${beatIdx}_${subIdx}`
    : `lyrics_${measure.originalMeasureIndex}_${beatIdx}`
  return syl.rhythmEventId === slotId
}
const getSyllableAtSlot = (measure, beatIdx, subIdx) => {
  if (!measure.lyrics || measure.lyrics.mode !== 'rhythm' || !measure.lyrics.syllables) return null
  if (isLyricsSlotSilence(measure, beatIdx, subIdx)) return null
  
  const slotId = subIdx !== null && subIdx !== undefined
    ? `lyrics_${measure.originalMeasureIndex}_${beatIdx}_${subIdx}`
    : `lyrics_${measure.originalMeasureIndex}_${beatIdx}`
  
  const matched = measure.lyrics.syllables.filter(s => s.rhythmEventId === slotId)
  if (matched.length > 0) {
    const joinedText = matched.map(s => s.text).join(',')
    const hasTied = matched.some(s => s.tied)
    return { text: joinedText, isRoot: true, tied: hasTied }
  }
  
  // An unassigned slot can inherit text only when it continues a lyric tie.
  if (!lyricsTiedSlots.value.has(slotId)) return null
  const linearBlocks = lyricRenderBlocks.value
  const curIdx = linearBlocks.findIndex(b => b.id === slotId)
  if (curIdx === -1 || linearBlocks[curIdx].isSilence) return null
  
  let scanIdx = curIdx
  while (scanIdx > 0 && lyricsTiedSlots.value.has(linearBlocks[scanIdx].id)) {
    scanIdx--
    const prevBlock = linearBlocks[scanIdx]
    if (prevBlock.isSilence) break
    const prevMeasure = measures.value[prevBlock.measureIndex]
    if (prevMeasure && prevMeasure.lyrics && prevMeasure.lyrics.syllables) {
      const prevSlotId = prevBlock.id
      const prevSyllable = prevMeasure.lyrics.syllables.find(s => s.rhythmEventId === prevSlotId)
      if (prevSyllable) {
        return { text: '~', isRoot: false, tied: true }
      }
    }
  }
  
  return null
}
const validateLyricsTies = () => {
  if (lyricsTiedSlots.value.size === 0) return
  const linearBlocks = getLyricsLinearBlocks()
  const newTies = new Set()
  linearBlocks.forEach((block, idx) => {
    if (idx > 0 && !block.isSilence && lyricsTiedSlots.value.has(block.id)) {
      const prevBlock = linearBlocks[idx - 1]
      if (!prevBlock.isSilence) {
        newTies.add(block.id)
      }
    }
  })
  const currentIds = [...lyricsTiedSlots.value]
  if (newTies.size !== currentIds.length || [...newTies].some((id, index) => id !== currentIds[index])) {
    lyricsTiedSlots.value = newTies
  }
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
const normalizeMeasureLyrics = (m) => {
  if (!m.lyrics) {
    m.lyrics = {
      rawText: '',
      mode: 'free',
      anchors: [],
      syllableSuggestion: null,
      lastTextForSuggestion: '',
      lastText: '',
      lastMode: 'free'
    }
  } else {
    if (!m.lyrics.anchors) m.lyrics.anchors = []
    if (m.lyrics.lastText === undefined) m.lyrics.lastText = ''
    if (m.lyrics.lastMode === undefined) m.lyrics.lastMode = m.lyrics.mode || 'free'
  }

  // Cache syllable suggestions when text changes
  if (m.lyrics.lastTextForSuggestion !== m.lyrics.rawText) {
    m.lyrics.syllableSuggestion = getSyllableSuggestionsForMeasure(m)
    m.lyrics.lastTextForSuggestion = m.lyrics.rawText
  }

  // Rhythm mode reconciliation & sync
  if (m.lyrics.mode === 'rhythm') {
    if (!m.lyrics.syllables) {
      m.lyrics.syllables = []
    }

    // Initialize independent lyrics beats according to metric
    const sig = getMeasureTimeSignature(m)
    if (!m.lyrics.beats || m.lyrics.beats.length !== sig.beats) {
      const oldBeats = m.lyrics.beats || []
      m.lyrics.beats = Array.from({ length: sig.beats }, (_, i) => {
        if (oldBeats[i]) return oldBeats[i]
        return {
          id: generateUniqueId(),
          harmonicRhythm: 'auto',
          subdivisions: []
        }
      })
    }

    m.lyrics.beats.forEach(b => {
      if (!b.id) b.id = generateUniqueId()
    })

    const textChanged = m.lyrics.lastText !== m.lyrics.rawText
    const modeChanged = m.lyrics.lastMode !== m.lyrics.mode
    const syllablesEmpty = !m.lyrics.syllables || m.lyrics.syllables.length === 0

    if (textChanged || modeChanged || syllablesEmpty) {
      if (textChanged) {
        m.lyrics.ignoreSuggestion = false
        m.lyrics.lastText = m.lyrics.rawText
      }
      m.lyrics.lastMode = m.lyrics.mode

      const parsedSyllables = getSyllableListForMeasure(m)
      const currentSyllables = m.lyrics.syllables

      const reconciled = parsedSyllables.map((ps, idx) => {
        const existing = currentSyllables[idx]
        if (existing) {
          return {
            ...existing,
            text: ps.text,
            wordId: ps.wordId
          }
        } else {
          return {
            id: generateUniqueId(),
            text: ps.text,
            wordId: ps.wordId,
            startTick: null,
            durationTicks: null,
            rhythmEventId: null,
            tied: false,
            linkedEvents: []
          }
        }
      })

      if (reconciled.length > 0 || currentSyllables.length > 0) {
        m.lyrics.syllables = reconciled
      }
      syncRhythmLyricsTimeline(m)
    }
  } else {
    m.lyrics.lastMode = m.lyrics.mode || 'free'
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

}
// Structural edits rebuild the subscriptions; ordinary edits normalize one measure.
watch(() => measures.value.slice(), (newMeasures, previous, onCleanup) => {
  const stops = newMeasures.map(m => watch(
    () => [m, getMeasureTimeSignature(m).beats],
    () => {
      normalizeMeasureLyrics(m)
      updateConnectors()
    },
    { immediate: true, deep: true }
  ))
  onCleanup(() => stops.forEach(stop => stop()))
  updateConnectors()
}, { immediate: true })
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
      ensureMeasureRendered(targetIndex).then(() => setTimeout(() => {
        const targetEl = document.getElementById(`lyrics-textarea-${targetIndex}`)
        if (targetEl) {
          targetEl.focus()
        }
      }, 50))
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
  ensureMeasureRendered(measureOriginalIndex).then(() => setTimeout(() => {
    const el = document.getElementById(`lyrics-textarea-${measureOriginalIndex}`)
    if (el) {
      el.focus()
    }
  }, 50))
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
  if (connectorUpdateTimer !== null) {
    clearTimeout(connectorUpdateTimer)
    connectorUpdateTimer = null
  }
  if (currentPlan.value !== 'PRO' || !showLyricsGlobal.value) {
    activeConnectors.value = []
    return
  }
  
  connectorUpdateTimer = setTimeout(() => {
    connectorUpdateTimer = null
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
const notationMode = ref('chords') // 'chords' | 'roman'
// Global presentation can move connectors without changing row membership.
watch([showLyricsGlobal, hoveredChordId, hoveredAnchor, notationMode, viewMode,
  defaultMeasuresPerSystem, globalShowObligado, globalShowSubdivisions, globalGroove], () => {
  updateConnectors()
})
// Structural reflow updates connectors here. Nested musical/lyric edits already
// schedule them in the per-measure normalization watchers; avoid traversing the
// entire composition a second time for every keystroke.
watch(() => currentPlan.value === 'PRO' && showLyricsGlobal.value ? systems.value : null, () => {
  updateConnectors()
})
const toggleNotationMode = () => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'roman_numerals'
    isUpgradeModalOpen.value = true
    return
  }
  notationMode.value = notationMode.value === 'roman' ? 'chords' : 'roman'
  const modeName = notationMode.value === 'roman' ? 'Grados Romanos 🏛️' : 'Acordes 🔤'
  showToast(`Modo notación: ${modeName}`)
}

function formatDisplayChord(beat, mIdx = null) {
  if (!beat || !beat.root) return '-'
  if (notationMode.value === 'roman') {
    const measureInfo = (mIdx !== null && measuresWithKey.value && measuresWithKey.value[mIdx]) ? measuresWithKey.value[mIdx] : null
    const activeK = measureInfo ? measureInfo.activeKey : key.value
    const activeS = measureInfo ? measureInfo.activeScale : scaleType.value
    return getRomanNumeralForChord(beat, activeK, activeS)
  }
  return formatChord(beat)
}
function splitChordDisplay(beat, mIdx = null) {
  const full = formatDisplayChord(beat, mIdx)
  if (full === '-') return { main: '-', bass: '' }
  const parts = full.split('/')
  return {
    main: parts[0],
    bass: parts[1] ? `/${parts[1]}` : ''
  }
}
function getBeatDisplayChord(beat, mIdx = null) {
  if (!beat) return { main: '-', bass: '' }
  if (beat.subdivisions && beat.subdivisions.length > 0) {
    const active = beat.subdivisions.find(s => !s.isSilence && !s.isMerged && s.root)
    if (active) return splitChordDisplay(active, mIdx)
  }
  return splitChordDisplay(beat, mIdx)
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
  if (isFreeLaunch && isProOptionSelected.value) selectedPdfExportOption.value = 'chords-only'
  isPdfExportModalOpen.value = true
}
const confirmExportPdf = () => {
  if (isFreeLaunch && isProOptionSelected.value) {
    selectedPdfExportOption.value = 'chords-only'
    showToast('Elige un formato de exportación disponible.')
    return
  }
  isPdfExportModalOpen.value = false
  const option = selectedPdfExportOption.value
  
  try {
    if (option === 'chords-only-expanded') {
      generatePDF({
        title: title.value,
        key: key.value,
        scaleType: scaleType.value,
        timeSignature: timeSignature.value,
        timeSignatureUnit: timeSignatureUnit.value,
        measures: buildExpandedSequence(measuresWithKey.value, repeats.value),
        repeats: [],
        keySignatureStr: keySignatureStr.value,
        viewMode: 'expanded',
        globalGroove: globalGroove.value,
        lyricsTiedSlots: Array.from(lyricsTiedSlots.value),
        tiedSlots: Array.from(tiedSlots.value)
      }, option)
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
        globalGroove: globalGroove.value,
        lyricsTiedSlots: Array.from(lyricsTiedSlots.value),
        tiedSlots: Array.from(tiedSlots.value)
      }, option)
    }
  } catch (err) {
    console.error("PDF generation failed:", err)
    alert("Error al generar PDF: " + err.message + "\n" + err.stack)
  }
}

// =========================================================================
// --- PLAYBACK & AUDIO ENGINE SYSTEM ---
// =========================================================================
let audioCtx = null
const isPlaying = ref(false)
const playbackBpm = ref(120)
const playbackStartMeasure = ref(1)
const playbackBassOnly = ref(false)
const playbackMetronome = ref(false)
const playbackMetronomeSound = ref('beep')
const playbackInstrument = ref('rhodes')
const playbackChordsActive = ref(true)
const playbackContinuity = ref(true)
const playbackFillChords = ref(true)
const playbackTriadVoicing = ref('fundamental')
const playbackTetradVoicing = ref('fundamental')

const currentPlayingMeasureIndex = ref(null)
const currentPlayingOriginalMeasureIndex = ref(null)
const currentPlayingBeatIndex = ref(null)
const playheadProgress = ref(0)
const isAudioSettingsOpen = ref(false)

// --- CHORD VOICING & NOTE ORDER INSPECTOR ---
const isVoicingInspectorOpen = ref(true)

const getNoteIntervalLabel = (pc, rootPc, chordType, tensions = []) => {
  const diff = (pc - rootPc + 12) % 12
  switch (diff) {
    case 0: return { interval: '1', label: '1 (Fundamental)', isRoot: true }
    case 1: return { interval: '9b', label: '♭9 (Novena Menor)' }
    case 2: return { interval: '9', label: '9 (Novena)' }
    case 3: 
      if (['sus2'].includes(chordType)) return { interval: '9', label: '9 (Novena)' }
      return { interval: '3m', label: '3m (Tercera Menor)' }
    case 4: return { interval: '3', label: '3 (Tercera Mayor)' }
    case 5: 
      if (['sus4'].includes(chordType)) return { interval: '4', label: '4 (Cuarta)' }
      return { interval: '11', label: '11 (Oncena)' }
    case 6: 
      if (['dim', 'm7b5', 'dim7', 'b5'].includes(chordType) || (tensions && tensions.includes('b5'))) return { interval: '5b', label: '♭5 (Quinta Disminuida)' }
      return { interval: '11#', label: '♯11 (Oncena Aum.)' }
    case 7: return { interval: '5', label: '5 (Quinta Justa)' }
    case 8: 
      if (['aug', 'maj7#5', '7#5', '#5'].includes(chordType) || (tensions && tensions.includes('#5'))) return { interval: '#5', label: '♯5 (Quinta Aum.)' }
      return { interval: '13b', label: '♭13 (Treceava Menor)' }
    case 9: 
      if (['dim7'].includes(chordType)) return { interval: 'dim7', label: 'dim7 (7ma Disminuida)' }
      return { interval: '13', label: '13 (Treceava)' }
    case 10: return { interval: '7m', label: '7m (Séptima Menor)' }
    case 11: return { interval: '7', label: '7 (Séptima Mayor)' }
    default: return { interval: `${diff}`, label: `Int. ${diff}` }
  }
}

const activeChordVoicingList = computed(() => {
  let chordObj = null
  let activeMeasureIndex = (isPlaying.value && currentPlayingMeasureIndex.value !== null)
    ? currentPlayingMeasureIndex.value
    : (selectedBeat.value ? selectedBeat.value.measureIndex : (selectedMeasureIndex.value !== null ? selectedMeasureIndex.value : 0))

  const targetSeq = isPlaying.value ? playbackSequence.value : measures.value
  const m = targetSeq && targetSeq[activeMeasureIndex] ? targetSeq[activeMeasureIndex] : null

  if (m && m.beats) {
    if (isPlaying.value && currentPlayingBeatIndex.value !== null && m.beats[currentPlayingBeatIndex.value]?.root) {
      chordObj = m.beats[currentPlayingBeatIndex.value]
    } else if (selectedBeat.value && selectedBeat.value.measureIndex === activeMeasureIndex) {
      const bIdx = selectedBeat.value.beatIndex
      const b = m.beats[bIdx]
      if (b && b.root) {
        chordObj = b
      } else {
        chordObj = m.beats.find(x => x.root)
      }
    } else {
      chordObj = m.beats.find(b => b.root)
    }
  }

  if (!chordObj && measures.value) {
    for (let me of measures.value) {
      if (me && me.beats) {
        const b = me.beats.find(x => x.root)
        if (b) { chordObj = b; break }
      }
    }
  }
  if (!chordObj || !chordObj.root) return null

  const rootPc = NOTE_TO_INDEX[chordObj.root]
  if (rootPc === undefined) return null

  let midiNotes = []
  if (playbackContinuity.value) {
    midiNotes = getVoiceLedMidi(chordObj, lastVoicedNotes, playbackTriadVoicing.value, playbackTetradVoicing.value)
  } else {
    midiNotes = getRootPositionMidi(chordObj, playbackTriadVoicing.value, playbackTetradVoicing.value)
  }
  if (midiNotes.length === 0) return null

  const mutedNotes = chordObj.mutedNotes || []
  const notesInfo = midiNotes.map((midi, idx) => {
    const pc = (midi % 12 + 12) % 12
    const noteName = getNoteName(pc, chordObj.root)
    const intervalData = getNoteIntervalLabel(pc, rootPc, chordObj.type, chordObj.tensions)
    const isMuted = mutedNotes.includes(noteName)
    return {
      index: idx,
      midi,
      pc,
      noteName,
      interval: intervalData.interval,
      label: intervalData.label,
      isRoot: pc === rootPc,
      isMuted
    }
  })

  return {
    chordObj,
    root: chordObj.root,
    type: chordObj.type,
    formattedName: formatChord(chordObj),
    notes: notesInfo,
    bassNote: chordObj.bass || chordObj.root,
    isSlashChord: !!chordObj.bass && chordObj.bass !== chordObj.root
  }
})

const toggleVoicingNoteMute = (n) => {
  const current = activeChordVoicingList.value
  if (!current || !current.chordObj) return
  const chordObj = current.chordObj
  if (!chordObj.mutedNotes) {
    chordObj.mutedNotes = []
  }
  const noteIdx = chordObj.mutedNotes.indexOf(n.noteName)
  if (noteIdx !== -1) {
    chordObj.mutedNotes.splice(noteIdx, 1)
    showToast(`Nota ${n.noteName} activada (desmuteada)`)
  } else {
    chordObj.mutedNotes.push(n.noteName)
    showToast(`Nota ${n.noteName} silenciada (muteada)`)
  }
}

const reorderActiveChordVoicing = (fromIdx, toIdx) => {
  const current = activeChordVoicingList.value
  if (!current || !current.notes || current.notes.length <= 1) return
  if (toIdx < 0 || toIdx >= current.notes.length) return

  const notesCopy = [...current.notes]
  const [moved] = notesCopy.splice(fromIdx, 1)
  notesCopy.splice(toIdx, 0, moved)

  const firstNote = notesCopy[0]
  const targetChordObj = current.chordObj

  if (!firstNote.isRoot) {
    targetChordObj.bass = firstNote.noteName
  } else {
    targetChordObj.bass = null
  }
  showToast(`Voicing reorganizado: ${formatChord(targetChordObj)}`)
}

// Drag & Drop handlers for floating Voicing reordering
const draggedVoicingIndex = ref(null)
const dragOverVoicingIndex = ref(null)

const onVoicingDragStart = (idx, event) => {
  draggedVoicingIndex.value = idx
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', idx.toString())
  }
}

const onVoicingDragOver = (idx, event) => {
  event.preventDefault()
  if (draggedVoicingIndex.value !== null && draggedVoicingIndex.value !== idx) {
    dragOverVoicingIndex.value = idx
  }
}

const onVoicingDrop = (idx, event) => {
  event.preventDefault()
  if (draggedVoicingIndex.value !== null && draggedVoicingIndex.value !== idx) {
    reorderActiveChordVoicing(draggedVoicingIndex.value, idx)
  }
  onVoicingDragEnd()
}

const onVoicingDragEnd = () => {
  draggedVoicingIndex.value = null
  dragOverVoicingIndex.value = null
}

const initAudio = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) throw new Error('Este navegador no admite audio. Prueba con Safari o Chrome actualizado.')
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContextClass()
  // Resume inside the button gesture, including Safari's interrupted state.
  if (audioCtx.state !== 'running') await audioCtx.resume()
  if (audioCtx.state !== 'running') throw new Error('No se pudo activar el audio. Vuelve a pulsar Play.')
}
let playbackStartToken = 0
let playbackStarting = false

// Bucle de programación (look-ahead scheduler)
let schedulerTimer = null
let nextNoteTime = 0.0
let scheduleMeasureIdx = 0
let scheduleBeatIdx = 0
let lastVoicedNotes = null
const visualQueue = []

const playbackSequence = computed(() => {
  return buildExpandedSequence(measuresWithKey.value, repeats.value)
})

const filterChordNotesForAudio = (slot, rawNotes) => {
  if (!rawNotes || rawNotes.length === 0) return []
  let notes = [...rawNotes]

  if (slot && slot.mutedNotes && slot.mutedNotes.length > 0) {
    notes = notes.filter(midi => {
      const pc = (midi % 12 + 12) % 12
      const name = getNoteName(pc, slot.root)
      return !slot.mutedNotes.includes(name)
    })
  }

  if (playbackBassOnly.value && notes.length > 0) {
    notes = [notes[0]]
  }

  return notes
}

const scheduler = () => {
  while (nextNoteTime < audioCtx.currentTime + 0.25) {
    if (scheduleMeasureIdx >= playbackSequence.value.length) {
      break
    }
    
    const measure = playbackSequence.value[scheduleMeasureIdx]
    const sig = getMeasureTimeSignature(measure)
    const beatDuration = (sig.unit === 8 ? 0.5 : 1.0) * (60.0 / playbackBpm.value)
    
    // Metrónomo
    if (playbackMetronome.value) {
      let isAccent = scheduleBeatIdx === 0
      if (sig.unit === 8) {
        const grouping = measure.grouping || getDefaultGrouping(sig.beats, sig.unit)
        let accum = 0
        for (let g of grouping) {
          if (scheduleBeatIdx === accum) {
            isAccent = true
            break
          }
          accum += g
        }
      }
      playClick(audioCtx, nextNoteTime, playbackMetronomeSound.value, isAccent)
    }
    
    // Acordes
    const beat = measure.beats[scheduleBeatIdx]
    if (beat) {
      if (shouldPlaybackRenderAsSubdivided(measure, beat, scheduleBeatIdx)) {
        const slots = getBeatSlots(measure, beat, scheduleBeatIdx)
        const subCount = slots.length
        const slotDuration = beatDuration / subCount
        
        for (let k = 0; k < subCount; k++) {
          const slot = slots[k]
          if (slot && slot.root && !slot.isSilence && !slot.isMerged) {
            const slotId = `${measure.originalMeasureIndex}_${scheduleBeatIdx}_${slot.originalIndex !== undefined ? slot.originalIndex : k}`
            
            // Si la figura actual recibe un ligado de la figura anterior, no se vuelve a atacar en audio
            if (tiedSlots.value.has(slotId)) {
              continue
            }
            
            let durationSlots = 1
            while (k + durationSlots < subCount && slots[k + durationSlots].isMerged) {
              durationSlots++
            }
            let durationSeconds = durationSlots * slotDuration
            
            // Extender la duración sosteniendo la nota a través de las figuras ligadas consecutivas
            const allLinearBlocks = tiedSlots.value.size > 0 ? musicalRenderBlocks.value : []
            const blockIdx = allLinearBlocks.findIndex(b => b.id === slotId)
            if (blockIdx !== -1) {
              let nextBIdx = blockIdx + 1
              while (nextBIdx < allLinearBlocks.length && tiedSlots.value.has(allLinearBlocks[nextBIdx].id)) {
                const nextB = allLinearBlocks[nextBIdx]
                const nextM = measures.value[nextB.measureIndex]
                const nextBt = nextM?.beats[nextB.beatIndex]
                const nextSig = getMeasureTimeSignature(nextB.measureIndex)
                const nextBpm = playbackBpm.value || 120
                const nextBtDur = (60 / nextBpm) * (4 / (nextSig?.unit || 4))
                
                let addSecs = nextBtDur
                if (nextB.type === 'subdivision') {
                  const nextSlots = getBeatSlots(nextM, nextBt, nextB.beatIndex)
                  addSecs = (nextBtDur / Math.max(nextSlots.length, 1)) * (nextB.durationSlots || 1)
                } else {
                  addSecs = nextBtDur * (nextB.durationSlots || 1)
                }
                durationSeconds += addSecs
                nextBIdx++
              }
            }
            
            let rawNotes = []
            if (playbackContinuity.value) {
              rawNotes = getVoiceLedMidi(slot, lastVoicedNotes, playbackTriadVoicing.value, playbackTetradVoicing.value)
            } else {
              rawNotes = getRootPositionMidi(slot, playbackTriadVoicing.value, playbackTetradVoicing.value)
            }
            const notes = filterChordNotesForAudio(slot, rawNotes)
            if (notes.length > 0) {
              if (playbackChordsActive.value) {
                playChordNotes(audioCtx, nextNoteTime + k * slotDuration, notes, durationSeconds - 0.02, playbackInstrument.value)
              }
              lastVoicedNotes = rawNotes
            }
          }
        }
      } else {
        const states = getPlaybackMergedBeats(measure)
        const state = states.find(s => s.index === scheduleBeatIdx)
        if (state && !state.isMerged && state.beat.root) {
          const beatId = `${measure.originalMeasureIndex}_${scheduleBeatIdx}`
          if (!tiedSlots.value.has(beatId)) {
            const isExplicitFigure = state.beat.harmonicRhythm && state.beat.harmonicRhythm !== 'auto'
            let durationBeats = state.durationSlots
            
            if (!isExplicitFigure && playbackFillChords.value && !measure.showObligado) {
              let fillBeats = 1
              for (let j = scheduleBeatIdx + 1; j < measure.beats.length; j++) {
                if (measure.beats[j] && measure.beats[j].root) {
                  fillBeats = j - scheduleBeatIdx
                  break
                } else {
                  fillBeats = measure.beats.length - scheduleBeatIdx
                }
              }
              durationBeats = Math.max(durationBeats, fillBeats)
            }
            
            let durationSeconds = durationBeats * beatDuration
            
            // Extender la duración por ligaduras consecutivas
            const allLinearBlocks = tiedSlots.value.size > 0 ? musicalRenderBlocks.value : []
            const blockIdx = allLinearBlocks.findIndex(b => b.id === beatId)
            if (blockIdx !== -1) {
              let nextBIdx = blockIdx + 1
              while (nextBIdx < allLinearBlocks.length && tiedSlots.value.has(allLinearBlocks[nextBIdx].id)) {
                const nextB = allLinearBlocks[nextBIdx]
                const nextM = measures.value[nextB.measureIndex]
                const nextBt = nextM?.beats[nextB.beatIndex]
                const nextSig = getMeasureTimeSignature(nextB.measureIndex)
                const nextBpm = playbackBpm.value || 120
                const nextBtDur = (60 / nextBpm) * (4 / (nextSig?.unit || 4))
                
                let addSecs = nextBtDur
                if (nextB.type === 'subdivision') {
                  const nextSlots = getBeatSlots(nextM, nextBt, nextB.beatIndex)
                  addSecs = (nextBtDur / Math.max(nextSlots.length, 1)) * (nextB.durationSlots || 1)
                } else {
                  addSecs = nextBtDur * (nextB.durationSlots || 1)
                }
                durationSeconds += addSecs
                nextBIdx++
              }
            }

            let rawNotes = []
            if (playbackContinuity.value) {
              rawNotes = getVoiceLedMidi(state.beat, lastVoicedNotes, playbackTriadVoicing.value, playbackTetradVoicing.value)
            } else {
              rawNotes = getRootPositionMidi(state.beat, playbackTriadVoicing.value, playbackTetradVoicing.value)
            }
            const notes = filterChordNotesForAudio(state.beat, rawNotes)
            if (notes.length > 0) {
              if (playbackChordsActive.value) {
                playChordNotes(audioCtx, nextNoteTime, notes, durationSeconds - 0.02, playbackInstrument.value)
              }
              lastVoicedNotes = rawNotes
            }
          }
        }
      }
    }
    
    visualQueue.push({
      measureIdx: viewMode.value === 'expanded' && currentPlan.value === 'PRO' ? scheduleMeasureIdx : measure.originalMeasureIndex,
      origMeasureIdx: measure.originalMeasureIndex,
      beatIdx: scheduleBeatIdx,
      beatDuration: beatDuration,
      startTime: nextNoteTime,
      numBeats: measure.beats.length
    })
    
    nextNoteTime += beatDuration
    scheduleBeatIdx++
    if (scheduleBeatIdx >= measure.beats.length) {
      scheduleBeatIdx = 0
      scheduleMeasureIdx++
    }
  }
}

let animationFrameId = null
const updatePlayhead = () => {
  if (!isPlaying.value) {
    currentPlayingMeasureIndex.value = null
    currentPlayingOriginalMeasureIndex.value = null
    currentPlayingBeatIndex.value = null
    playheadProgress.value = 0
    return
  }
  
  const now = audioCtx ? audioCtx.currentTime : 0
  
  while (visualQueue.length > 0 && visualQueue[0].startTime + visualQueue[0].beatDuration < now) {
    visualQueue.shift()
  }
  
  if (visualQueue.length > 0) {
    const currentEvent = visualQueue[0]
    if (now >= currentEvent.startTime && now <= currentEvent.startTime + currentEvent.beatDuration) {
      const beatProgress = (now - currentEvent.startTime) / currentEvent.beatDuration
      
      currentPlayingMeasureIndex.value = currentEvent.measureIdx
      currentPlayingOriginalMeasureIndex.value = currentEvent.origMeasureIdx
      currentPlayingBeatIndex.value = currentEvent.beatIdx
      
      playheadProgress.value = (currentEvent.beatIdx + beatProgress) / currentEvent.numBeats
    }
  } else {
    if (scheduleMeasureIdx >= playbackSequence.value.length) {
      stopPlayback()
    }
  }
  
  animationFrameId = requestAnimationFrame(updatePlayhead)
}

const startPlayback = async () => {
  if (measuresWithKey.value.length === 0) return
  try { void playbackSequence.value } catch (error) { showToast(error.message); return }
  if (playbackStarting || isPlaying.value) return
  const token = ++playbackStartToken
  playbackStarting = true
  try {
    await initAudio()
  } catch (error) {
    if (token === playbackStartToken) showToast(error.message || 'No se pudo activar el audio.')
    return
  } finally {
    if (token === playbackStartToken) playbackStarting = false
  }
  if (token !== playbackStartToken) return

  isPlaying.value = true
  lastVoicedNotes = null
  
  const targetMeasureNum = Math.max(1, Math.min(playbackStartMeasure.value || 1, measuresWithKey.value.length))
  const startIdx = playbackSequence.value.findIndex(m => m.originalMeasureIndex === (targetMeasureNum - 1))
  
  scheduleMeasureIdx = startIdx !== -1 ? startIdx : 0
  scheduleBeatIdx = 0
  nextNoteTime = audioCtx.currentTime + 0.05
  visualQueue.length = 0
  
  // Schedule the first chord immediately after audio is ready.
  try { scheduler() } catch (error) { stopPlayback(); showToast('No se pudo reproducir: ' + error.message); return }
  schedulerTimer = setInterval(() => {
    try { scheduler() } catch (error) { stopPlayback(); showToast('No se pudo reproducir: ' + error.message) }
  }, 25)
  
  animationFrameId = requestAnimationFrame(updatePlayhead)
}

const stopPlayback = () => {
  playbackStartToken++
  playbackStarting = false
  isPlaying.value = false
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
  currentPlayingMeasureIndex.value = null
  currentPlayingOriginalMeasureIndex.value = null
  currentPlayingBeatIndex.value = null
  playheadProgress.value = 0
}

const togglePlayback = () => {
  if (isPlaying.value || playbackStarting) {
    stopPlayback()
  } else {
    startPlayback()
  }
}
// Offscreen systems keep their data; reveal before keyboard focus targets their DOM.
const systemViewportControls = new Map()
const registerSystemViewport = (id, control) => {
  if (control) systemViewportControls.set(id, control)
  else systemViewportControls.delete(id)
}
const ensureMeasureRendered = async (originalIndex) => {
  const system = systems.value.find(s => s.measures.some(m => m.originalMeasureIndex === originalIndex))
  if (system) await systemViewportControls.get(system.id)?.reveal()
  await nextTick()
}
const isSystemPinned = (system) => system.measures.some(m =>
  m.originalMeasureIndex === activeEditingLyricsIndex.value ||
  m.originalMeasureIndex === activeRhythmSelector.value?.measureIndex ||
  m.originalMeasureIndex === activeLyricsRhythmSelector.value?.measureIndex ||
  (isPlaying.value && m.displayedMeasureIndex === currentPlayingMeasureIndex.value)
)
const playbackRenderState = {isPlaying, measure: currentPlayingMeasureIndex, beat: currentPlayingBeatIndex, progress: playheadProgress}
// Keep refs intact: child systems track only the data their template reads.
const scoreRenderContext = {
  isFreeLaunch,
  isSystemPinned,
  playbackRenderState,
  SCALES,
  currentPlan,
  viewMode,
  isUpgradeModalOpen,
  upgradeReason,
  showLyricsGlobal,
  hoveredMeasureIndex,
  activeEditingLyricsIndex,
  pendingSelection,
  hoveredChordId,
  hoveredAnchor,
  activeConnectors,
  activeSyllableSelection,
  title,
  timeSignature,
  key,
  scaleType,
  measures,
  translateNoteToSpanish,
  getRepeatStart,
  getRepeatEnd,
  getCasillaData,
  autoCompleteMeasure,
  shouldRenderAsSubdivided,
  isOrderingModeActive,
  toggleSystemBreak,
  systems,
  getSuggestionsForSystemLocal,
  openSystemSuggestions,
  getKeyAccidentalsStr,
  getBeatMinWidth,
  getMeasureFlexStyle,
  getAddButtonFlexStyle,
  isFigureValid,
  isPatternActive,
  getMeasureRemainingBeats,
  getMergedBeats,
  analyzeMeasureSubdivision,
  getBeatGroupInfo,
  getAvailableRhythmFigures,
  getRhythmDisplayIconSVG,
  openKeyChangeInfo,
  getMeasureTimeSignature,
  isSelectionMode,
  toggleMeasureSelection,
  startSelectionDrag,
  continueSelectionDrag,
  isMeasureSelected,
  activeRhythmSelector,
  SIXTEENTH_PATTERNS,
  EIGHTH_PATTERNS,
  TRIPLET_PATTERNS,
  clickBeat,
  isRhythmSelectorActiveForMeasure,
  isSystemActive,
  isSystemActiveOrHasActiveLyrics,
  openLocalMetricInfo,
  openRhythmSelector,
  selectRhythmFigure,
  selectSixteenthPatternWrapper,
  getVisibleSlotsForRender,
  getBeatPatternKey,
  getPatternLabel,
  getLyricsBeatPatternKey,
  getDynamicRhythmSVG,
  getRhythmIconSVG,
  getMeasureFontSizeClass,
  openMeasureOptions,
  getEffectiveRhythm,
  getBeatFlexGrow,
  getMeasureTiesPaths,
  getMeasureLyricsTiesPaths,
  isSlotTiedToNext,
  toggleTieBySlotId,
  getBeatSlots,
  hasBeatRhythmOverride,
  getActiveMeasureRhythms,
  getSubdivisionIcon,
  getSubdivisionFontSizeClass,
  addMeasure,
  applySyllableSuggestion,
  hasHyphensOrCommas,
  applySyllableSuggestionToAllMeasures,
  getMeasureCapacityExceededMessage,
  isLyricsFigureValid,
  getLyricsEffectiveRhythm,
  getLyricsBeatSlots,
  getLyricsVisibleSlotsForRender,
  toggleSyncWithHarmonic,
  getLyricsMergedBeats,
  isLyricsSlotSilence,
  activeLyricsRhythmSelector,
  openLyricsRhythmSelector,
  selectLyricsRhythmFigure,
  selectLyricsSixteenthPatternWrapper,
  isLyricsPatternActive,
  toggleLyricsTieSlot,
  isLyricsNextSlotTied,
  selectSyllablePill,
  clearSyllableAssignment,
  clearAllSyllableAssignments,
  resetLyricsSyllables,
  getSyllableSlotDisplayLabel,
  assignSyllableToSlot,
  isSlotSelectedForSyllable,
  getSyllableAtSlot,
  isFirstOfGroup,
  isLastOfGroup,
  handleLyricsKeydown,
  shouldShowLyricsRow,
  activateLyricsForMeasure,
  isChordIdRelatedToBeat,
  getNextUnusedChord,
  assignPendingSelection,
  handleSegmentClick,
  getSlotLayout,
  handleSlotLyricsMouseUp,
  handleSlotLyricsDblClick,
  formatDisplayChord,
  splitChordDisplay,
  getBeatDisplayChord,
  isPlaying,
  currentPlayingMeasureIndex,
  currentPlayingBeatIndex,
  playheadProgress
}

// Only composition changes invalidate this snapshot; playback frames do not.
const cloudDocument = computed(() => measures.value.length ? {
  format: 'harmonigrid-project', schemaVersion: 1,
  title: title.value, key: key.value, scaleType: scaleType.value,
  timeSignature: timeSignature.value, timeSignatureUnit: timeSignatureUnit.value,
  globalGrouping: globalGrouping.value ? [...globalGrouping.value] : null,
  globalGroove: globalGroove.value, globalShowObligado: globalShowObligado.value,
  globalShowSubdivisions: globalShowSubdivisions.value, showLyricsGlobal: showLyricsGlobal.value,
  measures: measures.value.map(getMeasureHistorySnapshot),
  repeats: JSON.parse(JSON.stringify(repeats.value)),
  tiedSlots: [...tiedSlots.value], lyricsTiedSlots: [...lyricsTiedSlots.value],
  preferences: {viewMode: viewMode.value, notationMode: notationMode.value,
    measuresPerSystem: defaultMeasuresPerSystem.value, bpm: playbackBpm.value,
    audio: Object.fromEntries(Object.entries(cloudAudioRefs).map(([name,state]) => [name,state.value]))}
} : null)
const cloudWorkspaceContext = {document: cloudDocument}
const cloudAudioRefs = {startMeasure: playbackStartMeasure, bassOnly: playbackBassOnly,
  metronome: playbackMetronome, metronomeSound: playbackMetronomeSound,
  instrument: playbackInstrument, chordsActive: playbackChordsActive,
  continuity: playbackContinuity, fillChords: playbackFillChords,
  triadVoicing: playbackTriadVoicing, tetradVoicing: playbackTetradVoicing}
function closeProjectEditors() {
  mobileFocusedIndex.value = null; mobilePanel.value = null; mobileOverviewScroll = 0
  selectedBeat.value = null; selectedMeasureIndex.value = null; selectedRangeStart.value = null; selectedRangeEnd.value = null
  activeEditingLyricsIndex.value = null; activeSyllableSelection.value = null
  pendingSelection.value = null; activeDropdown.value = null
  isModalOpen.value = false; isMeasureOptionsOpen.value = false
  isSystemSuggestionsModalOpen.value = false; isTimesModalOpen.value = false
  isRepeatMenuOpen.value = false; isTransposeModalOpen.value = false
  isPdfExportModalOpen.value = false; isRhythmPromptOpen.value = false
  isKeyInfoOpen.value = false; isKeyChangeInfoOpen.value = false; isMetricInfoModalOpen.value = false
  activeConnectors.value = []; hoveredAnchor.value = null
}
function clearAccountWorkspace() {
  stopPlayback(); closeProjectEditors(); cloudProjectGeneration.value++
  measures.value = []; repeats.value = []; tiedSlots.value = new Set(); lyricsTiedSlots.value = new Set()
  undoStack.value = []; copiedMeasures.value = []; copiedMeasureIndexes.value = []; copiedMusicalTies.value = []; copiedLyricsTies.value = []; title.value = ''; isSetupMode.value = true
  configTitle.value = 'Mi Canción'; configKey.value = 'C'; configScale.value = 'major'; configMeasuresCount.value = 8
}
function hydrateProjectDocument(document) {
  const clean = validateProjectDocument(document)
  stopPlayback(); closeProjectEditors()
  title.value = clean.title; key.value = clean.key; scaleType.value = clean.scaleType
  timeSignature.value = clean.timeSignature; timeSignatureUnit.value = clean.timeSignatureUnit
  globalGrouping.value = clean.globalGrouping; globalGroove.value = clean.globalGroove
  globalShowObligado.value = clean.globalShowObligado; globalShowSubdivisions.value = clean.globalShowSubdivisions
  showLyricsGlobal.value = clean.showLyricsGlobal; measures.value = clean.measures; repeats.value = clean.repeats
  tiedSlots.value = new Set(clean.tiedSlots); lyricsTiedSlots.value = new Set(clean.lyricsTiedSlots)
  viewMode.value = clean.preferences.viewMode; notationMode.value = clean.preferences.notationMode
  defaultMeasuresPerSystem.value = clean.preferences.measuresPerSystem; playbackBpm.value = clean.preferences.bpm
  if(clean.preferences.audio) for(const [name,state] of Object.entries(cloudAudioRefs)) state.value = clean.preferences.audio[name]
  configTitle.value = clean.title; configKey.value = clean.key; configScale.value = clean.scaleType
  configTimeSignature.value = clean.timeSignature; configTimeSignatureUnit.value = clean.timeSignatureUnit
  configMeasuresCount.value = Math.min(clean.measures.length,currentPlan.value === 'PRO' ? 999 : 20)
  undoStack.value = []; isSetupMode.value = false
}

</script>
<template>
  <div class="h-[100dvh] w-full flex flex-col bg-[#F5FCE6] text-[#1C1C1E] font-sans antialiased overflow-hidden">
    
    <CloudWorkspace :context="cloudWorkspaceContext" :generation="cloudProjectGeneration" :toolbar-target="accountToolbarHost" @load="hydrateProjectDocument" @clear-account="clearAccountWorkspace" />
    <div v-if="isFreeLaunch" class="hidden md:block px-4 py-1 text-center text-xs text-gray-600 bg-white border-b border-gray-100">Próximamente: nuevas herramientas musicales.</div>
    <LaunchNotice v-if="isFreeLaunch && isUpgradeModalOpen"
      :message="upgradeReason === 'limit' ? 'Puedes crear hasta 20 compases por composición FREE. Tu composición se conserva completa.' : 'Próximamente: nuevas herramientas musicales.'"
      @close="isUpgradeModalOpen = false" />
    <transition name="fade" mode="out-in">
      
      <!-- ==================== WIZARD (GREEN ACCENT) ==================== -->
      <div v-if="isSetupMode" class="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <div class="max-w-2xl mx-auto w-full pt-12 pb-8 px-4 sm:px-6">
          <div class="flex items-center justify-between mb-8 px-0 sm:px-4 gap-1">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <img :src="logoUrl" alt="HarmoniGrid Logo" class="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl object-cover shadow-sm border border-gray-250/50" />
              <h1 class="text-[24px] sm:text-[34px] leading-tight font-bold text-black tracking-tight flex items-center gap-2">
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
              <button v-show="!isFreeLaunch"
                @click="setPlan('PRO')" 
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
                class="px-3 py-1 text-xs rounded-full transition-all flex items-center gap-0.5"
              >
                👑 PRO
              </button>
            </div>
            <div ref="accountToolbarHost" class="shrink-0"></div>
          </div>
          <div class="space-y-6">
            <!-- Bloque 1: General -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#8EE000]/10 overflow-visible">
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <label for="configTitle" class="text-[17px] font-semibold text-gray-800">Título de la canción</label>
                <input id="configTitle" name="configTitle" v-model="configTitle" type="text" class="text-[17px] text-right text-[#6CA600] font-semibold focus:outline-none w-1/2 bg-transparent" placeholder="Ej: Mi Canción" />
              </div>
              
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Compases Iniciales</span>
                <div class="flex items-center gap-3">
                  <button @click="configMeasuresCount = Math.max(1, configMeasuresCount - 1)" class="w-8 h-8 rounded-full bg-[#8EE000]/10 text-[#6CA600] flex items-center justify-center active:bg-[#8EE000]/20">-</button>
                  <input 
                    id="configMeasuresCount"
                    name="configMeasuresCount"
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
                    <div v-for="group in METRIC_GROUPS.filter(group => !isFreeLaunch || group.items.some(item => !item.isPro))" :key="group.label" class="space-y-1">
                      <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider px-2 pt-1">{{ group.label }}</div>
                      <div class="flex flex-col">
                        <button v-show="!isFreeLaunch || !item.isPro"
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
                    <div v-show="!isFreeLaunch" class="border-t border-gray-100 mt-1 pt-1">
                      <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider px-2 pt-1 flex items-center gap-1.5">
                        Personalizada
                        <span class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded font-black">PRO</span>
                      </div>
                      <!-- PRO: editable inputs -->
                      <div v-if="currentPlan === 'PRO'" class="flex items-center gap-1.5 px-2 py-1.5">
                        <input
                          id="configTimeSignature"
                          name="configTimeSignature"
                          type="number"
                          min="1" max="32"
                          :value="configTimeSignature"
                          @input="configTimeSignature = Math.max(1, parseInt($event.target.value) || 4)"
                          class="w-10 text-center text-sm font-black border border-gray-300 rounded-lg py-1 focus:border-[#8EE000] focus:outline-none"
                          placeholder="Nº"
                        />
                        <span class="text-gray-400 font-black text-lg leading-none">/</span>
                        <select
                          id="configTimeSignatureUnit"
                          name="configTimeSignatureUnit"
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
                      <button v-show="!isFreeLaunch || !s.isPro" v-for="s in group.items" :key="s.id" @click="selectConfigScale(s.id)" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-[14px] flex justify-between font-medium items-center">
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
        <header class="flex items-center justify-between px-2 sm:px-4 h-14 md:h-16 shrink-0 bg-[#8EE000] border-b border-[#8EE000]/25 z-20 sticky top-0 shadow-sm">
          <div class="flex items-center gap-1.5 sm:gap-3">
            <img :src="logoUrl" alt="HarmoniGrid Logo" class="w-8 h-8 rounded-lg object-cover border border-black/15 shadow-sm cursor-pointer hover:scale-105 transition-transform hidden sm:block" @click="isSetupMode = true" />
            <button @click="isSetupMode = true" class="text-black font-black text-[14px] sm:text-[16px] flex items-center hover:opacity-75 transition-opacity">
              <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-0.5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
              <span class="hidden sm:inline">Atrás</span>
            </button>
          </div>
          
          <div class="flex-1 text-center font-bold text-[14px] sm:text-[18px] text-black truncate px-1 max-w-[100px] sm:max-w-none">
            <input id="songTitle" name="songTitle" v-model="title" class="bg-transparent text-center focus:outline-none w-full placeholder-gray-800 font-black text-black" />
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
              <button v-show="!isFreeLaunch"
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
            <div ref="accountToolbarHost" class="shrink-0"></div>
          </div>
        </header>
        <!-- TOOLBAR (Key & Repeats) -->
        <div :class="{'mobile-controls-expanded':mobilePanel === 'tools'}" class="editor-command-toolbar px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap justify-between items-center z-40 gap-3 shrink-0">
          
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
                    <button v-show="!isFreeLaunch || !s.isPro" v-for="s in group.items" :key="s.id" @click="selectMainScale(s.id)" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-[14px] flex justify-between font-medium items-center">
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
            <div v-if="!isFreeLaunch && currentPlan === 'PRO'" class="mobile-groove-control relative dropdown-container">
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
                    <button v-show="!isFreeLaunch || g === 'Ninguno'"
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
              <button v-show="!isFreeLaunch" class="px-3 py-1.5 text-[12px] text-gray-400 font-bold flex items-center gap-1" disabled>
                Expandir compases <span class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1 rounded font-black">PRO</span>
              </button>
            </div>
            <!-- Modo Selección Toggle -->
            <button 
              @click="toggleSelectionMode" 
              class="mobile-range-toggle text-[14px] font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border"
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
                <span>Herramientas</span>
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
                      <button v-show="!isFreeLaunch" class="flex-1 text-center py-1.5 text-[11px] text-gray-400 font-bold flex items-center justify-center gap-0.5" disabled>
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
                  <button v-show="!isFreeLaunch"
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
                  <button v-show="!isFreeLaunch"
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
            <button v-show="!isFreeLaunch"
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
            <button v-show="!isFreeLaunch"
              @click="handleTransposeButtonClick" 
              class="hidden md:flex text-[14px] font-bold items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              <span>🔄 Transportar</span>
              <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black">PRO</span>
            </button>
          </div>
        </div>
        <!-- SUB-TOOLBAR PROMO/EXPLANATION CAPTION -->
        <div class="px-4 py-1.5 bg-gray-50 border-b border-gray-200/80 text-[12px] text-gray-500 hidden md:flex items-center gap-1.5 select-none shrink-0">
          <span v-if="currentPlan === 'FREE'" class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-[#8EE000] rounded-full animate-ping"></span>
            <span><strong>FREE:</strong> Usa repeticiones para optimizar tu estructura.</span>
          </span>
          <span v-else class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-violet-500 rounded-full animate-ping"></span>
            <span><strong v-show="!isFreeLaunch">PRO:</strong> Expande tu música y visualízala completamente, sin límites ni repeticiones ocultas.</span>
          </span>
        </div>
          <nav v-if="isMobileEditor" class="mobile-editor-toolbar" aria-label="Controles musicales">
            <button @click.stop="togglePlayback" :class="{'mobile-stop':isPlaying}" :aria-label="isPlaying ? 'Detener reproducción' : 'Reproducir composición'">{{ isPlaying ? '■ Detener' : '▶ Play' }}</button>
            <button @click.stop="toggleMobilePanel('audio')" :aria-expanded="mobilePanel === 'audio'" aria-controls="music-cabins">Audio</button>
            <button @click.stop="toggleMobilePanel('voicing')" :aria-expanded="mobilePanel === 'voicing'" aria-controls="music-cabins">Voicings</button>
            <button @click.stop="toggleMobilePanel('tools')" :aria-expanded="mobilePanel === 'tools'" aria-controls="music-cabins">Letras / más</button>
          </nav>
        <!-- GRID AREA -->
        <main ref="editorScrollHost" class="flex-1 overflow-y-auto px-2 py-3 md:px-4 md:py-8 relative" @click="closeDropdowns">

          <div class="w-full max-w-[1450px] mx-auto flex flex-col md:flex-row gap-4 md:gap-4 px-1 md:px-2">
            
            <!-- GLOBAL INDICATORS -->
            <div id="music-cabins" :data-mobile-panel="mobilePanel || 'closed'" class="mobile-music-cabins grid grid-cols-2 md:flex md:flex-col items-start md:items-center pt-2 flex-shrink-0 select-none text-center w-full md:w-auto gap-3 pb-3 md:pb-0">
              <div v-if="isMobileEditor && mobilePanel" class="mobile-panel-header col-span-2 flex justify-between items-center w-full">
                <strong>{{ mobilePanel === 'audio' ? 'Audio y reproducción' : mobilePanel === 'voicing' ? 'Voicings del acorde seleccionado' : 'Letras y herramientas' }}</strong>
                <button @click.stop="mobilePanel = null" class="min-h-11 px-3" aria-label="Cerrar ajustes">Cerrar</button>
              </div>
              <!-- Interactive Key Signature Info Badge (Now above Time Signature) -->
              <button 
                @click="isKeyInfoOpen = true; isVerMasExpanded = false" 
                class="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-[#8EE000] active:scale-[0.97] transition-all w-full md:w-full h-20 md:h-auto flex-shrink-0 text-center shadow-sm animate-scale-up"
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
              <div class="relative w-full md:w-full flex justify-center mt-0 md:mt-2 select-none z-35 flex-shrink-0">
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

              <!-- Notation Mode Toggle (Grados Romanos vs Acordes - PRO) -->
              <div v-show="!isFreeLaunch" class="w-full md:w-full mt-0 md:mt-2 flex-shrink-0">
                <button
                  @click="toggleNotationMode"
                  class="w-full flex items-center justify-between px-2 py-2 rounded-xl border transition-all shadow-sm active:scale-98"
                  :class="notationMode === 'roman' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-violet-500/20' : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100 text-gray-700'"
                  title="Cambiar entre notación de Acordes (Cmaj7, Dm7) y Grados Romanos (Imaj7, ii7) para estudio armónico"
                >
                  <div class="flex flex-col text-left leading-none">
                    <span class="text-[9px] font-black uppercase tracking-wider">🏛️ Notación</span>
                    <span class="text-[7.5px] font-bold mt-1 truncate" :class="notationMode === 'roman' ? 'text-violet-100' : 'text-gray-500'">
                      {{ notationMode === 'roman' ? 'Grados Romanos' : 'Acordes / Notas' }}
                    </span>
                  </div>
                  <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[7px] px-1 py-0.5 rounded font-black shrink-0 ml-1">PRO</span>
                </button>
              </div>
              
              <!-- Global Subdivisions Toggle (visible per-score in sidebar) -->
              <div class="w-full md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label v-show="!isFreeLaunch" class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1.5 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Mostrar/ocultar subdivisiones en todos los compases">
                  <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-tight">‖ Sub</span>
                  <div class="relative">
                    <input 
                      id="globalShowSubdivisions"
                      name="globalShowSubdivisions"
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
              <div class="w-full md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label v-show="!isFreeLaunch" class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Modo Rítmico: Los acordes respetarán la duración exacta de las figuras">
                  <div class="flex flex-col text-center md:text-left">
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-none">♩ Ritmo</span>
                    <span class="text-[7.5px] text-gray-400 font-bold leading-none mt-0.5">Armónico</span>
                  </div>
                  <div class="relative">
                    <input 
                      id="globalShowObligado"
                      name="globalShowObligado"
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
              <div class="w-full md:w-full mt-0 md:mt-2 flex-shrink-0">
                <label class="flex flex-col md:flex-row items-center justify-center md:justify-between gap-1 md:gap-2 px-2 py-2 rounded-xl border border-gray-200 bg-gray-50/80 cursor-pointer hover:bg-gray-100 transition-colors h-20 md:h-auto" title="Mostrar/ocultar letras y anotaciones en los compases">
                  <div class="flex flex-col text-center md:text-left">
                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-wider leading-none">✎ Letras</span>
                    <span class="text-[7.5px] text-gray-400 font-bold leading-none mt-0.5">Anotaciones</span>
                  </div>
                  <div class="relative">
                    <input 
                      id="showLyricsGlobal"
                      name="showLyricsGlobal"
                      type="checkbox" 
                      v-model="showLyricsGlobal"
                      class="sr-only peer"
                    >
                    <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8EE000]"></div>
                  </div>
                </label>
              </div>
              
              <!-- Suggestions Toggle Button -->
              <div v-show="!isFreeLaunch" class="w-full md:w-full mt-0 md:mt-2 flex-shrink-0 animate-scale-up">
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

              <!-- SIDEBAR PLAYBACK & AUDIO CONTROLLER (Below Ideas) -->
              <div data-cabin="audio" class="col-span-2 w-full md:w-full mt-2 flex-shrink-0 bg-white/90 backdrop-blur-md border border-gray-200/90 rounded-2xl p-2 md:p-3 shadow-sm space-y-2 text-left">
                <div class="flex items-center justify-between border-b border-gray-100 pb-1">
                  <span class="text-[8.5px] md:text-[9px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1">
                    <span>🎧</span> Audio & Play
                  </span>
                  <button 
                    @click="isAudioSettingsOpen = !isAudioSettingsOpen"
                    class="min-h-10 min-w-10 md:min-h-0 md:min-w-0 text-[10px] px-1.5 py-0.5 rounded-lg border transition-all"
                    :class="isAudioSettingsOpen ? 'border-[#8EE000] bg-[#8EE000]/20 text-[#6CA600]' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'"
                    title="Ajustes de Sonido, Voicings y Continuidad"
                  >
                    ⚙️
                  </button>
                </div>

                <!-- Play/Stop & BPM Row -->
                <div class="flex flex-col md:flex-row items-center gap-1.5">
                  <button 
                    @click="togglePlayback" 
                    class="w-full md:flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 text-white font-bold text-[10px] md:text-xs transition-all active:scale-95 shadow-sm"
                    :class="isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-[#8EE000] hover:bg-[#7bc200] text-black shadow-[#8EE000]/20'"
                    :title="isPlaying ? 'Detener Reproducción' : 'Reproducir'"
                  >
                    <span>{{ isPlaying ? '■' : '▶' }}</span>
                    <span>{{ isPlaying ? 'Detener' : 'Play' }}</span>
                  </button>
                  <div class="flex items-center justify-between w-full md:w-auto bg-gray-50 border border-gray-200 rounded-xl px-2 py-0.5">
                    <span class="text-[7.5px] font-black text-gray-400 uppercase tracking-tighter">BPM</span>
                    <input 
                      type="number" 
                      v-model.number="playbackBpm" 
                      min="40" 
                      max="240" 
                      class="w-8 md:w-10 bg-transparent text-center text-[10px] md:text-xs font-black text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>

                <!-- Start From Measure Selector -->
                <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                  <span class="text-[8px] font-black text-gray-500 uppercase tracking-wider">Desde compás:</span>
                  <input 
                    type="number" 
                    v-model.number="playbackStartMeasure" 
                    min="1" 
                    :max="measuresWithKey.length" 
                    class="w-10 bg-white border border-gray-200 rounded text-center text-[10px] font-bold text-gray-800 focus:outline-none focus:border-[#8EE000]"
                    title="Compás de inicio para la reproducción"
                  />
                </div>

                <!-- Metrónomo Toggle & Sound Selector -->
                <div class="flex flex-col gap-1 bg-gray-50/80 border border-gray-200/70 rounded-xl p-1.5">
                  <div class="flex items-center justify-between">
                    <button 
                      @click="playbackMetronome = !playbackMetronome"
                      class="px-1.5 py-0.5 rounded-lg text-[9.5px] md:text-[10px] font-black transition-all flex items-center gap-1"
                      :class="playbackMetronome ? 'bg-[#8EE000]/20 text-[#6CA600]' : 'text-gray-400 hover:text-gray-600'"
                      title="Activar/Desactivar Metrónomo"
                    >
                      <span>🔔</span>
                      <span>Metrónomo</span>
                    </button>
                    <div class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" :class="playbackMetronome ? 'bg-[#8EE000] animate-pulse' : 'bg-gray-300'"></div>
                  </div>
                  <select 
                    v-if="playbackMetronome"
                    v-model="playbackMetronomeSound"
                    class="w-full bg-white border border-gray-200 rounded-lg text-[9px] md:text-[9.5px] font-bold text-gray-700 py-0.5 px-1 focus:outline-none focus:border-[#8EE000]"
                  >
                    <option value="beep">Beep</option>
                    <option value="woodblock">Madera</option>
                    <option value="cowbell">Cencerro</option>
                    <option value="rimshot">Rimshot</option>
                  </select>
                </div>

                <!-- Acordes (Sonido) Toggle & Instrument Selector -->
                <div class="flex flex-col gap-1 bg-gray-50/80 border border-gray-200/70 rounded-xl p-1.5">
                  <div class="flex items-center justify-between">
                    <button 
                      @click="playbackChordsActive = !playbackChordsActive"
                      class="px-1.5 py-0.5 rounded-lg text-[9.5px] md:text-[10px] font-black transition-all flex items-center gap-1"
                      :class="playbackChordsActive ? 'bg-[#8EE000]/20 text-[#6CA600]' : 'text-gray-400 hover:text-gray-600'"
                      title="Activar/Silenciar Acordes"
                    >
                      <span>🎹</span>
                      <span>Sonido</span>
                    </button>
                    <div class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" :class="playbackChordsActive ? 'bg-[#8EE000] animate-pulse' : 'bg-gray-300'"></div>
                  </div>
                  <select 
                    v-if="playbackChordsActive"
                    v-model="playbackInstrument"
                    class="w-full bg-white border border-gray-200 rounded-lg text-[9px] md:text-[9.5px] font-bold text-gray-700 py-0.5 px-1 focus:outline-none focus:border-[#8EE000]"
                  >
                    <option value="rhodes">Rhodes</option>
                    <option value="piano">Piano</option>
                    <option value="guitar">Guitarra</option>
                    <option value="organ">Órgano</option>
                  </select>
                </div>

                <!-- AUDIO SETTINGS EXPANDABLE PANEL (⚙️) -->
                <transition name="fade">
                  <div v-if="isAudioSettingsOpen" class="pt-2 border-t border-gray-200 space-y-2 text-[9px]">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-gray-700">Continuidad Armónica</span>
                      <input type="checkbox" v-model="playbackContinuity" class="accent-[#8EE000]">
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-gray-700">Rellenar compás</span>
                      <input type="checkbox" v-model="playbackFillChords" class="accent-[#8EE000]">
                    </div>
                    <div class="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span class="font-black text-violet-900 flex items-center gap-1">
                        <span>🎸</span> Solo Bajo (Línea de bajo)
                      </span>
                      <input type="checkbox" v-model="playbackBassOnly" class="accent-violet-600">
                    </div>
                    <div class="space-y-0.5">
                      <span class="font-bold text-gray-500 block">Voicing Tétradas:</span>
                      <select v-model="playbackTetradVoicing" class="w-full bg-gray-50 border border-gray-200 rounded text-[9px] p-1 font-bold">
                        <option value="fundamental">Fundamental</option>
                        <option value="drop2">Drop 2 (5-1-3-7)</option>
                        <option value="inversion1">1ª Inversión (3-5-7-1)</option>
                        <option value="inversion2">2ª Inversión (5-7-1-3)</option>
                        <option value="inversion3">3ª Inversión (7-1-3-5)</option>
                      </select>
                    </div>
                    <div class="space-y-0.5">
                      <span class="font-bold text-gray-500 block">Voicing Tríadas:</span>
                      <select v-model="playbackTriadVoicing" class="w-full bg-gray-50 border border-gray-200 rounded text-[9px] p-1 font-bold">
                        <option value="fundamental">Fundamental</option>
                        <option value="inversion1">1ª Inversión (3-5-1)</option>
                        <option value="inversion2">2ª Inversión (5-1-3)</option>
                      </select>
                    </div>
                  </div>
                </transition>
              </div>

              <!-- SIDEBAR VOICING & NOTE ORDER INSPECTOR -->
              <div 
                data-cabin="voicing" v-if="activeChordVoicingList"
                class="col-span-2 w-full md:w-full mt-2 flex-shrink-0 bg-white/90 backdrop-blur-md border border-violet-200/80 rounded-2xl p-2 md:p-3 shadow-sm space-y-2 text-left animate-scale-up"
              >
                <div class="flex items-center justify-between border-b border-violet-100 pb-1">
                  <div class="flex items-center gap-1">
                    <span class="text-xs">🎼</span>
                    <span class="text-[8.5px] md:text-[9px] font-black uppercase tracking-wider text-violet-900">Voicing & Notas</span>
                  </div>
                  
                  <select 
                    :value="selectedMeasureIndex !== null ? selectedMeasureIndex : 0"
                    @change="selectedMeasureIndex = Number($event.target.value)"
                    class="text-[8.5px] font-bold text-violet-900 bg-violet-100/80 border border-violet-200 rounded-lg px-1 py-0.5 focus:outline-none cursor-pointer"
                    title="Seleccionar compás para inspeccionar y editar voicing"
                  >
                    <option 
                      v-for="(m, mIdx) in measures" 
                      :key="mIdx" 
                      :value="mIdx"
                    >
                      Compás #{{ mIdx + 1 }} {{ m.beats && m.beats.find(b => b.root) ? '(' + formatChord(m.beats.find(b => b.root)) + ')' : '' }}
                    </option>
                  </select>
                </div>

                <div class="flex items-center justify-between bg-violet-50/70 rounded-xl px-2 py-1">
                  <span class="text-[9px] font-medium text-violet-800">Acorde:</span>
                  <span class="text-xs md:text-sm font-black text-violet-950">{{ activeChordVoicingList.formattedName }}</span>
                </div>

                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[8px] font-extrabold text-violet-900/70 uppercase tracking-wider">Orden de notas (Voicing):</span>
                    <span class="hidden md:inline text-[7.5px] font-bold text-gray-400" title="Arrastra cualquier nota hacia arriba o abajo">✋ Arrastra para ordenar</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <div 
                      v-for="(n, idx) in activeChordVoicingList.notes" 
                      :key="n.noteName + idx" 
                      draggable="true"
                      @dragstart="onVoicingDragStart(idx, $event)"
                      @dragover.prevent="onVoicingDragOver(idx, $event)"
                      @drop="onVoicingDrop(idx, $event)"
                      @dragend="onVoicingDragEnd"
                      class="flex items-center justify-between border rounded-xl px-1.5 py-1 text-[9px] font-bold transition-all cursor-grab active:cursor-grabbing select-none shadow-2xs"
                      :class="[
                        n.isMuted ? 'opacity-50 line-through bg-gray-100 border-gray-300' :
                        (draggedVoicingIndex === idx ? 'opacity-40 scale-95 border-dashed border-violet-500 bg-violet-50' : 
                        (dragOverVoicingIndex === idx ? 'border-violet-600 ring-2 ring-violet-300 bg-violet-50/80 scale-102 shadow-md' : 'bg-white border-gray-200 hover:border-violet-300 hover:bg-violet-50/30'))
                      ]"
                    >
                      <div class="flex items-center gap-1 min-w-0">
                        <span class="text-gray-400 hover:text-violet-600 text-[10px] font-black cursor-grab shrink-0 tracking-tighter" title="Arrastra esta nota arriba o abajo">⣿</span>
                        <span 
                          class="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
                          :class="idx === 0 && activeChordVoicingList.isSlashChord ? 'bg-amber-500' : (n.isRoot ? 'bg-violet-600' : 'bg-gray-500')"
                        >
                          {{ idx === 0 && activeChordVoicingList.isSlashChord ? 'B' : (n.isRoot ? '1' : idx + 1) }}
                        </span>
                        <span class="font-black text-gray-800 truncate text-[10px]">{{ n.noteName }}</span>
                        <span class="text-[8px] text-gray-400 font-normal">({{ n.interval }})</span>
                      </div>
                      
                      <button v-if="idx > 0" @click.stop="reorderActiveChordVoicing(idx, 0)"
                        class="md:hidden min-h-10 px-2 rounded-lg border border-violet-200 text-violet-800 text-xs"
                        :aria-label="'Usar ' + n.noteName + ' como bajo'">Bajo</button>
                      <!-- Mute / Unmute Note Button -->
                      <button 
                        @click.stop="toggleVoicingNoteMute(n)" 
                        class="w-10 h-10 md:w-5 md:h-5 rounded-lg border flex items-center justify-center text-[10px] transition-all active:scale-90 shrink-0"
                        :class="n.isMuted ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-violet-600 hover:border-violet-300'"
                        :title="n.isMuted ? 'Activar nota ' + n.noteName : 'Silenciar (mutear) nota ' + n.noteName"
                      >
                        {{ n.isMuted ? '🔇' : '🔊' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div data-cabin="voicing" v-if="!activeChordVoicingList" class="md:hidden col-span-2 w-full rounded-2xl border border-violet-200 bg-white p-3 text-left">
                <p class="text-sm font-bold text-violet-900">🎼 Voicing &amp; Notas</p>
                <p class="mt-1 text-sm text-gray-600">Añade un acorde y selecciona su compás para ver y ajustar sus notas.</p>
              </div>
            </div>
            
            <!-- MEASURES SYSTEMS GRID -->
            <div class="flex-1 space-y-8 min-w-0 overflow-x-auto md:overflow-x-visible">
              <!-- Asistente de Sugerencias Panel -->
              <transition name="fade">
                <div v-if="!isFreeLaunch && isSuggestionsPanelOpen" class="bg-gradient-to-tr from-amber-50/80 to-amber-100/35 backdrop-blur-md border border-amber-250/70 rounded-3xl p-5 shadow-lg shadow-amber-100/10 animate-scale-up space-y-4">
                  <div class="flex items-center justify-between border-b border-amber-200/50 pb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">💡</span>
                      <div >
                        <h3 class="text-xs font-black text-amber-950 uppercase tracking-wider">Asistente de Sugerencias Inteligentes (PRO)</h3>
                        <p class="text-[10px] text-amber-800/80 font-medium">
                          <span v-if="allSuggestionsPool.length > 0">Se detectaron {{ allSuggestionsPool.length }} consejos específicos para tu progresión</span>
                          <span v-else>Sugerencias adaptadas a {{ translateNoteToSpanish(key) }} {{ SCALES[scaleType]?.name || scaleType }}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <button @click="refreshSuggestions" class="bg-white hover:bg-amber-50 text-amber-800 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-amber-200 shadow-xs flex items-center gap-1 active:scale-[0.97] transition-all">
                        🔄 Refrescar
                      </button>
                      <button  @click="isSuggestionsPanelOpen = false" class="text-amber-800 hover:text-amber-950 text-xs font-bold bg-amber-200/40 w-6 h-6 rounded-full flex items-center justify-center">✕</button>
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
              <template v-if="isMobileEditor && !isOrderingModeActive">
                <template v-if="!isSelectionMode && mobileFocusedSystem && mobileFocusedIndex !== null">
                  <div class="mobile-detail-header">
                    <button @click="closeMobileMeasure">← Vista general</button>
                    <h2 data-mobile-detail-heading tabindex="-1">Compás {{ mobileFocusedSystem.measures[0].originalMeasureIndex + 1 }}</h2>
                    <div class="flex gap-2">
                      <button :disabled="mobileFocusedIndex === 0" @click="openMobileMeasure(mobileFocusedIndex - 1)" aria-label="Compás anterior">←</button>
                      <button :disabled="mobileFocusedIndex >= displayedMeasures.length - 1" @click="openMobileMeasure(mobileFocusedIndex + 1)" aria-label="Compás siguiente">→</button>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mb-4">Toca un pulso para asignar el acorde. Los cambios se conservan al volver.</p>
                  <div class="mobile-detail-score overflow-x-auto pb-6">
                    <ScoreSystem :system="mobileFocusedSystem" :index="-1" :context="scoreRenderContext" />
                  </div>
                </template>
                <template v-else>
                  <form v-if="isSelectionMode" @submit.prevent="applyMobileRange" class="mobile-range-form mb-3" aria-label="Seleccionar rango de compases">
                    <div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <label class="text-xs font-semibold text-gray-700">Desde
                        <input v-model="mobileRangeFrom" @input="mobileRangeError = ''" type="number" inputmode="numeric" min="1" :max="measures.length" step="1" class="block w-full min-w-0 h-11 mt-1 px-2 rounded-lg border border-gray-300 text-base bg-white" />
                      </label>
                      <label class="text-xs font-semibold text-gray-700">Hasta
                        <input v-model="mobileRangeTo" @input="mobileRangeError = ''" type="number" inputmode="numeric" min="1" :max="measures.length" step="1" class="block w-full min-w-0 h-11 mt-1 px-2 rounded-lg border border-gray-300 text-base bg-white" />
                      </label>
                      <button type="submit" class="h-11 px-3 rounded-lg bg-[#8EE000] text-sm font-bold">Seleccionar</button>
                    </div>
                    <p v-if="mobileRangeError" role="alert" class="text-sm text-red-700 mt-2">{{ mobileRangeError }}</p>
                  </form>
                  <MobileScoreOverview :measures="displayedMeasures" :playback="playbackRenderState" :selected="mobileFocusedIndex"
                    :selection-mode="isSelectionMode" :range-start="selectedRangeStart" :range-end="selectedRangeEnd" :range-anchor="mobileRangeAnchor"
                    :can-add="!isSelectionMode && (currentPlan === 'PRO' || measures.length < FREE_MEASURE_LIMIT)" @select="selectMobileMeasure" @open="openMobileMeasure" @add="addMeasure" />
                </template>
              </template>
              <template v-else>
              <ScoreViewport v-for="(system, sIdx) in systems" :key="system.id" :system="system" :index="sIdx" :context="scoreRenderContext" :virtual="displayedMeasures.length > 80" @register="registerSystemViewport" @visibility-change="updateConnectors">
                <ScoreSystem :system="system" :index="sIdx" :context="scoreRenderContext" />
              </ScoreViewport>
              </template>
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
                <button v-show="!isFreeLaunch"
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
            class="mobile-selection-actions fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-white/85 backdrop-blur-xl border border-gray-200/80 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all"
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
            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <!-- Botón COPIAR -->
              <button 
                @click="copySelectedMeasures" 
                class="flex-1 sm:flex-initial px-3.5 py-2 text-[13px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-250 border border-gray-300 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                📋 COPIAR
              </button>
              
              <!-- Botón PEGAR (visible si hay compases copiados) -->
              <button 
                v-if="copiedMeasures !== null"
                @click="pasteCopiedMeasures" 
                class="flex-1 sm:flex-initial px-3.5 py-2 text-[13px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-100/50 active:scale-95 flex items-center justify-center gap-1"
              >
                📥 PEGAR
              </button>

              <button 
                @click="openTimesSelector" 
                class="flex-1 sm:flex-initial px-4 py-2 text-[14px] font-bold rounded-xl transition-all shadow-md active:scale-95"
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-200/50' : 'bg-[#8EE000] text-black shadow-[#8EE000]/20'"
              >
                REPETIR
              </button>
              
              <button v-show="!isFreeLaunch"
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
            v-if="!isMobileEditor && isSelectionMode && (selectedRangeStart === null || selectedRangeEnd === null)"
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
                    id="customTimes"
                    name="customTimes"
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
              <div v-if="!isFreeLaunch && currentPlan === 'PRO'" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
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
              <div v-show="!isFreeLaunch" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
                <span class="block text-xs font-bold text-gray-400 uppercase tracking-wider">🎓 Visualización / Ámbito Educativo</span>
                
                <div class="space-y-4 divide-y divide-gray-150">
                  <!-- Subdivisiones Toggle -->
                  <div class="flex items-center justify-between pt-1">
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Subdivisión (sólo para este compás)</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Activa las subdivisiones de compás de manera independiente.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        id="tempShowSubdivisions"
                        name="tempShowSubdivisions"
                        type="checkbox" 
                        :checked="tempShowSubdivisions" 
                        @change="toggleLocalSubdivisions($event)"
                        class="sr-only peer"
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8EE000]"></div>
                    </label>
                  </div>
                  
                  <!-- Obligado Rítmico Toggle -->
                  <div class="flex items-center justify-between pt-3">
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Ritmo Armónico (sólo para este compás)</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Activa la edición y visualización de figuras rítmicas de manera independiente.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        id="tempShowObligado"
                        name="tempShowObligado"
                        type="checkbox" 
                        :checked="tempShowObligado" 
                        @change="toggleLocalObligado($event)"
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
                
                <button v-show="!isFreeLaunch" @click="isMeasureOptionsOpen = false; isSelectionMode = true; clearSelection()" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">🔢</span>
                    <div>
                      <span class="block text-[16px] font-bold text-gray-800">Crear Casillas (Rango)</span>
                      <span class="block text-xs text-gray-400 mt-0.5">Casillas de 1ra y 2da vuelta (PRO)</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <button v-show="!isFreeLaunch" @click="startKeyChangeSetup" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
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
                <button v-show="!isFreeLaunch" @click="startLocalMetricSetup" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
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

              <!-- Botones de Aplicación -->
              <div class="pt-2 flex flex-col gap-2">
                <button 
                  @click="saveMeasureOptions(true)"
                  class="w-full py-3 bg-[#8EE000] hover:bg-[#7bc200] text-black font-extrabold rounded-xl transition-all active:scale-98 text-sm shadow-sm"
                >
                  Aplicar sólo a este compás
                </button>
                <button 
                  @click="saveMeasureOptions(false)"
                  class="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold rounded-xl transition-all active:scale-98 text-sm shadow-sm"
                >
                  Aplicar a todos a partir de este compás
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
              <div class="w-12"></div>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 class="text-base font-extrabold text-gray-800">Selecciona la métrica para este compás</h4>
                <p class="text-xs text-gray-500 mt-1 font-medium">Afectará a este compás y a los siguientes en el timeline hasta encontrar otro cambio de métrica.</p>
              </div>
              <!-- Metric selection options -->
              <div class="space-y-4">
                <div v-for="group in METRIC_GROUPS.filter(group => !isFreeLaunch || group.items.some(item => !item.isPro))" :key="group.label" class="space-y-2">
                  <div class="text-[10px] font-black text-gray-400 uppercase tracking-wider">{{ group.label }}</div>
                  <div class="grid grid-cols-2 gap-2">
                    <button v-show="!isFreeLaunch || !item.isPro"
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
              <div v-show="!isFreeLaunch" class="pt-4 border-t border-gray-200 space-y-3">
                <h5 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Métrica Personalizada (PRO)</h5>
                <div class="flex items-center gap-3">
                  <div class="flex-1">
                    <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Numerador</label>
                    <input 
                      id="localMetricBeats"
                      name="localMetricBeats"
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
                      id="localMetricUnit"
                      name="localMetricUnit"
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
                    id="tempLocalGroupingStr"
                    name="tempLocalGroupingStr"
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
              <!-- Botones de Acción / Aplicar -->
              <div class="pt-4 border-t border-gray-200 flex flex-col gap-2">
                <button 
                  @click="saveLocalTimeSignature(true)"
                  class="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-xl transition-all active:scale-98 text-sm shadow-sm"
                >
                  Aplicar sólo a este compás
                </button>
                <button 
                  @click="saveLocalTimeSignature(false)"
                  class="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-750 font-bold rounded-xl transition-all active:scale-98 text-sm"
                >
                  Aplicar a todos a partir de este compás
                </button>
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
                  name="applyAllSub"
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
                  En este pulso el acorde se conserva escrito, pero no produce un ataque porque está marcado como silencio. La indicación armónica puede seguir describiendo el contexto musical durante ese silencio.
                  Puedes cambiar la figura rítmica de este pulso en la sección "Ritmo Armónico" más abajo para seleccionar un patrón compatible que tenga una nota en este tiempo.
                </p>
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

              <!-- 4b. PRÉSTAMOS MODALES (Intercambio Modal Multimodal) -->
              <div v-if="modalInterchangeGroups && modalInterchangeGroups.length > 0" class="mt-4 pt-4 border-t border-amber-200/60 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="block text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <span>🎨</span> Préstamos Modales (Intercambio Modal)
                  </span>
                  <span class="text-[8.5px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                    {{ translateNoteToSpanish(activeModalKeyAndScale.key) }} {{ SCALES[activeModalKeyAndScale.scale]?.name || activeModalKeyAndScale.scale }}
                  </span>
                </div>
                
                <div v-for="group in modalInterchangeGroups" :key="group.id" class="bg-amber-50/60 border border-amber-200/80 p-3 rounded-2xl space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-amber-900 uppercase tracking-wide flex items-center gap-1">
                      <span>✨</span> {{ group.title }}
                    </span>
                    <span class="text-[8px] bg-white text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                      {{ group.badge }}
                    </span>
                  </div>
                  
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <button 
                      v-for="chord in group.chords" 
                      :key="chord.degreeNumeral + chord.label"
                      @click="selectChord(chord)"
                      class="bg-white border border-amber-200 hover:border-amber-400 rounded-xl py-2.5 flex flex-col items-center justify-center shadow-sm active:scale-95 transition-all group"
                    >
                      <span class="text-[9.5px] text-amber-700 font-extrabold mb-0.5 uppercase tracking-widest">{{ chord.degreeNumeral }}</span>
                      <span class="text-base font-black text-gray-900 group-hover:text-amber-950">{{ chord.label }}</span>
                    </button>
                  </div>
                </div>
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
                  <button v-show="!isFreeLaunch"
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
                    <button v-show="!isFreeLaunch"
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
                <span v-show="!isFreeLaunch" class="text-[9px] bg-violet-100 text-violet-750 font-black px-1.5 py-0.5 rounded uppercase tracking-wide">PRO</span>
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
            <div v-if="activeEditingBeat && (wasBeatAlreadySet || getEffectiveRhythm(measures[selectedBeat.measureIndex], measures[selectedBeat.measureIndex]?.beats[selectedBeat.beatIndex], selectedBeat.beatIndex) !== 'quarter') && currentPlan === 'PRO' && measures[selectedBeat.measureIndex]?.showObligado" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-2">
                  <span>🥁</span> <span>Ritmo Armónico</span>
                </h4>
                <span v-show="!isFreeLaunch" v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide">👑 PRO</span>
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
                  <span class="block text-[11px] font-black text-violet-750 uppercase tracking-wider">{{ getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit === 8 ? 'Patrón de la Familia de Semicorcheas (2 Notas)' : 'Patrón de la Familia de Corcheas (2 Notas)' }}</span>
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
                        <svg class="h-4 w-12 text-current shrink-0 select-none mb-0.5" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key, getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit === 8)"></svg>
                        <span class="text-[9px] font-bold truncate block mt-0.5 select-none"
                              :class="activeEditingBeat.eighthPattern === key || (!activeEditingBeat.eighthPattern && key === '2_notes' && getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit !== 8) ? 'text-white/70' : 'text-gray-400'">
                          {{ getPatternLabel(key, pat, getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit === 8) }}
                        </span>
                      </div>
                      <span v-if="activeEditingBeat.eighthPattern === key || (!activeEditingBeat.eighthPattern && key === '2_notes' && getMeasureTimeSignature(measures[selectedBeat.measureIndex]).unit !== 8)" class="text-white text-xs font-black shrink-0 ml-2">✓</span>
                    </button>
                  </div>
                </div>
                <!-- Triplet pattern sub-selector -->
                <div v-if="activeEditingBeat.harmonicRhythm === 'triplet'" class="mt-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100 space-y-2 text-left">
                  <span class="block text-[11px] font-black text-violet-750 uppercase tracking-wider">Patrón de la Familia de Tresillos</span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button 
                      v-for="(pat, key) in TRIPLET_PATTERNS" 
                      :key="key"
                      @click="selectTripletPatternInModal(pat, key)"
                      class="px-3 py-2 rounded-xl border transition-all text-left flex items-center justify-between"
                      :class="activeEditingBeat.tripletPattern === key || (!activeEditingBeat.tripletPattern && key === '3_notes')
                        ? 'bg-violet-600 border-violet-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 border-gray-200'"
                    >
                      <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <svg class="h-4 w-12 text-current shrink-0 select-none mb-0.5" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key)"></svg>
                        <span class="text-[9px] font-bold truncate block mt-0.5 select-none"
                              :class="activeEditingBeat.tripletPattern === key || (!activeEditingBeat.tripletPattern && key === '3_notes') ? 'text-white/70' : 'text-gray-400'">
                          {{ pat.label }}
                        </span>
                      </div>
                      <span v-if="activeEditingBeat.tripletPattern === key || (!activeEditingBeat.tripletPattern && key === '3_notes')" class="text-white text-xs font-black shrink-0 ml-2">✓</span>
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
            <div v-show="!isFreeLaunch" v-if="activeModalNextChord && secondaryAlternativeChords.length > 0" class="space-y-3 pt-4 border-t border-gray-200">
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
            
            <!-- 4c. CONSTRUCTOR DE ACORDE (CUSTOM CHORD BUILDER) -->
            <div class="mt-6 pt-5 border-t-2 border-emerald-100/80 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🛠️</span>
                  <div>
                    <span class="block text-xs font-black text-emerald-900 uppercase tracking-wider">
                      Constructor de Acorde (Personalizado)
                    </span>
                    <span class="block text-[10px] text-gray-500 font-medium">
                      Crea sustituciones armónicas, tensiones no diatónicas y acordes de jazz paso a paso
                    </span>
                  </div>
                </div>
                <button 
                  v-if="activeEditingBeat && activeEditingBeat.root"
                  @click="loadChordIntoBuilder(activeEditingBeat)"
                  class="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shrink-0"
                >
                  🔄 Recargar Actual
                </button>
              </div>

              <div class="bg-white border border-emerald-200/80 p-4 rounded-2xl space-y-4 shadow-sm">
                <!-- GRID DE CASILLAS DEL CONSTRUCTOR -->
                <div class="space-y-3.5">
                  
                  <!-- CASILLA 1: Nota Raíz (Obligatoria) -->
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-[11px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1">
                        <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">1</span>
                        Nota Raíz (Obligatoria)
                      </span>
                      <span v-if="!builderState.rootBase" class="text-[10px] text-amber-600 font-bold animate-pulse">Selecciona una nota para comenzar</span>
                    </div>
                    <div class="grid grid-cols-7 gap-1.5">
                      <button 
                        v-for="note in ['C', 'D', 'E', 'F', 'G', 'A', 'B']" 
                        :key="note"
                        @click="builderState.rootBase = note"
                        :class="builderState.rootBase === note 
                          ? 'bg-emerald-600 text-white font-black shadow-md border-emerald-600' 
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold border-gray-200'"
                        class="py-2 rounded-xl text-xs sm:text-sm border transition-all text-center"
                      >
                        {{ translateNoteToSpanish(note) }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 2: Alteración (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">2</span>
                      Alteración (Opcional)
                    </span>
                    <div class="grid grid-cols-3 gap-2">
                      <button 
                        @click="builderState.accidental = ''"
                        :class="builderState.accidental === '' ? 'bg-emerald-600 text-white font-black' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-xs border transition-all"
                      >
                        Natural (♮)
                      </button>
                      <button 
                        @click="builderState.accidental = '#'"
                        :class="builderState.accidental === '#' ? 'bg-emerald-600 text-white font-black' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-xs border transition-all"
                      >
                        Sostenido (♯)
                      </button>
                      <button 
                        @click="builderState.accidental = 'b'"
                        :class="builderState.accidental === 'b' ? 'bg-emerald-600 text-white font-black' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-xs border transition-all"
                      >
                        Bemol (♭)
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 3: Tríada Base (Obligatoria) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">3</span>
                      Tríada Base (Obligatoria)
                    </span>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button 
                        v-for="q in [
                          { id: 'maj', label: 'Mayor' },
                          { id: 'min', label: 'Menor' },
                          { id: 'dim', label: 'Disminuido' },
                          { id: 'aug', label: 'Aumentado' }
                        ]" 
                        :key="q.id"
                        @click="builderState.quality = q.id"
                        :class="builderState.quality === q.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-2 rounded-xl text-xs border transition-all"
                      >
                        {{ q.label }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 4: Séptima (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">4</span>
                      Séptima (Opcional)
                    </span>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button 
                        v-for="s in [
                          { id: '', label: 'Ninguna' },
                          { id: 'maj7', label: '7ma Mayor (maj7)' },
                          { id: 'm7', label: '7ma Menor / Dom (7)' },
                          { id: 'dim7', label: '7ma Disminuida' }
                        ]" 
                        :key="s.id"
                        @click="builderState.seventh = s.id"
                        :class="builderState.seventh === s.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-[11px] border transition-all"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 5: Extensión 1 - Novena (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">5</span>
                      Extensión 1: Novena (Opcional)
                    </span>
                    <div class="grid grid-cols-4 gap-2">
                      <button 
                        v-for="n in [
                          { id: '', label: 'Ninguna' },
                          { id: '9', label: '9na (9)' },
                          { id: 'b9', label: '9na Bemol (♭9)' },
                          { id: '#9', label: '9na Sost. (♯9)' }
                        ]" 
                        :key="n.id"
                        @click="builderState.ext9 = n.id"
                        :class="builderState.ext9 === n.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-[10.5px] border transition-all"
                      >
                        {{ n.label }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 6: Extensión 2 - Oncena (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">6</span>
                      Extensión 2: Oncena (Opcional)
                    </span>
                    <div class="grid grid-cols-3 gap-2">
                      <button 
                        v-for="o in [
                          { id: '', label: 'Ninguna' },
                          { id: '11', label: '11na (11)' },
                          { id: '#11', label: '11na Sost. (♯11)' }
                        ]" 
                        :key="o.id"
                        @click="builderState.ext11 = o.id"
                        :class="builderState.ext11 === o.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-[11px] border transition-all"
                      >
                        {{ o.label }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 7: Extensión 3 - Trecena (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">7</span>
                      Extensión 3: Trecena (Opcional)
                    </span>
                    <div class="grid grid-cols-4 gap-2">
                      <button 
                        v-for="t in [
                          { id: '', label: 'Ninguna' },
                          { id: '13', label: '13na (13)' },
                          { id: 'b13', label: '13na Bemol (♭13)' },
                          { id: '#13', label: '13na Sost. (♯13)' }
                        ]" 
                        :key="t.id"
                        @click="builderState.ext13 = t.id"
                        :class="builderState.ext13 === t.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-[10.5px] border transition-all"
                      >
                        {{ t.label }}
                      </button>
                    </div>
                  </div>

                  <!-- CASILLA 8: Extensión 4 / Modificadores (Opcional) -->
                  <div :class="{ 'opacity-40 pointer-events-none': !builderState.rootBase }">
                    <span class="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">8</span>
                      Extensión 4 / Modificadores (Opcional)
                    </span>
                    <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      <button 
                        v-for="m in [
                          { id: '', label: 'Ninguno' },
                          { id: '6', label: '6 (Sexta)' },
                          { id: '69', label: '6/9' },
                          { id: 'sus4', label: 'sus4' },
                          { id: 'sus2', label: 'sus2' },
                          { id: 'omit3', label: 'omit3' }
                        ]" 
                        :key="m.id"
                        @click="builderState.specialModifier = m.id"
                        :class="builderState.specialModifier === m.id ? 'bg-emerald-600 text-white font-black shadow-sm' : 'bg-gray-50 text-gray-700 font-bold border-gray-200'"
                        class="py-1.5 rounded-xl text-[11px] border transition-all"
                      >
                        {{ m.label }}
                      </button>
                    </div>
                  </div>

                </div>

                <!-- VISTA PREVIA Y ACCIÓN -->
                <div v-if="builderState.rootBase" class="pt-3 border-t border-emerald-100 space-y-3">
                  <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                    <div>
                      <span class="block text-[10px] text-emerald-800 font-black uppercase tracking-wider">Acorde Construido</span>
                      <span class="text-2xl font-black text-gray-900 tracking-tight block">
                        {{ formatChord(constructedChord) }}
                      </span>
                      <span class="text-[11px] font-extrabold text-emerald-700 block">
                        Grado: {{ getRomanNumeralForChord(constructedChord, activeModalKeyAndScale.key, activeModalKeyAndScale.scale) }}
                      </span>
                    </div>
                    <button 
                      @click="previewBuilderAudio" 
                      class="px-3.5 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-black text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95 shrink-0"
                    >
                      <span>🔊</span> <span>Probar Sonido</span>
                    </button>
                  </div>

                  <button 
                    @click="selectChord(constructedChord)"
                    class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-200/60 text-sm tracking-wide transition-all active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>✨</span> <span>Agregar / Aplicar Acorde a la Partitura</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- SUGGESTIONS MODAL (AMPOLLETA DE IDEAS) -->
        <div v-if="!isFreeLaunch && isSystemSuggestionsModalOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe flex flex-col max-h-[85vh] z-10 md:w-[600px] md:mx-auto md:rounded-3xl md:mb-10">
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
                      <span  v-if="currentPlan !== 'PRO'" class="text-[9.5px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-0.5 rounded-full font-black shadow-sm flex items-center gap-0.5">👑 PRO</span>
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
              <button v-show="!isFreeLaunch"
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
      <div v-if="!isFreeLaunch && isUpgradeModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div  class="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 text-center animate-scale-up">
          <div class="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span class="text-3xl">👑</span>
          </div>
          <h3 class="text-xl font-extrabold text-gray-900 mb-2">HarmoniGrid PRO</h3>
          
          <p class="text-sm text-gray-600 mb-6" v-if="upgradeReason === 'limit'">
            Has alcanzado el límite de 20 compases.<br><strong  class="text-violet-600">🚀 Pásate a PRO para compases ilimitados</strong> y escribe piezas musicales más largas.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'escalas'">
            Has seleccionado una escala avanzada o modo PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para usar las 26 escalas y modos</strong> y enriquecer tu vocabulario armónico.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'custom_layout'">
            La ordenación personalizada de compases es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para ordenar compases a tu gusto</strong>, cambiar la cantidad de compases por fila e insertar saltos de sistema.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'modulacion'">
            El análisis de modulación y consejos de arreglos avanzados es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para desbloquear el análisis Berklee</strong> y recibir consejos profesionales sobre transiciones de tonalidad.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'ritmo_armonico'">
            El Ritmo Armónico con subdivisiones de corcheas, semicorcheas y contratiempos es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para usar alta densidad armónica y cortes de banda</strong>.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'synced_lyrics'">
            El modo de Letras Sincronizadas te permite enlazar sílabas o palabras de tus letras directamente con acordes específicos.<br><strong  class="text-violet-600">🚀 Pásate a PRO para sincronizar tus letras y visualizarlas con conectores interactivos</strong>.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'rhythm_lyrics'">
            El modo de Letras Rítmicas (Rhythm Lyrics) te permite asociar sílabas exactas a eventos y subdivisiones rítmicas de la rejilla musical.<br><strong  class="text-violet-600">🚀 Pásate a PRO para componer con alineación temporal exacta, ligados y silencios</strong>.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'transpose'">
            El transporte inteligente de acordes (tonal, modal y funcional) es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para transportar tu partitura de forma inteligente</strong> y aprender cómo cambian los grados y las notas.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'alternativas_secundarias'">
            El Modo de Alternativas Secundarias es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para insertar dominantes secundarios, sustitutos de tritono, ii relacionados e intercambios modales</strong> directamente en tu partitura.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'expanded_pdf'">
            La exportación de partituras extendidas de acordes de forma lineal y desglosada (sin repeticiones) es una función PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO para exportar flujos de compases extendidos</strong>.
          </p>
          <p  class="text-sm text-gray-600 mb-6" v-else>
            Esta función requiere la versión PRO.<br><strong  class="text-violet-600">🚀 Pásate a PRO</strong> para usar casillas avanzadas y expandir tus compases sin límites.
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
          
          <button  @click="setPlan('PRO'); isUpgradeModalOpen = false" class="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-200/50 transition-all active:scale-[0.98]">
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
              <p class="text-[11px] text-gray-400">Puedes seleccionar una métrica para reestructurar todo tu score. Elige una de las métricas disponibles:</p>
              
              <div class="space-y-4">
                <div v-for="group in METRIC_GROUPS.filter(group => !isFreeLaunch || group.items.some(item => !item.isPro))" :key="group.label" class="space-y-1.5">
                  <div class="text-[9.5px] text-gray-400 font-black uppercase tracking-wider">{{ group.label }}</div>
                  <div class="grid grid-cols-3 gap-2">
                    <button v-show="!isFreeLaunch || !item.isPro"
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
            <div v-show="!isFreeLaunch" class="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
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
            <div v-show="!isFreeLaunch" class="flex items-center gap-2">
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
    <!-- ==================== PDF EXPORT MODAL ==================== -->
    <transition name="fade">
      <div v-if="isPdfExportModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="absolute inset-0" @click="isPdfExportModalOpen = false"></div>
        
        <div class="relative bg-white rounded-3xl shadow-2xl p-6 max-w-lg w-full border border-gray-150 text-left animate-scale-up z-10 flex flex-col max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="text-xl">📄</span>
              <h3 class="text-lg font-black text-gray-900">Exportar Partitura a PDF</h3>
            </div>
            <button @click="isPdfExportModalOpen = false" class="text-gray-400 hover:text-gray-600 text-sm font-bold bg-gray-100 w-7 h-7 rounded-full flex items-center justify-center">✕</button>
          </div>
          
          <!-- Content -->
          <div class="py-4 space-y-3.5 flex-1">
            <p class="text-xs text-gray-500 leading-relaxed">Selecciona el formato de exportación preferido para tu partitura PDF:</p>
            
            <div class="space-y-2">
              <!-- Opción 1: Sólo acordes -->
              <label class="flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none"
                :class="selectedPdfExportOption === 'chords-only' ? 'border-violet-600 bg-violet-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50/50'">
                <input id="pdf-chords-only" name="selectedPdfExportOption" type="radio" v-model="selectedPdfExportOption" value="chords-only" class="mt-1 text-violet-600 focus:ring-violet-500 border-gray-300">
                <div class="flex-1">
                  <div class="text-xs font-bold text-gray-900">Opción 1: Sólo acordes (Compacto)</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Muestra métricas, secciones, compases y acordes. Excluye cualquier letra. Consigue la máxima compacidad.</div>
                </div>
              </label>

              <!-- Opción 2: Sólo acordes extendidos -->
              <label v-show="!isFreeLaunch" class="flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none"
                :class="selectedPdfExportOption === 'chords-only-expanded' ? 'border-violet-600 bg-violet-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50/50'">
                <input id="pdf-chords-only-expanded" name="selectedPdfExportOption" type="radio" v-model="selectedPdfExportOption" value="chords-only-expanded" class="mt-1 text-violet-600 focus:ring-violet-500 border-gray-300">
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-900">Opción 2: Sólo acordes (Lineal sin repeticiones)</span>
                    <span v-if="currentPlan === 'FREE'" class="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-0.5">👑 PRO</span>
                  </div>
                  <div class="text-[11px] text-gray-555 mt-0.5">Expande y desglosa todas las repeticiones y casillas de forma lineal. No muestra barras de repetición.</div>
                </div>
              </label>

              <!-- Opción 3: Acordes y letra simple -->
              <label class="flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none"
                :class="selectedPdfExportOption === 'chords-and-lyrics-free' ? 'border-violet-600 bg-violet-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50/50'">
                <input id="pdf-chords-and-lyrics-free" name="selectedPdfExportOption" type="radio" v-model="selectedPdfExportOption" value="chords-and-lyrics-free" class="mt-1 text-violet-600 focus:ring-violet-500 border-gray-300">
                <div class="flex-1">
                  <div class="text-xs font-bold text-gray-900">Opción {{ isFreeLaunch ? 2 : 3 }}: Acordes y letra libre/simple</div>
                  <div class="text-[11px] text-gray-555 mt-0.5">Coloca las letras en formato libre directamente debajo de los compases, ajustadas al ancho del compás y apiladas verticalmente.</div>
                </div>
              </label>

              <!-- Opción 4: Acordes y letra asociada a la subdivisión -->
              <label v-show="!isFreeLaunch" class="flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none"
                :class="selectedPdfExportOption === 'chords-and-lyrics-rhythm' ? 'border-violet-600 bg-violet-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50/50'">
                <input id="pdf-chords-and-lyrics-rhythm" name="selectedPdfExportOption" type="radio" v-model="selectedPdfExportOption" value="chords-and-lyrics-rhythm" class="mt-1 text-violet-600 focus:ring-violet-500 border-gray-300">
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-900">Opción 4: Acordes y letra asociada por tiempo/subdivisión</span>
                    <span v-if="currentPlan === 'FREE'" class="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-0.5">👑 PRO</span>
                  </div>
                  <div class="text-[11px] text-gray-555 mt-0.5">Coloca las sílabas exactamente alineadas bajo los pulsos o subdivisiones en los que fueron asociadas.</div>
                </div>
              </label>

              <!-- Opción 5: Acordes y letra sincronizada Pro -->
              <label v-show="!isFreeLaunch" class="flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none"
                :class="selectedPdfExportOption === 'chords-and-lyrics-synced' ? 'border-violet-600 bg-violet-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50/50'">
                <input id="pdf-chords-and-lyrics-synced" name="selectedPdfExportOption" type="radio" v-model="selectedPdfExportOption" value="chords-and-lyrics-synced" class="mt-1 text-violet-600 focus:ring-violet-500 border-gray-300">
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-900">Opción 5: Acordes y letra sincronizada Pro</span>
                    <span v-if="currentPlan === 'FREE'" class="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-0.5">👑 PRO</span>
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Alineación silábica profesional. Las sílabas asociadas se centran bajo el acorde, mientras que los prefijos y sufijos de palabra fluyen ordenadamente a los lados.</div>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Footer Buttons -->
          <div class="mt-4 pt-4 border-t border-gray-100 flex gap-3">
            <button @click="isPdfExportModalOpen = false" class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold text-center active:scale-98 transition-all">
              Cancelar
            </button>
            <button v-show="!isFreeLaunch" v-if="currentPlan === 'FREE' && isProOptionSelected" @click="triggerProUpgradeForExport" class="flex-1 py-3 bg-gradient-to-r from-amber-500 to-violet-650 hover:from-amber-600 hover:to-violet-750 text-white rounded-xl text-xs font-bold text-center active:scale-98 transition-all shadow-md flex items-center justify-center gap-1.5">
              <span>Pasar a PRO para Exportar</span>
              <span>👑</span>
            </button>
            <button v-else @click="confirmExportPdf" class="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold text-center active:scale-98 transition-all shadow-md flex items-center justify-center gap-1.5">
              <span>Descargar PDF</span>
              <span>⬇️</span>
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
@media (max-width: 767px) {
  .mobile-selection-actions.mobile-selection-actions {bottom:max(8px,env(safe-area-inset-bottom));padding:8px;gap:8px;width:calc(100% - 16px)}
  .mobile-selection-actions > div:first-child > div:first-child {display:none}
  .mobile-selection-actions button {min-height:44px;font-size:12px;padding:6px 8px}
  .mobile-score-overview[data-selecting="true"] {padding-bottom:170px}
  .editor-command-toolbar.editor-command-toolbar {display:grid;grid-template-columns:44px minmax(0,1fr) minmax(0,1fr);padding:4px 8px;gap:4px}
  .editor-command-toolbar > div {display:contents}
  .editor-command-toolbar .mobile-groove-control {display:none;grid-column:1 / -1;order:10}
  .editor-command-toolbar.mobile-controls-expanded .mobile-groove-control {display:block}
  .editor-command-toolbar > div > div {min-width:0}
  .editor-command-toolbar > div > button,.editor-command-toolbar > div > div > button {min-height:44px;font-size:12px;padding:4px 6px;gap:4px;max-width:100%;white-space:nowrap}
  .editor-command-toolbar > div > div > button {width:100%;justify-content:center}
  .editor-command-toolbar > div > div > button > span {overflow:hidden;text-overflow:ellipsis}
  .editor-command-toolbar .mobile-range-toggle {grid-column:1 / span 2;justify-content:center}
  .mobile-editor-toolbar {position:relative;flex-shrink:0;z-index:35;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;background:white;border-bottom:1px solid #d9e8c2;padding:4px 8px;margin:0}
  .mobile-editor-toolbar button {min-height:44px;font-size:12px;font-weight:700;border-radius:8px;color:#365900}
  .mobile-editor-toolbar button:first-child {background:#8ee000;color:#111}
  .mobile-editor-toolbar button.mobile-stop {background:#b91c1c;color:white}
  .mobile-editor-toolbar button[aria-expanded="true"] {background:#e0ebcc}
  .mobile-music-cabins[data-mobile-panel="closed"] {display:none}
  .mobile-music-cabins[data-mobile-panel="audio"] > :not([data-cabin="audio"]):not(.mobile-panel-header),
  .mobile-music-cabins[data-mobile-panel="voicing"] > :not([data-cabin="voicing"]):not(.mobile-panel-header),
  .mobile-music-cabins[data-mobile-panel="tools"] > [data-cabin] {display:none}
  .mobile-panel-header {font-size:14px;color:#334155;border-bottom:1px solid #cbd5e1}
  .mobile-detail-header {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
  .mobile-detail-header h2 {font-size:16px;font-weight:700}
  .mobile-detail-header button {min-height:44px;min-width:44px;font-size:14px;color:#365900;background:white;border:1px solid #cbd5e1;border-radius:8px;padding:8px}
  .mobile-detail-header button:disabled {opacity:.4}
  .mobile-editor-toolbar button:focus-visible,.mobile-detail-header button:focus-visible {outline:3px solid #6d28d9;outline-offset:2px}
  .mobile-music-cabins > * { min-width: 0; }
  .mobile-music-cabins span { font-size: max(12px, 1em); }
  .mobile-music-cabins select { min-height: 44px; max-width: 100%; font-size: 16px; }
  .mobile-music-cabins input:not([type="checkbox"]) {min-height:44px;font-size:16px;min-width:64px}
  .mobile-music-cabins button {min-height:44px}
  .mobile-detail-score textarea {font-size:16px}
}

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
