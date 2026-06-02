// src/core/suggestions.js
import { NOTE_TO_INDEX, transposeNote } from './notes.js'
import { getScaleNotes, SCALES } from './scales.js'
import { getKeySignature } from './keySignatures.js'
import { 
  getDiatonicFunction, 
  getDiatonicRelationship, 
  getSecondaryDominant, 
  getModalInterchange, 
  getCadence, 
  getReharmonization 
} from './harmonicKnowledge.js'

/**
 * Obtiene el grado en números romanos de un acorde dada una tonalidad y escala
 */
export function getChordDegree(chordRoot, chordType, keyRoot, scaleType) {
  if (!chordRoot || !keyRoot) return ''
  
  const scaleNotes = getScaleNotes(keyRoot, scaleType)
  const scaleIndex = scaleNotes.indexOf(chordRoot)
  
  // Si la nota está en la escala, buscamos el numeral correspondiente
  if (scaleIndex !== -1) {
    const scaleDef = SCALES[scaleType]
    if (scaleDef && scaleDef.degrees && scaleDef.degrees[scaleIndex]) {
      return scaleDef.degrees[scaleIndex].numeral
    }
  }
  
  // Si es cromático (fuera de la escala), calculamos el intervalo en semitonos
  const rootIdx = NOTE_TO_INDEX[chordRoot]
  const keyIdx = NOTE_TO_INDEX[keyRoot]
  if (rootIdx === undefined || keyIdx === undefined) return ''
  
  const semitones = (rootIdx - keyIdx + 12) % 12
  const isMinor = ['min', 'm7', 'm7b5', 'mM7', 'min7', 'dim', 'dim7', 'm', 'minor'].includes(chordType || '')
  const isDim = ['dim', 'dim7', 'm7b5'].includes(chordType)
  
  if (isDim) {
    const dimMap = {
      0: 'i°', 1: 'bII°', 2: 'ii°', 3: 'bIII°', 4: 'iii°', 5: 'iv°', 
      6: '#iv°', 7: 'v°', 8: 'bVI°', 9: 'vi°', 10: 'bVII°', 11: 'vii°'
    }
    return dimMap[semitones] || 'i°'
  }
  
  if (isMinor) {
    const minMap = {
      0: 'i', 1: 'bii', 2: 'ii', 3: 'biii', 4: 'iii', 5: 'iv', 
      6: '#iv', 7: 'v', 8: 'bvi', 9: 'vi', 10: 'bvii', 11: 'vii'
    }
    return minMap[semitones] || 'i'
  }
  
  const majMap = {
    0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV', 
    6: '#IV', 7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII'
  }
  return majMap[semitones] || 'I'
}

const getThirdOfRoot = (root, type, keyContext) => {
  const isMinor = ['min', 'm7', 'm7b5', 'dim', 'dim7', 'mM7', 'min7'].includes(type)
  const offset = isMinor ? 3 : 4
  return transposeNote(root, offset, keyContext)
}

function getChordNotes(root, type, keyContext) {
  const notes = { root: root }
  
  // Third
  const isMinor = ['min', 'm7', 'm7b5', 'dim', 'dim7', 'mM7', 'min7', 'minor'].includes(type)
  notes.third = transposeNote(root, isMinor ? 3 : 4, keyContext)
  
  // Fifth
  const isDim = ['dim', 'dim7', 'm7b5'].includes(type)
  notes.fifth = transposeNote(root, isDim ? 6 : 7, keyContext)
  
  // Seventh
  if (['maj7', 'maj9', 'mM7'].includes(type)) {
    notes.seventh = transposeNote(root, 11, keyContext)
  } else if (['m7', '7', 'm7b5', 'min7', '9', 'm9', '7sus4'].includes(type)) {
    notes.seventh = transposeNote(root, 10, keyContext)
  } else if (type === 'dim7') {
    notes.seventh = transposeNote(root, 9, keyContext)
  }
  
  return notes
}

function explainNoteResolution(note, chordB, keyContext) {
  const bNotes = getChordNotes(chordB.root, chordB.type, keyContext)
  const noteIdx = NOTE_TO_INDEX[note]
  
  // Check if it is a common tone
  for (const [role, bNote] of Object.entries(bNotes)) {
    if (bNote === note) {
      const roleSpanish = { root: 'fundamental', third: 'tercera', fifth: 'quinta', seventh: 'séptima' }[role]
      return `la nota ${note} se mantiene como **nota común**, convirtiéndose en la ${roleSpanish} de ${chordB.root}${chordB.type || ''}, lo que proporciona un enlace extremadamente estable y suave`
    }
  }
  
  // Check stepwise resolution (half step or whole step)
  for (const [role, bNote] of Object.entries(bNotes)) {
    const bNoteIdx = NOTE_TO_INDEX[bNote]
    if (noteIdx !== undefined && bNoteIdx !== undefined) {
      const diff = (bNoteIdx - noteIdx + 12) % 12
      const roleSpanish = { root: 'fundamental', third: 'tercera', fifth: 'quinta', seventh: 'séptima' }[role]
      
      if (diff === 1) { // Resolves UP by 1 semitone (half step)
        return `la nota ${note} resuelve por **semitono ascendente** directo hacia la ${roleSpanish} (${bNote}) de ${chordB.root}${chordB.type || ''}, creando una conducción de voces muy melódica`
      } else if (diff === 11) { // Resolves DOWN by 1 semitone (half step)
        return `la nota ${note} conduce por **semitono descendente** (sensible) hacia la ${roleSpanish} (${bNote}) de ${chordB.root}${chordB.type || ''}, ofreciendo una resolución de gran fluidez`
      } else if (diff === 2) { // Resolves UP by 2 semitones (whole step)
        return `la nota ${note} se desplaza por **paso conjunto ascendente** hacia la ${roleSpanish} (${bNote}) de ${chordB.root}${chordB.type || ''}`
      } else if (diff === 10) { // Resolves DOWN by 2 semitones (whole step)
        return `la nota ${note} desciende por **paso conjunto** hacia la ${roleSpanish} (${bNote}) de ${chordB.root}${chordB.type || ''}`
      }
    }
  }
  
  return `la nota ${note} enriquece el registro superior en la transición hacia ${chordB.root}`
}

/**
 * Analiza un sistema específico de 4 compases y genera sugerencias basadas en la Base de Conocimiento Armónico.
 */
export function getSuggestionsForSystem(systemMeasures, systemStartIdx, keyRoot, scaleType) {
  const candidates = []
  if (!systemMeasures || systemMeasures.length !== 4) return candidates

  // Verificar la restricción: debe haber exactamente 1 acorde por compás (4 acordes en 4 compases)
  const isValidProgression = systemMeasures.every(m => m.beats.filter(b => b.root).length === 1)
  if (!isValidProgression) return candidates

  const startIdx = systemStartIdx
  const systemIndex = systemStartIdx // Use systemStartIdx for unique rule IDs

  // Aplanar los acordes del sistema, propagando la tonalidad activa
  let currentKey = keyRoot
  let currentScale = scaleType
  
  const activeChords = []
  systemMeasures.forEach((m, localMIdx) => {
    const globalMIdx = startIdx + localMIdx
    if (m.keyChange) {
      currentKey = m.keyChange.key
      currentScale = m.keyChange.scaleType || 'major'
    }
    
    m.beats.forEach((b, bIdx) => {
      if (b.root) {
        activeChords.push({
          root: b.root,
          type: b.type,
          tension: b.tension,
          tensions: b.tensions || [],
          bass: b.bass,
          globalMeasureIndex: globalMIdx,
          localMeasureIndex: localMIdx,
          beatIndex: bIdx,
          activeKey: currentKey,
          activeScale: currentScale,
          degree: getChordDegree(b.root, b.type, currentKey, currentScale)
        })
      }
    })
  })

  // Asegura que hay 4 acordes activos correspondientes a los 4 compases
  if (activeChords.length !== 4) return candidates

  const normDegree = (deg) => {
    if (!deg) return ''
    return deg
      .replace('7', '')
      .replace('maj', '')
      .replace('min', '')
      .replace('°', '')
      .replace('ø', '')
      .replace('+', '')
      .replace(/^[b♭#♯]/i, '')
  }

  const getNineNoteOfRoot = (root, keyCtx) => {
    return transposeNote(root, 2, keyCtx)
  }

  const isMinorScale = scaleType === 'minor'
  const isDorianScale = scaleType === 'dorian'
  const isPhrygianScale = scaleType === 'phrygian'
  const isLydianScale = scaleType === 'lydian'
  const isMixolydianScale = scaleType === 'mixolydian'
  const isLocrianScale = scaleType === 'locrian'
  const isHarmonicMinorScale = scaleType === 'harmonic_minor'
  const isLocrianSharp6Scale = scaleType === 'locrian_sharp6'
  const isIonianSharp5Scale = scaleType === 'ionian_sharp5'
  const isDorianSharp4Scale = scaleType === 'dorian_sharp4'
  const isPhrygianDominantScale = scaleType === 'phrygian_dominant'
  const isLydianSharp2Scale = scaleType === 'lydian_sharp2'
  const isUltralocrianScale = scaleType === 'ultralocrian'
  
  const isMelodicMinorScale = scaleType === 'melodic_minor'
  const isDorianFlat2Scale = scaleType === 'dorian_flat2'
  const isLydianAugmentedScale = scaleType === 'lydian_augmented'
  const isLydianDominantScale = scaleType === 'lydian_dominant'
  const isMixolydianFlat6Scale = scaleType === 'mixolydian_flat6'
  const isLocrianSharp2Scale = scaleType === 'locrian_sharp2'
  const isAlteredScale = scaleType === 'altered'
  const isDiminishedWHScale = scaleType === 'diminished_wh'
  const isDiminishedHWScale = scaleType === 'diminished_hw'
  const isWholeToneScale = scaleType === 'whole_tone'
  const isPentatonicMajorScale = scaleType === 'pentatonic_major'
  const isPentatonicMinorScale = scaleType === 'pentatonic_minor'
  const isBluesScale = scaleType === 'blues'
  const isBebopDominantScale = scaleType === 'bebop_dominant'
  const isHungarianMajorScale = scaleType === 'hungarian_major'
  const isHungarianMinorScale = scaleType === 'hungarian_gypsy_minor'

  const originScaleLabel = isHungarianMajorScale ? 'Escala Mayor Húngara' :
    isHungarianMinorScale ? 'Escala Menor Húngara' :
    isPentatonicMajorScale ? 'Escala Pentatónica Mayor' :
    isPentatonicMinorScale ? 'Escala Pentatónica Menor' :
    isBluesScale ? 'Escala de Blues' :
    isBebopDominantScale ? 'Escala Bebop Dominante' :
    isDiminishedWHScale ? 'Escala Disminuida T-S' :
    isDiminishedHWScale ? 'Escala Disminuida S-T' :
    isWholeToneScale ? 'Escala de Tonos Enteros' :
    isAlteredScale ? 'Modo Alterado' :
    isLocrianSharp2Scale ? 'Modo Locrio ♮2' :
    isMixolydianFlat6Scale ? 'Modo Mixolidio ♭6' :
    isLydianDominantScale ? 'Modo Lidio Dominante' :
    isLydianAugmentedScale ? 'Modo Lidio Aumentado' :
    isDorianFlat2Scale ? 'Modo Dórico ♭2' :
    isMelodicMinorScale ? 'Menor Melódica' :
    isUltralocrianScale ? 'Modo Superlocrio Disminuido' :
    isLydianSharp2Scale ? 'Modo Lidio ♯2' :
    isPhrygianDominantScale ? 'Modo Frigio Dominante' :
    isDorianSharp4Scale ? 'Modo Dórico ♯4' :
    isIonianSharp5Scale ? 'Modo Jónico ♯5' :
    isLocrianSharp6Scale ? 'Modo Locrio ♮6' :
    isHarmonicMinorScale ? 'Menor Armónica' :
    isLocrianScale ? 'Modo Locrio' :
    isMixolydianScale ? 'Modo Mixolidio' :
    isLydianScale ? 'Modo Lidio' :
    isPhrygianScale ? 'Modo Frigio' :
    isDorianScale ? 'Modo Dórico' :
    isMinorScale ? 'Menor Natural' : 'Escala Mayor'


  // ==================== 🟢 ENRIQUECIMIENTO (enrich) ====================

  // Regla 1: Tríadas a Tétradas
  const triadChordIdx = activeChords.findIndex(c => ['maj', 'min', 'm', ''].includes(c.type))
  if (triadChordIdx !== -1) {
    const triadChord = activeChords[triadChordIdx]
    const isMin = ['min', 'm'].includes(triadChord.type)
    const isV = normDegree(triadChord.degree) === 'V'
    const newType = isMin ? 'm7' : (isV ? '7' : 'maj7')
    const seventhOffset = newType === 'maj7' ? 11 : 10
    const seventhNote = transposeNote(triadChord.root, seventhOffset, triadChord.activeKey)
    const nextChord = activeChords[(triadChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(seventhNote, nextChord, triadChord.activeKey)

    candidates.push({
      id: `rule_1_${systemIndex}`,
      category: 'enrich',
      title: 'Convertir tríadas en acordes de séptima (Tétradas)',
      text: `Podrías explorar convertir la tríada simple de ${triadChord.root} en ${triadChord.root}${newType}. La incorporación de la séptima actúa como una voz interna activa que suaviza la transición hacia el siguiente acorde. En este caso, la séptima de ${triadChord.root}${newType} es la nota ${seventhNote}, la cual se conduce hacia el acorde de ${nextChord.root} de la siguiente manera: ${voiceLeadingText}.`,
      preview: `${triadChord.root} ➔ ${triadChord.root}${newType}`,
      payload: [
        { measureIndex: triadChord.globalMeasureIndex, beatIndex: triadChord.beatIndex, chord: { root: triadChord.root, type: newType, tensions: triadChord.tensions, bass: triadChord.bass } }
      ],
      metadata: {
        name: `${triadChord.root}${newType}`,
        categoryLabel: 'Enriquecimiento',
        function: `${triadChord.degree} ➔ ${triadChord.degree}${newType}`,
        origin: originScaleLabel,
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Baja-Media',
        styles: ['Pop', 'Rock', 'Jazz', 'Gospel'],
        explanation: `Incorpora la séptima como voz activa para suavizar la conducción melódica hacia el siguiente acorde. ${voiceLeadingText}.`
      }
    })
  }

  // Regla 2: Tétradas a 9
  const tetradChordIdx = activeChords.findIndex(c => ['maj7', 'm7', '7'].includes(c.type) && !c.tensions.includes('9'))
  if (tetradChordIdx !== -1) {
    const tetradChord = activeChords[tetradChordIdx]
    const nineNote = getNineNoteOfRoot(tetradChord.root, tetradChord.activeKey)
    const nextChord = activeChords[(tetradChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(nineNote, nextChord, tetradChord.activeKey)

    candidates.push({
      id: `rule_2_${systemIndex}`,
      category: 'enrich',
      title: 'Añadir extensión de Novena (9)',
      text: `Podrías explorar añadir la novena (9) al acorde de séptima ${tetradChord.root}${tetradChord.type}. Al incorporar la novena (${nineNote}), se genera una textura abierta y sofisticada que enriquece el registro agudo. En este caso, esta se conecta con el acorde siguiente (${nextChord.root}) así: ${voiceLeadingText}.`,
      preview: `${tetradChord.root}${tetradChord.type} ➔ ${tetradChord.root}${tetradChord.type}(9)`,
      payload: [
        { measureIndex: tetradChord.globalMeasureIndex, beatIndex: tetradChord.beatIndex, chord: { root: tetradChord.root, type: tetradChord.type, tensions: [...tetradChord.tensions, '9'], bass: tetradChord.bass } }
      ],
      metadata: {
        name: `${tetradChord.root}${tetradChord.type}(9)`,
        categoryLabel: 'Enriquecimiento',
        function: `${tetradChord.degree}(9)`,
        origin: originScaleLabel,
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Media',
        styles: ['Jazz', 'Gospel', 'Pop'],
        explanation: `Suma riqueza armónica mediante la extensión de novena (9), la cual se conduce de la siguiente manera hacia el destino: ${voiceLeadingText}.`
      }
    })
  }

  // Regla 3: Acorde Mayor a maj7 o add9
  const majChordIdx = activeChords.findIndex(c => ['maj', 'major', ''].includes(c.type) || (c.type === 'maj7' && !c.tensions.includes('9')))
  if (majChordIdx !== -1) {
    const majChord = activeChords[majChordIdx]
    const isTriad = ['maj', 'major', ''].includes(majChord.type)
    const previewStr = isTriad ? `${majChord.root}maj7` : `${majChord.root}maj9`
    const nextType = isTriad ? 'maj7' : majChord.type
    const nextTensions = isTriad ? majChord.tensions : [...majChord.tensions, '9']
    const addedNote = transposeNote(majChord.root, isTriad ? 11 : 2, majChord.activeKey)
    const nextChord = activeChords[(majChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(addedNote, nextChord, majChord.activeKey)

    candidates.push({
      id: `rule_3_${systemIndex}`,
      category: 'enrich',
      title: 'Dar color al acorde mayor (maj7 / add9)',
      text: `Para embellecer el acorde mayor ${majChord.root}, una opción sería enriquecerlo como ${previewStr}. Estas tensiones suavizan el ataque de la tríada. En esta transición, la tensión añadida (${addedNote}) se enlaza con el acorde siguiente (${nextChord.root}) de este modo: ${voiceLeadingText}.`,
      preview: `${majChord.root} ➔ ${previewStr}`,
      payload: [
        { measureIndex: majChord.globalMeasureIndex, beatIndex: majChord.beatIndex, chord: { root: majChord.root, type: nextType, tensions: nextTensions, bass: majChord.bass } }
      ],
      metadata: {
        name: previewStr,
        categoryLabel: 'Enriquecimiento',
        function: `${majChord.degree}(7/9)`,
        origin: originScaleLabel,
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Baja-Media',
        styles: ['Pop', 'Jazz', 'Cine'],
        explanation: `Suaviza el acorde mayor con colores armónicos de séptima o novena. La nota añadida (${addedNote}) se conecta hacia el siguiente acorde así: ${voiceLeadingText}.`
      }
    })
  }

  // Regla 4: Acorde Menor a m7 o m9
  const minChordIdx = activeChords.findIndex(c => ['min', 'minor', 'm'].includes(c.type) || (c.type === 'm7' && !c.tensions.includes('9')))
  if (minChordIdx !== -1) {
    const minChord = activeChords[minChordIdx]
    const isTriad = ['min', 'minor', 'm'].includes(minChord.type)
    const previewStr = isTriad ? `${minChord.root}m7` : `${minChord.root}m9`
    const nextType = isTriad ? 'm7' : minChord.type
    const nextTensions = isTriad ? minChord.tensions : [...minChord.tensions, '9']
    const addedNote = transposeNote(minChord.root, isTriad ? 10 : 2, minChord.activeKey)
    const nextChord = activeChords[(minChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(addedNote, nextChord, minChord.activeKey)

    candidates.push({
      id: `rule_4_${systemIndex}`,
      category: 'enrich',
      title: 'Enriquecer acorde menor (m7 / m9)',
      text: `Para darle mayor calidez al acorde menor de ${minChord.root}m, una opción pedagógica es convertirlo en ${previewStr}. Esto reduce el carácter melancólico directo de la tríada. En esta transición, la tensión añadida (${addedNote}) se conecta con el siguiente acorde (${nextChord.root}) así: ${voiceLeadingText}.`,
      preview: `${minChord.root}m ➔ ${previewStr}`,
      payload: [
        { measureIndex: minChord.globalMeasureIndex, beatIndex: minChord.beatIndex, chord: { root: minChord.root, type: nextType, tensions: nextTensions, bass: minChord.bass } }
      ],
      metadata: {
        name: previewStr,
        categoryLabel: 'Enriquecimiento',
        function: `${minChord.degree}(7/9)`,
        origin: originScaleLabel,
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Baja-Media',
        styles: ['Pop', 'Jazz', 'Cine'],
        explanation: `Incrementa la profundidad del acorde menor agregando séptima o novena. La tensión añadida (${addedNote}) resuelve así: ${voiceLeadingText}.`
      }
    })
  }

  // Regla 5: Variación en segunda vuelta
  const lastChord = activeChords[3]
  const firstChord = activeChords[0]
  if (lastChord.root === firstChord.root && systemIndex > 0) {
    const addedNote = transposeNote(lastChord.root, 11, lastChord.activeKey)
    const voiceLeadingText = explainNoteResolution(addedNote, firstChord, lastChord.activeKey)

    candidates.push({
      id: `rule_5_${systemIndex}`,
      category: 'enrich',
      title: 'Variar acorde de resolución en segunda vuelta',
      text: `Dado que el ciclo se repite, podrías explorar introducir una variación en el último acorde (${lastChord.root}) en esta vuelta, convirtiéndolo en maj7 para generar un sutil color armónico que rompa la monotonía. Al cerrar el ciclo e iniciar de nuevo, la séptima añadida (${addedNote}) se conduce hacia el acorde inicial (${firstChord.root}) de la siguiente forma: ${voiceLeadingText}.`,
      preview: `${lastChord.root} ➔ ${lastChord.root}maj7`,
      payload: [
        { measureIndex: lastChord.globalMeasureIndex, beatIndex: lastChord.beatIndex, chord: { root: lastChord.root, type: 'maj7', tensions: lastChord.tensions, bass: lastChord.bass } }
      ],
      metadata: {
        name: `${lastChord.root}maj7`,
        categoryLabel: 'Enriquecimiento',
        function: `${lastChord.degree}maj7`,
        origin: originScaleLabel,
        target: `${firstChord.root}${firstChord.type}`,
        tension: 'Baja-Media',
        styles: ['Pop', 'Jazz'],
        explanation: `Evita la monotonía en la repetición del ciclo armónico modificando el acorde final. La séptima mayor añadida (${addedNote}) se conecta hacia la tónica así: ${voiceLeadingText}.`
      }
    })
  }


  // ==================== 🟡 MOVIMIENTO ARMÓNICO (movement) ====================

  // Regla 6: ii -> V -> I incompleto (Completar cadencia)
  let iiv1Matched = false
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    const deg1 = c1.degree // Mantener marcas diatónicas completas
    const deg2 = c2.degree

    if (isHarmonicMinorScale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_harmonic_minor_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Menor Armónica Principal (V7 ➔ i)',
        text: `Se detecta la tónica menor i (${c2.root}${c2.type || ''}) en el compás siguiente. En la Escala Menor Armónica, te sugerimos anteponer el acorde de dominante principal V o V7 (${vRoot}7). La séptima mayor de la escala actúa como sensible tonal y crea una fuerte atracción resolutiva hacia la tónica menor. Este movimiento V7 ➔ i (ej: E7 ➔ Am) es la resolución insignia de las tonalidades menores y el puente hacia la armonía funcional clásica.`,
        preview: `${vRoot}7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V7 ➔ i',
          origin: 'Menor Armónica (Característico)',
          mode: 'Menor Armónica',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Clásico', 'Jazz', 'Gospel', 'Flamenco', 'Cine'],
          explanation: `El acorde de dominante V7 (ej: E7) contiene la sensible tonal (la séptima mayor de la escala) que resuelve por medio tono ascendente hacia la fundamental de la tónica i (ej: Am), logrando una atracción armónica perfecta.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isIonianSharp5Scale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_ionian_sharp5_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Jónica ♯5 Principal (V ➔ I+)',
        text: `Se detecta la tónica aumentada I+ (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Jónico ♯5, te sugerimos anteponer el acorde de dominante principal V (${vRoot} mayor). Este movimiento V ➔ I+ (ej: G ➔ Cmaj7#5) es la resolución diatónica más importante del modo, ya que el paso de la dominante V a la tónica aumentada I+ resuelve la tensión armónica de forma flotante e inestable, lo que constituye el sello característico del sonido Jónico ♯5.`,
        preview: `${vRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V ➔ I+',
          origin: 'Modo Jónico ♯5 (Característico)',
          mode: 'Jónico ♯5',
          target: `${c2.root}${c2.type}`,
          tension: 'Media-Alta',
          styles: ['Cine (Fantasía)', 'Jazz Moderno', 'Fusion'],
          explanation: `El movimiento V ➔ I+ (ej: G ➔ Cmaj7#5) es el pilar de la cadencia de Jónico ♯5. Resuelve la dominante mayor sobre una tónica aumentada de gran inestabilidad y brillo flotante.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isDorianSharp4Scale && normDegree(deg1) === 'i' && normDegree(deg2) !== 'iv') {
      const sharpIVRoot = getScaleNotes(c1.activeKey, c1.activeScale)[3] || transposeNote(c1.activeKey, 6, c1.activeKey)
      candidates.push({
        id: `rule_6_dorian_sharp4_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Color Dórico ♯4 (i ➔ #iv°)',
        text: `Se detecta la tónica menor i (${c1.root}${c1.type || ''}). En el Modo Dórico ♯4, te sugerimos resolver hacia el acorde característico de cuarta aumentada disminuido #iv° (${sharpIVRoot} disminuido). Este movimiento i ➔ #iv° (ej: Dm ➔ G#dim) es la firma armónica estrella del modo, combinando la base menor con el tritono característico del color Lidio para lograr un sonido sumamente moderno, cinematográfico y misterioso.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${sharpIVRoot}dim`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: sharpIVRoot, type: 'dim', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sharpIVRoot}dim`,
          categoryLabel: 'Movimiento Armónico',
          function: 'i ➔ #iv°',
          origin: 'Modo Dórico ♯4 (Característico)',
          mode: 'Dórico ♯4',
          target: `${sharpIVRoot}dim`,
          tension: 'Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Cine'],
          explanation: `El enlace de tónica menor al grado #iv° disminuido (ej: Dm ➔ G#dim) define la dualidad Dórico-Lidia del modo, introduciendo el intervalo característico de cuarta aumentada.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLocrianSharp6Scale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'II') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_locrian_sharp6_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Locria ♮6 Principal (♭II+ ➔ iø)',
        text: `Se detecta la tónica semidisminuida iø (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Locrio ♮6, te sugerimos anteponer el acorde característico de segunda bemol aumentada ♭II+ (${flatIIRoot} aumentado). Este movimiento ♭II+ ➔ iø (ej: C+ ➔ Bm7b5) es la resolución característica estrella del modo. La sexta mayor natural le da un color menos oscuro que el Locrio tradicional, resultando muy efectivo para generar tensión de misterio en cine o jazz moderno.`,
        preview: `${flatIIRoot}+ ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatIIRoot, type: 'aug', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}+`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭II+ ➔ iø',
          origin: 'Modo Locrio ♮6 (Característico)',
          mode: 'Locrio ♮6',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Cine', 'Metal Progresivo'],
          explanation: `El movimiento ♭II+ ➔ iø (ej: C+ ➔ Bm7b5) es el pilar armónico de Locrio ♮6. El acorde aumentado ♭II+ suaviza la inestabilidad de la tónica semidisminuida y aporta gran tensión modal.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isUltralocrianScale && (normDegree(deg1) === 'i' || normDegree(deg1) === 'VI') && normDegree(deg2) !== 'ii') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_ultralocrian_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Resolución de Tensión Máxima (Valt ➔ I)',
        text: `Se detecta la tensión del primer compás (${c1.root}${c1.type || ''}). En el Modo Superlocrio Disminuido, te sugerimos resolver hacia el acorde de tónica menor resolutiva ♭ii (${flatIIRoot} menor). Este movimiento (ej: E7alt ➔ Am o G#dim7 ➔ Am) es la función principal del modo, liberando la máxima tensión acumulada sobre una tónica menor o mayor estable de gran fuerza dramática.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${flatIIRoot}m`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: flatIIRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}m`,
          categoryLabel: 'Movimiento Armónico',
          function: 'Valt ➔ i / I',
          origin: 'Modo Superlocrio Disminuido (Resolución)',
          mode: 'Superlocrio Disminuido',
          target: `${flatIIRoot}m`,
          tension: 'Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Cine (Suspenso)'],
          explanation: `El modo Superlocrio Disminuido está diseñado para acumular tensiones extremas sobre el dominante (♭VI / V7alt) o el disminuido (i°), resolviendo con gran empuje por semitono ascendente hacia la tónica.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLydianSharp2Scale && normDegree(deg1) === 'I' && normDegree(deg2) !== 'ii') {
      const sharpIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 3, c1.activeKey)
      candidates.push({
        id: `rule_6_lydian_sharp2_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Tensión Característica Lidia ♯2 (I ➔ ♯ii°)',
        text: `Se detecta la tónica I (${c1.root}${c1.type || ''}). En el Modo Lidio ♯2, te sugerimos resolver hacia el acorde de segunda aumentada disminuido ♯ii° (${sharpIIRoot} disminuido). Este movimiento I ➔ ♯ii° (ej: F ➔ G#dim) es el enlace característico del modo. Combina la estabilidad de la tónica mayor con la tensión disminuida de la segunda aumentada, creando una sonoridad misteriosa, mágica y cinematográfica.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${sharpIIRoot}dim`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: sharpIIRoot, type: 'dim', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sharpIIRoot}dim`,
          categoryLabel: 'Movimiento Armónico',
          function: 'I ➔ ♯ii°',
          origin: 'Modo Lidio ♯2 (Característico)',
          mode: 'Lidio ♯2',
          target: `${sharpIIRoot}dim`,
          tension: 'Alta',
          styles: ['Cine (Fantasía)', 'Jazz Moderno', 'Videojuegos'],
          explanation: `El paso de tónica mayor I al grado ♯ii° disminuido (ej: F ➔ G#dim) explota el intervalo característico de segunda aumentada (#2) en combinación con el color Lidio del modo.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isPhrygianDominantScale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'II') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_phrygian_dominant_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Frigia Dominante (♭II ➔ I)',
        text: `Se detecta la tónica dominante I (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Frigio Dominante, te sugerimos anteponer el acorde característico mayor ♭II (${flatIIRoot} mayor). Este movimiento ♭II ➔ I (ej: F ➔ E) es la resolución estrella del modo, combinando la tensión exótica de la segunda menor con la estabilidad de la tónica mayor dominante.`,
        preview: `${flatIIRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭II ➔ I',
          origin: 'Modo Frigio Dominante (Característico)',
          mode: 'Frigio Dominante',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Flamenco', 'Música Árabe', 'Metal Neoclásico', 'Cine Épico'],
          explanation: `La resolución ♭II ➔ I (ej: F ➔ E) es el ADN del modo Frigio Dominante. El semitono descendente entre la fundamental de ♭II y la de I resuelve la inestabilidad con gran sonoridad exótica.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLocrianScale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'II') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_locrian_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Locria Principal (♭II ➔ i°)',
        text: `Se detecta la tónica disminuida i° (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Locrio, te sugerimos anteponer el acorde característico mayor ♭II (${flatIIRoot} mayor). Este movimiento ♭II ➔ i° (ej: C ➔ Bm7b5) es la resolución más importante del modo, ya que el acorde mayor ♭II refuerza inmediatamente la tensión disminuida de la tónica y establece claramente el carácter e identidad del sonido Locrio.`,
        preview: `${flatIIRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭II ➔ i°',
          origin: 'Modo Locrio (Característico)',
          mode: 'Locrio',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Metal Progresivo', 'Jazz Moderno', 'Cine'],
          explanation: `La resolución ♭II ➔ i° (ej: C ➔ Bm7b5) es el ADN del modo Locrio. El semitono descendente entre la fundamental de ♭II y la de i° resuelve la inestabilidad con gran peso dramático.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isMixolydianScale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'VII') {
      const flatVIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[6] || transposeNote(c1.activeKey, 10, c1.activeKey)
      candidates.push({
        id: `rule_6_mixolydian_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Mixolidia Principal (♭VII ➔ I)',
        text: `Se detecta la tónica I (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Mixolidio, te sugerimos anteponer el acorde característico de séptima bemol ♭VII (${flatVIIRoot} mayor). Este movimiento ♭VII ➔ I (ej: F ➔ G) reemplaza la resolución tonal clásica V-I y genera un enlace más abierto, con el bajo moviéndose por tono entero descendente, que es el verdadero sello del sonido rock, blues, funk y gospel.`,
        preview: `${flatVIIRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatVIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatVIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭VII ➔ I',
          origin: 'Modo Mixolidio (Característico)',
          mode: 'Mixolidio',
          target: `${c2.root}${c2.type}`,
          tension: 'Media-Baja',
          styles: ['Rock', 'Blues', 'Country', 'Funk', 'Gospel'],
          explanation: `El movimiento ♭VII ➔ I (ej: F ➔ G) es el pilar de la armonía mixolidia, eliminando la sensible para lograr una resolución abierta por paso de tono entero en el bajo.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLydianScale && normDegree(deg1) === 'I' && normDegree(deg2) !== 'II') {
      const iiRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 2, c1.activeKey)
      candidates.push({
        id: `rule_6_lydian_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Movimiento Lidio Característico (I ➔ II)',
        text: `Se detecta el acorde de tónica I (${c1.root}${c1.type || ''}) en Modo Lidio. Para experimentar la sonoridad más pura y de ensueño de este modo, te sugerimos pasar al acorde II mayor (${iiRoot} mayor). El acorde II contiene la nota #4 (${transposeNote(c1.activeKey, 6, c1.activeKey)}), que es la nota característica del Lidio y rompe la sonoridad tradicional de subdominante, creando una sensación de flotación y amplitud majestuosa.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${iiRoot}`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: iiRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: 'I ➔ II',
          origin: 'Modo Lidio (Característico)',
          mode: 'Lidio',
          target: `${iiRoot}`,
          tension: 'Media-Baja',
          styles: ['Cine', 'Rock Progresivo', 'Ambient'],
          explanation: `El movimiento I ➔ II (ej: C ➔ D) es el ADN del modo Lidio. El segundo grado mayor (II) introduce la nota característica #4 (${transposeNote(c1.activeKey, 6, c1.activeKey)}), proporcionando el color flotante y cinematográfico del modo.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isPhrygianScale && (deg1.includes('iv') || deg1.includes('VII')) && deg2 === 'i') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      
      candidates.push({
        id: `rule_6_phrygian_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Frigia Principal (♭II ➔ i)',
        text: `Se detecta el paso de ${deg1} (${c1.root}${c1.type || ''}) a i (${c2.root}m) en Modo Frigio. Para sellar el carácter e identidad del modo, te sugerimos insertar el acorde característico ♭II (${flatIIRoot} Mayor) en el segundo tiempo. Esto creará la resolución por semitono descendente de bajo (${flatIIRoot} ➔ ${c2.root}), que es el verdadero ADN del sonido Frigio/Flamenco.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${flatIIRoot} ➔ ${c2.root}m`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: 2, chord: { root: flatIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭II ➔ i',
          origin: 'Modo Frigio (Característico)',
          mode: 'Frigio',
          target: `${c2.root}${c2.type}`,
          tension: 'Media-Alta',
          styles: ['Flamenco', 'Metal', 'Cine'],
          explanation: `El acorde característico ♭II (${flatIIRoot}) resuelve por semitono descendente hacia la tónica i (${c2.root}), siendo la resolución frigia más representativa y con mayor peso modal.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isMelodicMinorScale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      const iiRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 2, c1.activeKey)
      candidates.push({
        id: `rule_6_melodic_minor_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Menor Melódica Principal (ii ➔ V ➔ i)',
        text: `Se detecta la tónica menor i (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer la clásica progresión de jazz ii-V (ej: Bm7b5 ➔ E7) para resolver de forma sofisticada. La menor melódica combina la sonoridad menor con una sensible fuerte y una sexta mayor, permitiendo una resolución fluida.`,
        preview: `${iiRoot}m7b5 ➔ ${vRoot}7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7`,
          categoryLabel: 'Movimiento Armónico',
          function: 'ii ➔ V ➔ i',
          origin: 'Menor Melódica (Característico)',
          mode: 'Menor Melódica',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Jazz', 'Fusion', 'Gospel', 'Cine'],
          explanation: `Combina la tensión del dominante con la sensible para una resolución extremadamente fluida y moderna hacia la tónica.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isDorianFlat2Scale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'II') {
      const flatIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_dorian_flat2_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Dórica ♭2 (♭II ➔ i)',
        text: `Se detecta la tónica menor i (${c2.root}${c2.type || ''}) en el compás siguiente. En el Modo Dórico ♭2, te sugerimos anteponer el acorde característico ♭II (${flatIIRoot} mayor). Este movimiento ♭II ➔ i (ej: C ➔ Bm) mezcla la tensión oscura del Frigio con la apertura de la sexta mayor del Dórico.`,
        preview: `${flatIIRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭II ➔ i',
          origin: 'Modo Dórico ♭2 (Característico)',
          mode: 'Dórico ♭2',
          target: `${c2.root}${c2.type}`,
          tension: 'Media-Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Cine'],
          explanation: `El movimiento ♭II ➔ i aporta el carácter melancólico pero sofisticado y abierto del modo.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLydianAugmentedScale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'II') {
      const iiRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 2, c1.activeKey)
      candidates.push({
        id: `rule_6_lydian_augmented_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Lidia Aumentada (II ➔ I+maj7)',
        text: `Se detecta la tónica aumentada I+ (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer el acorde de segundo grado mayor II (${iiRoot} mayor), que genera el color brillante y flotante del modo.`,
        preview: `${iiRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: iiRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: 'II ➔ I+maj7',
          origin: 'Modo Lidio Aumentado (Característico)',
          mode: 'Lidio Aumentado',
          target: `${c2.root}${c2.type}`,
          tension: 'Media',
          styles: ['Cine', 'Jazz Moderno', 'Fusion'],
          explanation: `La combinación de la cuarta y quinta aumentadas genera un sonido sumamente abierto y suspendido.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLydianDominantScale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'VII') {
      const flatVIIRoot = getScaleNotes(c1.activeKey, c1.activeScale)[6] || transposeNote(c1.activeKey, 10, c1.activeKey)
      candidates.push({
        id: `rule_6_lydian_dominant_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Lidia Dominante (♭VII ➔ I7)',
        text: `Se detecta la tónica I7 (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer el acorde ♭VII (${flatVIIRoot} mayor) para resolver por tono entero descendente en el bajo, un movimiento insignia del jazz y la fusión.`,
        preview: `${flatVIIRoot} ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatVIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatVIIRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭VII ➔ I7',
          origin: 'Modo Lidio Dominante (Característico)',
          mode: 'Lidio Dominante',
          target: `${c2.root}${c2.type}`,
          tension: 'Media-Alta',
          styles: ['Jazz', 'Fusion', 'Gospel'],
          explanation: `El movimiento ♭VII ➔ I7 une la apertura de la escala lidia con la funcionalidad del dominante.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isMixolydianFlat6Scale && normDegree(deg1) === 'I' && normDegree(deg2) !== 'IV') {
      const ivRoot = getScaleNotes(c1.activeKey, c1.activeScale)[3] || transposeNote(c1.activeKey, 5, c1.activeKey)
      candidates.push({
        id: `rule_6_mixolydian_flat6_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Movimiento Mixolidio ♭6 (I7 ➔ IVm)',
        text: `Se detecta la tónica I7 (${c1.root}${c1.type || ''}). Te sugerimos resolver hacia el cuarto grado menor IVm (${ivRoot}m) para generar un color de dominante con resolución menor oscura y sofisticada.`,
        preview: `${c1.root}${c1.type || ''} ➔ ${ivRoot}m`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: ivRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivRoot}m`,
          categoryLabel: 'Movimiento Armónico',
          function: 'I7 ➔ IVm',
          origin: 'Modo Mixolidio ♭6 (Característico)',
          mode: 'Mixolidio ♭6',
          target: `${ivRoot}m`,
          tension: 'Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Gospel'],
          explanation: `La coexistencia de la tercera mayor de la tónica con la sexta menor de la escala crea un color sumamente rico.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isLocrianSharp2Scale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_locrian_sharp2_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Resolución Locria ♮2 (iiø ➔ V7 ➔ i)',
        text: `Se detecta la tónica menor i (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer el acorde de dominante V7 (${vRoot}7). La segunda mayor de Locrio ♮2 suaviza la inestabilidad locria tradicional y permite conectar de forma mucho más fluida.`,
        preview: `${vRoot}7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V7 ➔ i',
          origin: 'Modo Locrio ♮2 (Característico)',
          mode: 'Locrio ♮2',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Jazz Moderno', 'Bebop', 'Fusion'],
          explanation: `La escala Locria ♮2 es ideal para improvisar y conectar acordes m7b5 en progresiones ii-V-i.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isAlteredScale && (normDegree(deg2) === 'I' || normDegree(deg2) === 'i') && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0]
      const isTargetMinor = c2.type.includes('min') || c2.type.includes('m')
      const targetLabel = isTargetMinor ? 'i' : 'I'
      candidates.push({
        id: `rule_6_altered_${systemIndex}`,
        category: 'movement',
        title: `Insertar Dominante Alterado Principal (V7alt ➔ ${targetLabel})`,
        text: `Se detecta la tónica de destino (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer un dominante alterado completo V7alt (${vRoot}7alt) para maximizar la tensión antes de resolver.`,
        preview: `${vRoot}7alt ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7alt`,
          categoryLabel: 'Movimiento Armónico',
          function: `V7alt ➔ ${targetLabel}`,
          origin: 'Modo Alterado (Característico)',
          mode: 'Alterado',
          target: `${c2.root}${c2.type}`,
          tension: 'Máxima',
          styles: ['Jazz Moderno', 'Fusion', 'Gospel'],
          explanation: `Contiene todas las tensiones alteradas (b9, #9, b5, #5) que resuelven cromáticamente hacia la tónica.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isDiminishedWHScale && normDegree(deg2) === 'ii' && normDegree(deg1) !== 'i') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const sharpOneRoot = transposeNote(oneRoot, 1, c1.activeKey)
      candidates.push({
        id: `rule_6_diminished_wh_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Paso Disminuido Gospel (I ➔ #Idim7 ➔ ii)',
        text: `Se detecta la resolución hacia el segundo grado ${c2.root}${c2.type || ''} (ii). Te sugerimos anteponer el acorde de paso disminuido #Idim7 (${sharpOneRoot}dim7) para generar un enlace cromático ascendente extremadamente suave de gran emotividad y carácter gospel.`,
        preview: `${oneRoot} ➔ ${sharpOneRoot}dim7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: sharpOneRoot, type: 'dim7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sharpOneRoot}dim7`,
          categoryLabel: 'Movimiento Armónico',
          function: 'I ➔ #Idim7 ➔ ii',
          origin: 'Escala Disminuida T-S (Característico)',
          mode: 'Disminuida T-S',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Gospel', 'Jazz', 'Bebop', 'Swing'],
          explanation: `El acorde #Idim7 resuelve por semitono ascendente en sus voces hacia el ii grado, creando una conducción armónica fluida.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isDiminishedHWScale && (normDegree(deg2) === 'I' || normDegree(deg2) === 'i') && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[5] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_diminished_hw_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Dominante Simétrico (V7(♭9) ➔ I)',
        text: `Se detecta la tónica ${c2.root}${c2.type || ''} (I) en el compás siguiente. Te sugerimos anteponer el dominante disminuido simétrico V7(♭9) (${vRoot}7(♭9)) para generar una fuerte tensión resuelta con colores de novena bemol y oncena aumentada.`,
        preview: `${vRoot}7(b9) ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7', tensions: ['b9'], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7(♭9)`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V7(♭9) ➔ I',
          origin: 'Escala Disminuida S-T (Característico)',
          mode: 'Disminuida S-T',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Jazz', 'Bebop', 'Swing', 'Gospel'],
          explanation: `La escala disminuida S-T permite enriquecer el dominante con b9, #9, #11 y 13 antes de la resolución.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isWholeToneScale && (normDegree(deg2) === 'I' || normDegree(deg2) === 'i') && normDegree(deg1) !== 'V') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_whole_tone_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Dominante Aumentado (V7♯5 ➔ I)',
        text: `Se detecta la tónica ${c2.root}${c2.type || ''} (I) en el compás siguiente. Te sugerimos anteponer el dominante aumentado V7♯5 (${vRoot}7♯5) para generar una sonoridad flotante e inestable propia de la simetría de tonos enteros.`,
        preview: `${vRoot}7#5 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: vRoot, type: '7#5', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7♯5`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V7♯5 ➔ I',
          origin: 'Escala de Tonos Enteros (Característico)',
          mode: 'Tonos Enteros',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Jazz', 'Fusion', 'Impresionismo', 'Cine'],
          explanation: `La quinta aumentada genera tensión simétrica suspendida que resuelve cromáticamente.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isPentatonicMajorScale && normDegree(deg2) === 'IV') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const fiveRoot = getScaleNotes(c1.activeKey, c1.activeScale)[3] || transposeNote(c1.activeKey, 7, c1.activeKey)
      const sixRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 9, c1.activeKey)
      candidates.push({
        id: `rule_6_pentatonic_major_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Progresión Pop Insignia (I ➔ V ➔ vi ➔ IV)',
        text: `Se detecta el acorde del cuarto grado ${c2.root}${c2.type || ''} (IV) en el compás siguiente. Te sugerimos estructurar la clásica progresión pop/folk de cuatro acordes: ${oneRoot} ➔ ${fiveRoot} ➔ ${sixRoot}m ➔ ${c2.root} (I ➔ V ➔ vi ➔ IV) para crear una melodía universal extremadamente consonante y fácil de recordar.`,
        preview: `${oneRoot} ➔ ${fiveRoot} ➔ ${sixRoot}m ➔ ${c2.root}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: sixRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sixRoot}m`,
          categoryLabel: 'Movimiento Armónico',
          function: 'I ➔ V ➔ vi ➔ IV',
          origin: 'Escala Pentatónica Mayor',
          mode: 'Pentatónica Mayor',
          target: `${c2.root}${c2.type}`,
          tension: 'Muy Baja',
          styles: ['Pop', 'Folk', 'Country', 'Gospel'],
          explanation: `Esta progresión evita los semitonos disonantes de la escala mayor, resultando en una sonoridad sumamente estable y fluida.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isPentatonicMinorScale && normDegree(deg2) === 'VII') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const flatSevenRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 10, c1.activeKey)
      const flatSixRoot = transposeNote(c1.activeKey, 8, c1.activeKey)
      candidates.push({
        id: `rule_6_pentatonic_minor_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia de Rock Insignia (i ➔ ♭VII ➔ ♭VI ➔ ♭VII)',
        text: `Se detecta el acorde del séptimo grado bemol ${c2.root}${c2.type || ''} (♭VII) en el compás siguiente. Te sugerimos estructurar la clásica progresión de rock descendente: ${oneRoot}m ➔ ${flatSevenRoot} ➔ ${flatSixRoot} ➔ ${c2.root} (i ➔ ♭VII ➔ ♭VI ➔ ♭VII) para generar fuerza y emotividad directa.`,
        preview: `${oneRoot}m ➔ ${flatSevenRoot} ➔ ${flatSixRoot} ➔ ${c2.root}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatSixRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatSixRoot}`,
          categoryLabel: 'Movimiento Armónico',
          function: 'i ➔ ♭VII ➔ ♭VI ➔ ♭VII',
          origin: 'Escala Pentatónica Menor',
          mode: 'Pentatónica Menor',
          target: `${c2.root}${c2.type}`,
          tension: 'Baja',
          styles: ['Rock', 'Hard Rock', 'Metal', 'Folk'],
          explanation: `Elimina la segunda y sexta menor de la escala natural para un empuje directo en la tónica.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isBluesScale) {
      const fourRoot = getScaleNotes(c1.activeKey, c1.activeScale)[2] || transposeNote(c1.activeKey, 5, c1.activeKey)
      const flatFiveRoot = getScaleNotes(c1.activeKey, c1.activeScale)[3] || transposeNote(c1.activeKey, 6, c1.activeKey)
      const fiveRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      if (normDegree(deg2) === 'v') {
        candidates.push({
          id: `rule_6_blues_flat5_${systemIndex}`,
          category: 'movement',
          title: 'Insertar Paso Cromático Blue Note (4 ➔ ♭5 ➔ 5)',
          text: `Se detecta la resolución hacia el quinto grado. Te sugerimos anteponer el paso cromático insignia de la escala de Blues: 4 ➔ ♭5 ➔ 5 (ej: ${fourRoot} ➔ ${flatFiveRoot} ➔ ${fiveRoot}) para inyectar la tensión y expresividad única de la Blue Note.`,
          preview: `${fourRoot} ➔ ${flatFiveRoot} ➔ ${c2.root}${c2.type || ''}`,
          payload: [
            { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: flatFiveRoot, type: 'dim', tensions: [], bass: null } }
          ],
          metadata: {
            name: `${flatFiveRoot}dim`,
            categoryLabel: 'Movimiento Armónico',
            function: '4 ➔ ♭5 ➔ 5',
            origin: 'Escala de Blues (Blue Note)',
            mode: 'Escala de Blues',
            target: `${c2.root}${c2.type}`,
            tension: 'Media',
            styles: ['Blues', 'Rock', 'Jazz', 'Gospel', 'Soul'],
            explanation: `La Blue Note (♭5) crea una tensión breve pero muy expresiva que resuelve por semitono hacia la quinta.`
          }
        })
        iiv1Matched = true
        break
      }
    }

    if (isBebopDominantScale && (normDegree(deg2) === 'I' || normDegree(deg2) === 'i') && normDegree(deg1) !== 'V') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const flatSevenRoot = getScaleNotes(c1.activeKey, c1.activeScale)[6] || transposeNote(c1.activeKey, 10, c1.activeKey)
      const sevenRoot = getScaleNotes(c1.activeKey, c1.activeScale)[7] || transposeNote(c1.activeKey, 11, c1.activeKey)
      candidates.push({
        id: `rule_6_bebop_dominant_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Resolución Cromática Bebop (♭7 ➔ 7 ➔ 1)',
        text: `Se detecta la tónica de destino ${c2.root}${c2.type || ''} (I) en el compás siguiente. Te sugerimos anteponer la resolución cromática de paso bebop: ♭VII ➔ VII ➔ I (ej: ${flatSevenRoot} ➔ ${sevenRoot}dim ➔ ${oneRoot}) para inyectar fluidez melódica swing.`,
        preview: `${flatSevenRoot} ➔ ${sevenRoot}dim ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: sevenRoot, type: 'dim', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sevenRoot}dim`,
          categoryLabel: 'Movimiento Armónico',
          function: '♭7 ➔ 7 ➔ 1',
          origin: 'Escala Bebop Dominante (Sensible de Paso)',
          mode: 'Bebop Dominante',
          target: `${c2.root}${c2.type}`,
          tension: 'Bajo-Media',
          styles: ['Bebop', 'Swing', 'Jazz Tradicional', 'Big Band'],
          explanation: `La coexistencia de la séptima menor con la séptima mayor de paso (7) es el corazón de la escala bebop dominante.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isHungarianMajorScale && normDegree(deg2) === 'I' && normDegree(deg1) !== 'V') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const sharpTwoRoot = getScaleNotes(c1.activeKey, c1.activeScale)[1] || transposeNote(c1.activeKey, 3, c1.activeKey)
      candidates.push({
        id: `rule_6_hungarian_major_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Húngara Mayor (♯II° ➔ I)',
        text: `Se detecta la tónica de destino I (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos anteponer la resolución exótica característica: ♯II° ➔ I (ej: ${sharpTwoRoot}dim7 ➔ ${oneRoot}) para dar ese distintivo color cinematográfico y épico de la segunda aumentada.`,
        preview: `${sharpTwoRoot}dim7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: sharpTwoRoot, type: 'dim7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sharpTwoRoot}dim7`,
          categoryLabel: 'Movimiento Armónico',
          function: '♯II° ➔ I',
          origin: 'Escala Mayor Húngara',
          mode: 'Mayor Húngara',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Cine', 'Gitana', 'Fantasía'],
          explanation: `El movimiento de segunda aumentada descendente hacia la tónica es la firma de la escala Mayor Húngara.`
        }
      })
      iiv1Matched = true
      break
    }

    if (isHungarianMinorScale && normDegree(deg2) === 'i' && normDegree(deg1) !== 'V') {
      const oneRoot = getScaleNotes(c1.activeKey, c1.activeScale)[0] || c1.activeKey
      const sharpFourRoot = getScaleNotes(c1.activeKey, c1.activeScale)[3] || transposeNote(c1.activeKey, 6, c1.activeKey)
      const fiveRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      candidates.push({
        id: `rule_6_hungarian_minor_${systemIndex}`,
        category: 'movement',
        title: 'Insertar Cadencia Húngara Menor (♯iv° ➔ V7 ➔ i)',
        text: `Se detecta la tónica menor i (${c2.root}${c2.type || ''}) en el compás siguiente. Te sugerimos estructurar la progresión de tensión exótica característica: ♯iv° ➔ V7 ➔ i (ej: ${sharpFourRoot}dim7 ➔ ${fiveRoot}7 ➔ ${oneRoot}m) para generar un ambiente dramático y neoclásico potente.`,
        preview: `${sharpFourRoot}dim7 ➔ ${fiveRoot}7 ➔ ${c2.root}${c2.type || ''}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: sharpFourRoot, type: 'dim7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${sharpFourRoot}dim7`,
          categoryLabel: 'Movimiento Armónico',
          function: '♯iv° ➔ V7 ➔ i',
          origin: 'Escala Menor Húngara',
          mode: 'Menor Húngara',
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Metal Neoclásico', 'Gitana', 'Cine'],
          explanation: `La cuarta aumentada (♯4) aporta una tensión exótica que se resuelve moviéndose hacia la dominante V7, el cual resuelve firmemente sobre la tónica menor.`
        }
      })
      iiv1Matched = true
      break
    }

    const matchDiatonicCadence = isDorianScale
      ? (deg1.includes('ii') && deg2 === 'i')
      : (isMinorScale 
        ? (deg1.includes('ii') && deg2 === 'i') 
        : (deg1 === 'ii' && deg2 === 'I'))

    if (matchDiatonicCadence) {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      const vRootThird = transposeNote(vRoot, 4, c1.activeKey)
      const vRootSeventh = transposeNote(vRoot, 10, c1.activeKey)
      const c2Third = getThirdOfRoot(c2.root, c2.type, c1.activeKey)

      const cadInfo = getCadence(isDorianScale ? 'cad_dorian_jazz' : (isMinorScale ? 'cad_ii_v_i_minor' : 'cad_extended'), scaleType)

      candidates.push({
        id: `rule_6_${systemIndex}`,
        category: 'movement',
        title: isDorianScale ? 'Completar Cadencia ii–V–i (Jazz Dórico)' : (isMinorScale ? 'Completar cadencia ii°–V–i' : 'Completar cadencia ii–V–I'),
        text: isDorianScale
          ? `Se detecta el paso de ii (${c1.root}m) a i (${c2.root}m) en Dórico. Podrías explorar insertar el dominante funcional ${vRoot}7 (prestado de la menor armónica) en el segundo tiempo de ${c1.root}m. Esto completa la cadencia de Jazz Dórico ii-V-i.`
          : (isMinorScale 
            ? `Se detecta el paso de ii° (${c1.root}m7b5) a i (${c2.root}m). Podrías explorar insertar el dominante ${vRoot}7 (prestado de la menor armónica) en el segundo tiempo. Esto completa la clásica cadencia ii°-V-i con tensión tritoonal.`
            : `Se detecta el paso directo de ii (${c1.root}m) a I (${c2.root}). Podrías explorar insertar el dominante ${vRoot}7 en el segundo tiempo de ${c1.root}m. Esto completa la clásica cadencia ii-V-I.`),
        preview: isDorianScale ? `${c1.root}m ➔ ${vRoot}7 ➔ ${c2.root}m` : (isMinorScale ? `${c1.root}m7b5 ➔ ${vRoot}7 ➔ ${c2.root}m` : `${c1.root}m ➔ ${vRoot}7 ➔ ${c2.root}`),
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: 2, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7`,
          categoryLabel: 'Movimiento Armónico',
          function: 'V7',
          origin: isDorianScale ? 'Menor Armónica (Prestada)' : (isMinorScale ? 'Menor Armónica (Prestada)' : originScaleLabel),
          mode: isDorianScale ? 'Dórico' : (isMinorScale ? 'Menor Natural' : 'Escala Mayor'),
          target: `${c2.root}${c2.type}`,
          tension: 'Alta',
          styles: ['Pop', 'Jazz', 'Gospel', 'Rock'],
          explanation: isDorianScale
            ? `Completa la cadencia de Jazz Dórico ii-V-i insertando el dominante funcional E7. La tercera mayor (${vRootThird}) actúa como sensible cromática para resolver al i menor.`
            : (isMinorScale 
              ? `Completa la clásica cadencia menor ii°-V-i incorporando el dominante funcional E7. La tercera mayor (${vRootThird}) actúa como sensible y resuelve por semitono hacia la fundamental del destino.` 
              : `Completa la clásica cadencia ii-V-I insertando el dominante. La tercera (${vRootThird}) y séptima (${vRootSeventh}) de ${vRoot}7 forman un tritono que resuelve hacia el destino.`)
        }
      })
      iiv1Matched = true
      break
    }
  }

  // Regla 7: Dominante secundario
  let secDomMatched = false
  if (!iiv1Matched) {
    const targetChordIdx = activeChords.findIndex((c, idx) => {
      if (idx === 0) return false
      const degNormalized = normDegree(c.degree)
      if (degNormalized === 'I' || degNormalized === 'i') return false
      const sn = getScaleNotes(c.activeKey, c.activeScale)
      const isDiatonic = sn.includes(c.root)
      const isDiminished = ['dim', 'dim7', 'm7b5', '°'].some(term => c.type.includes(term) || c.degree.includes(term))
      return isDiatonic && !isDiminished
    })

    if (targetChordIdx !== -1) {
      const targetChord = activeChords[targetChordIdx]
      const prevChord = activeChords[targetChordIdx - 1]
      const secDomRoot = transposeNote(targetChord.root, 7, targetChord.activeKey)
      const secDomThird = transposeNote(secDomRoot, 4, targetChord.activeKey)
      
      const isTargetMinor = ['min', 'm7', 'm7b5', 'min7', 'minor'].includes(targetChord.type)
      let voiceLeadingExplanation = ''
      if (isTargetMinor) {
        voiceLeadingExplanation = `La nota tercera mayor de ${secDomRoot}7 (${secDomThird}) actúa como sensible cromática, resolviendo por semitono ascendente directo hacia la fundamental de ${targetChord.root}.`
      } else {
        const secDomSeventh = transposeNote(secDomRoot, 10, targetChord.activeKey)
        const targetThird = getThirdOfRoot(targetChord.root, targetChord.type, targetChord.activeKey)
        voiceLeadingExplanation = `La tercera de ${secDomRoot}7 (${secDomThird}) actúa como sensible que resuelve hacia la fundamental de ${targetChord.root}, mientras que su séptima menor (${secDomSeventh}) resuelve por semitono descendente hacia la tercera de ${targetChord.root} (${targetThird}), creando una excelente conducción armónica.`
      }

      const secDomInfo = getSecondaryDominant(targetChord.degree, scaleType)

      candidates.push({
        id: `rule_7_${systemIndex}`,
        category: 'movement',
        title: `Insertar Dominante Secundario (${secDomRoot}7 ➔ ${targetChord.root}${targetChord.type})`,
        text: `Para intensificar y dar una dirección armónica lógica y directa hacia el acorde de ${targetChord.root}${targetChord.type} (${targetChord.degree}), una opción clásica es anteponer su dominante secundario, ${secDomRoot}7 (V/${targetChord.degree}), en la segunda mitad del compás de ${prevChord.root}. ${voiceLeadingExplanation} Esto embellece la transición en pos de la continuidad armónica.`,
        preview: `${prevChord.root} ➔ ${secDomRoot}7 ➔ ${targetChord.root}`,
        payload: [
          { measureIndex: prevChord.globalMeasureIndex, beatIndex: 2, chord: { root: secDomRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${secDomRoot}7`,
          categoryLabel: 'Dominante Secundario',
          function: secDomInfo ? secDomInfo.function : `V/${targetChord.degree}`,
          origin: isMinorScale ? 'Menor Armónica (Prestada)' : originScaleLabel,
          target: `${targetChord.root}${targetChord.type}`,
          tension: 'Media-Alta',
          styles: secDomInfo ? secDomInfo.styles.map(s => s.toUpperCase()) : ['POP', 'JAZZ', 'GOSPEL'],
          explanation: `${secDomInfo ? secDomInfo.explanation : ''} ${voiceLeadingExplanation}`
        }
      })
      secDomMatched = true
    }
  }

  // Regla 8: Salto armónico fuerte (Passing chord)
  if (!secDomMatched) {
    for (let i = 0; i < 3; i++) {
      const c1 = activeChords[i]
      const c2 = activeChords[i+1]
      const idx1 = NOTE_TO_INDEX[c1.root]
      const idx2 = NOTE_TO_INDEX[c2.root]
      if (idx1 !== undefined && idx2 !== undefined) {
        const diff = (idx2 - idx1 + 12) % 12
        if (diff === 2) { // Paso de tono (ej: C a D)
          const passRoot = transposeNote(c1.root, 1, c1.activeKey)
          const passThird = transposeNote(passRoot, 3, c1.activeKey)
          const passFifth = transposeNote(passRoot, 6, c1.activeKey)

          const passInfo = getReharmonization('reharm_passing_chrom', scaleType)

          candidates.push({
            id: `rule_8_${systemIndex}`,
            category: 'movement',
            title: 'Insertar acorde de paso cromático',
            text: `Existe un salto de tono entero entre ${c1.root} y ${c2.root}. Podrías explorar insertar un acorde de paso disminuido ${passRoot}dim en medio. Esto crea una línea de bajo cromática ascendente (${c1.root} ➔ ${passRoot} ➔ ${c2.root}) de gran fluidez, donde las notas del acorde de paso (${passRoot}, ${passThird}, ${passFifth}) se enlazan por semitonos o notas comunes hacia el acorde de destino ${c2.root}.`,
            preview: `${c1.root} ➔ ${passRoot}dim ➔ ${c2.root}`,
            payload: [
              { measureIndex: c1.globalMeasureIndex, beatIndex: 2, chord: { root: passRoot, type: 'dim', tensions: [], bass: null } }
            ],
            metadata: {
              name: `${passRoot}dim`,
              categoryLabel: 'Movimiento Armónico',
              function: 'Acorde de paso',
              origin: passInfo ? passInfo.name : 'Chromatic Approach',
              target: `${c2.root}${c2.type}`,
              tension: 'Media-Alta',
              styles: ['Pop', 'Jazz', 'Gospel'],
              explanation: `Suaviza el salto de tono entero mediante un bajo cromático ascendente. Las notas del acorde de paso (${passRoot}, ${passThird}, ${passFifth}) resuelven suavemente por semitono o nota común.`
            }
          })
          break
        }
      }
    }
  }

  // Regla 9: Progresión estática -> Acorde intermedio
  const staticChord = activeChords.find((c, idx) => {
    if (idx < 3) {
      const next = activeChords[idx+1]
      return c.root === next.root && c.globalMeasureIndex === next.globalMeasureIndex - 1
    }
    return false
  })
  if (staticChord) {
    const sn = getScaleNotes(staticChord.activeKey, staticChord.activeScale)
    const interRoot = sn[(sn.indexOf(staticChord.root) + 3) % 7] || sn[3]
    candidates.push({
      id: `rule_9_${systemIndex}`,
      category: 'movement',
      title: 'Dinamizar sección estática',
      text: `El acorde de ${staticChord.root} se mantiene por más de un compás. Una idea para mantener el dinamismo es intercalar el acorde diatónico ${interRoot} en medio. Esto introduce una fluctuación armónica transitoria que rompe la monotonía antes de retornar al acorde principal, respetando la coherencia tonal.`,
      preview: `${staticChord.root} ➔ ${interRoot} ➔ ${staticChord.root}`,
      payload: [
        { measureIndex: staticChord.globalMeasureIndex + 1, beatIndex: 0, chord: { root: interRoot, type: 'maj', tensions: [], bass: null } }
      ],
      metadata: {
        name: interRoot,
        categoryLabel: 'Movimiento Armónico',
        function: 'Fluctuación Armónica',
        origin: 'Capa de Conocimiento Armónico (Diatónica)',
        target: `${staticChord.root}`,
        tension: 'Baja',
        styles: ['Pop', 'Rock', 'Jazz'],
        explanation: `Intercala el acorde diatónico ${interRoot} en medio de una sección armónica estática para mantener el dinamismo sin alterar la tonalidad.`
      }
    })
  }

  // Regla 10: V a V7 o V alterado resolviendo a I
  const domChordIdx = activeChords.findIndex((c, idx) => idx < 3 && (normDegree(c.degree) === 'V' || normDegree(c.degree) === 'v') && (normDegree(activeChords[idx+1].degree) === 'I' || normDegree(activeChords[idx+1].degree) === 'i'))
  if (domChordIdx !== -1) {
    const domChord = activeChords[domChordIdx]
    const nextChord = activeChords[domChordIdx + 1]
    const b9Note = transposeNote(domChord.root, 13, domChord.activeKey)
    const fifthOfNext = transposeNote(nextChord.root, 7, domChord.activeKey)

    candidates.push({
      id: `rule_10_${systemIndex}`,
      category: 'movement',
      title: `Enriquecer dominante con resolución a ${nextChord.root}`,
      text: `Para intensificar la resolución de ${domChord.root} hacia la tónica ${nextChord.root}, puedes convertirlo en ${domChord.root}7 y sumarle la novena menor (b9). La novena menor (${b9Note}) de ${domChord.root}7 actúa como sensible superior, conduciendo por semitono descendente directo hacia la quinta de ${nextChord.root} (${fifthOfNext}), lo que genera una gran tensión y una resolución sumamente satisfactoria.`,
      preview: `${domChord.root} ➔ ${domChord.root}7(b9) ➔ ${nextChord.root}`,
      payload: [
        { measureIndex: domChord.globalMeasureIndex, beatIndex: domChord.beatIndex, chord: { root: domChord.root, type: '7', tensions: ['b9'], bass: domChord.bass } }
      ],
      metadata: {
        name: `${domChord.root}7(b9)`,
        categoryLabel: 'Movimiento Armónico',
        function: 'V7(b9)',
        origin: isMinorScale ? 'Menor Armónica' : 'Escala Menor Armónica (Prestada)',
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Alta',
        styles: ['Jazz', 'Gospel'],
        explanation: `Genera una resolución muy fuerte sobre la tónica. La novena menor (${b9Note}) actúa como sensible superior y resuelve por semitono descendente hacia la quinta (${fifthOfNext}) del destino.`
      }
    })
  }


  // ==================== 🔵 COLOR / MODAL (color) ====================

  // Regla 11: Mayor (I o IV) a #11 (Lidio)
  const lydianChordIdx = activeChords.findIndex(c => ['I', 'IV'].includes(normDegree(c.degree)) && ['maj', 'maj7', 'major', ''].includes(c.type || ''))
  if (lydianChordIdx !== -1) {
    const lydianChord = activeChords[lydianChordIdx]
    const sharp11Note = transposeNote(lydianChord.root, 6, lydianChord.activeKey)
    const nextChord = activeChords[(lydianChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(sharp11Note, nextChord, lydianChord.activeKey)

    const isTriad = ['maj', 'major', ''].includes(lydianChord.type || '')
    const currentName = isTriad ? lydianChord.root : `${lydianChord.root}maj7`
    const nextName = isTriad ? `${lydianChord.root}(#11)` : `${lydianChord.root}maj7(#11)`

    candidates.push({
      id: `rule_11_${systemIndex}`,
      category: 'color',
      title: 'Añadir color Lidio (#11)',
      text: `Podrías probar añadiendo la tensión #11 al acorde mayor de ${lydianChord.root} (${lydianChord.degree}). Esta nota característica del modo Lidio introduce una sonoridad brillante y de ensueño. Al conectar con el siguiente acorde (${nextChord.root}), la tensión #11 (${sharp11Note}) se conduce de la siguiente manera: ${voiceLeadingText}.`,
      preview: `${currentName} ➔ ${nextName}`,
      payload: [
        { measureIndex: lydianChord.globalMeasureIndex, beatIndex: lydianChord.beatIndex, chord: { root: lydianChord.root, type: lydianChord.type, tensions: [...lydianChord.tensions, '#11'], bass: lydianChord.bass } }
      ],
      metadata: {
        name: nextName,
        categoryLabel: 'Color / Estilo',
        function: `${lydianChord.degree}(#11)`,
        origin: 'Modo Lidio',
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Media',
        styles: ['Jazz', 'Fusion', 'Cine'],
        explanation: `Aporta una atmósfera etérea e ingeniosa propia del modo Lidio. La tensión #11 (${sharp11Note}) se conduce así: ${voiceLeadingText}.`
      }
    })
  }

  // Regla 12: Menor (ii o vi) a 13 (Dórico)
  const dorianChordIdx = activeChords.findIndex(c => ['ii', 'vi'].includes(normDegree(c.degree)) && ['min', 'minor', 'm', 'm7'].includes(c.type || ''))
  if (dorianChordIdx !== -1) {
    const dorianChord = activeChords[dorianChordIdx]
    const thirteenNote = transposeNote(dorianChord.root, 9, dorianChord.activeKey)
    const nextChord = activeChords[(dorianChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(thirteenNote, nextChord, dorianChord.activeKey)

    const isTriad = ['min', 'minor', 'm'].includes(dorianChord.type || '')
    const currentName = isTriad ? `${dorianChord.root}m` : `${dorianChord.root}m7`
    const nextName = isTriad ? `${dorianChord.root}m(13)` : `${dorianChord.root}m7(13)`

    candidates.push({
      id: `rule_12_${systemIndex}`,
      category: 'color',
      title: 'Añadir color Dórico (13)',
      text: `Para darle un carácter de jazz clásico y un tinte más fresco al acorde menor de ${dorianChord.root}m, una opción excelente es agregar la tensión 13. Al resolver al siguiente acorde (${nextChord.root}), la nota 13 (${thirteenNote}) se conecta así: ${voiceLeadingText}.`,
      preview: `${currentName} ➔ ${nextName}`,
      payload: [
        { measureIndex: dorianChord.globalMeasureIndex, beatIndex: dorianChord.beatIndex, chord: { root: dorianChord.root, type: dorianChord.type, tensions: [...dorianChord.tensions, '13'], bass: dorianChord.bass } }
      ],
      metadata: {
        name: nextName,
        categoryLabel: 'Color / Estilo',
        function: `${dorianChord.degree}m7(13)`,
        origin: 'Modo Dórico',
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Media',
        styles: ['Jazz', 'Fusion', 'Funk'],
        explanation: `Introduce la brillantez del modo Dórico sobre un acorde menor. La novena mayor o treceava (${thirteenNote}) se conecta así: ${voiceLeadingText}.`
      }
    })
  }

  // Regla 13: IV menor resolviendo a la tónica I (Intercambio modal en Mayor) / IV Mayor en Menor
  const ivChordIdx = activeChords.findIndex((c, idx) => {
    if (idx >= 3) return false
    const next = activeChords[idx+1]
    
    let isSourceIV = false
    const norm = normDegree(c.degree)
    if (isMinorScale || isHarmonicMinorScale || isMelodicMinorScale) {
      isSourceIV = norm === 'iv'
    } else if (isPhrygianScale || isDorianFlat2Scale) {
      isSourceIV = (norm === 'iv' || norm === 'v')
    } else if (isLydianScale) {
      isSourceIV = norm === 'iv'
    } else if (isMixolydianScale || isLydianDominantScale) {
      isSourceIV = norm === 'vii'
    } else if (isLocrianScale || isLocrianSharp6Scale || isLocrianSharp2Scale) {
      isSourceIV = (norm === 'iv' || norm === 'vii')
    } else if (isDorianScale || isDorianSharp4Scale) {
      isSourceIV = (norm === 'IV' || norm === 'iv')
    } else if (isPhrygianDominantScale || isMixolydianFlat6Scale) {
      isSourceIV = norm === 'II'
    } else if (isUltralocrianScale || isAlteredScale) {
      isSourceIV = norm === 'VI'
    } else if (isDiminishedWHScale) {
      isSourceIV = norm === 'i'
    } else if (isDiminishedHWScale || isWholeToneScale) {
      isSourceIV = norm === 'I'
    } else if (isPentatonicMajorScale || isBebopDominantScale) {
      isSourceIV = norm === 'I'
    } else if (isPentatonicMinorScale || isBluesScale) {
      isSourceIV = norm === 'i'
    } else if (isLydianSharp2Scale || isLydianAugmentedScale) {
      isSourceIV = norm === 'I'
    } else if (isHungarianMajorScale) {
      isSourceIV = (norm === 'IV' || norm === '♭VII')
    } else if (isHungarianMinorScale) {
      isSourceIV = (norm === 'iv' || norm === 'ii' || norm === '♯iv')
    } else {
      isSourceIV = norm === 'IV'
    }

    let isTargetTonic = false
    const normNext = normDegree(next.degree)
    if (isLydianSharp2Scale || isLydianAugmentedScale) {
      isTargetTonic = (normNext === 'V' || normNext === 'I')
    } else if (isUltralocrianScale || isAlteredScale) {
      isTargetTonic = (normNext === 'ii' || normNext === 'I' || normNext === 'i')
    } else if (isDiminishedWHScale) {
      isTargetTonic = (normNext === 'ii' || normNext === 'i')
    } else if (isDiminishedHWScale || isWholeToneScale) {
      isTargetTonic = (normNext === 'I' || normNext === 'i')
    } else if (isPentatonicMajorScale || isBebopDominantScale) {
      isTargetTonic = (normNext === 'I' || normNext === 'i')
    } else if (isPentatonicMinorScale || isBluesScale) {
      isTargetTonic = (normNext === 'i' || normNext === 'I')
    } else if (isHungarianMajorScale) {
      isTargetTonic = (normNext === 'I')
    } else if (isHungarianMinorScale) {
      isTargetTonic = (normNext === 'i')
    } else if (
      isMinorScale ||
      isDorianScale ||
      isPhrygianScale ||
      isLocrianScale ||
      isHarmonicMinorScale ||
      isLocrianSharp6Scale ||
      isDorianSharp4Scale ||
      isMelodicMinorScale ||
      isDorianFlat2Scale ||
      isLocrianSharp2Scale
    ) {
      isTargetTonic = normNext === 'i'
    } else {
      isTargetTonic = normNext === 'I'
    }

    return isSourceIV && isTargetTonic
  })

  if (ivChordIdx !== -1) {
    const ivChord = activeChords[ivChordIdx]
    const nextChord = activeChords[ivChordIdx + 1]

    if (isIonianSharp5Scale) {
      // Suggest Imaj7 (Cmaj7) from Major Parallel to resolve/stabilize the #5 augmented tension
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Estabilizar Quinta Aumentada (I+ ➔ I)`,
        text: `Se detecta la resolución hacia la tónica aumentada I+ (${nextChord.root}maj7#5). Para relajar la inestabilidad de la quinta aumentada o generar variación, te sugerimos tomar prestado el acorde de tónica mayor diatónico (${nextChord.root}maj7) de la escala mayor paralela (Jónica), resolviendo la tensión de la quinta aumentada en una quinta justa tradicional.`,
        preview: `${nextChord.root}maj7#5 ➔ ${nextChord.root}maj7`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: nextChord.root, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${nextChord.root}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I (Escala Mayor)',
          origin: 'Escala Mayor Paralela (Préstamo)',
          mode: 'Jónico ♯5',
          target: `${nextChord.root}maj7`,
          tension: 'Baja',
          styles: ['Jazz', 'Pop', 'Cine'],
          explanation: `Sustituye la tónica aumentada I+ por la tónica mayor I estable, suavizando la inestabilidad del intervalo de quinta aumentada (#5) mediante el intercambio modal.`
        }
      })
    } else if (isDorianSharp4Scale) {
      // Suggest IV (G major) from Dorian natural to compare 4 vs #4
      const naturalIVRoot = getScaleNotes(ivChord.activeKey, ivChord.activeScale)[3] || transposeNote(ivChord.activeKey, 5, ivChord.activeKey) // G in D scale
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Comparar Color Modal (IV natural vs #iv°)`,
        text: `Se detecta el acorde característico de cuarta aumentada #iv° (${ivChord.root}${ivChord.type || ''}) resolviendo a la tónica. Para suavizar la sonoridad o generar variación contrastante en la sección, te sugerimos tomar prestado el acorde de cuarto grado mayor natural IV (${naturalIVRoot} mayor) del Modo Dórico natural, permitiendo comparar el color de la cuarta justa frente a la cuarta aumentada.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${naturalIVRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: naturalIVRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${naturalIVRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'IV (Modo Dórico)',
          origin: 'Modo Dórico Natural (Préstamo)',
          mode: 'Dórico ♯4',
          target: `${nextChord.root}`,
          tension: 'Baja-Media',
          styles: ['Jazz', 'Fusion', 'Rock'],
          explanation: `Sustituye la tensión tritononal de la cuarta aumentada #iv° por la cuarta justa mayor IV de Dórico natural para suavizar el carácter melódico.`
        }
      })
    } else if (isPhrygianDominantScale) {
      // Suggest i (Em) from Phrygian natural to compare 3 vs b3
      const naturalIRoot = nextChord.root
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Comparar Color Modal (I mayor vs i menor)`,
        text: `Se detecta la resolución del acorde característico ♭II (${ivChord.root}${ivChord.type || ''}) hacia la tónica dominante I. Para comparar la sonoridad del color mayor frente al menor, te sugerimos tomar prestado el acorde de tónica menor i (${naturalIRoot} menor) del Modo Frigio natural, permitiendo experimentar la diferencia entre la tercera mayor y la tercera menor.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${naturalIRoot}m`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: naturalIRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${naturalIRoot}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'i (Modo Frigio)',
          origin: 'Modo Frigio Natural (Préstamo)',
          mode: 'Frigio Dominante',
          target: `${naturalIRoot}m`,
          tension: 'Baja-Media',
          styles: ['Jazz', 'Fusion', 'Flamenco'],
          explanation: `Sustituye la tónica mayor dominante I por la tónica menor i prestada del modo Frigio natural, permitiendo experimentar el contraste del color modal entre la tercera mayor y la tercera menor.`
        }
      })
    } else if (isLydianSharp2Scale) {
      // Suggest II (G major) from Lydian natural to compare 2 vs #2
      const naturalIIRoot = getScaleNotes(ivChord.activeKey, 'lydian')[1] || transposeNote(ivChord.activeKey, 2, ivChord.activeKey) // G in F scale
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Comparar Color Modal (II natural vs ♯ii°)`,
        text: `Se detecta la tónica I (${ivChord.root}${ivChord.type || ''}) en el compás actual. En el Modo Lidio ♯2, te sugerimos tomar prestado el acorde de segundo grado mayor II (${naturalIIRoot} mayor) del Modo Lidio natural, permitiendo comparar el color de la segunda justa frente a la segunda aumentada.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${naturalIIRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: naturalIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${naturalIIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'II (Modo Lidio)',
          origin: 'Modo Lidio Natural (Préstamo)',
          mode: 'Lidio ♯2',
          target: `${nextChord.root}`,
          tension: 'Baja-Media',
          styles: ['Jazz', 'Fusion', 'Rock'],
          explanation: `Sustituye la tónica I por el segundo grado mayor II prestado del modo Lidio natural, permitiendo experimentar el contraste del color modal entre la segunda mayor y la segunda aumentada.`
        }
      })
    } else if (isUltralocrianScale) {
      // Suggest Valt (E7alt) instead of V (E7) to enrich the dominant resolution to i
      const dominantRoot = ivChord.root // E
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Dominante Alterado Extremo (V7 ➔ V7alt)`,
        text: `Se detecta el acorde de dominante V (${ivChord.root}${ivChord.type || ''}) resolviendo a la tónica. En el Modo Superlocrio Disminuido, te sugerimos reharmonizarlo como un dominante alterado extremo Valt (${dominantRoot}7alt) para acumular tensiones (b9, #9, #11, b13) y generar una resolución extremadamente fuerte.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${dominantRoot}7alt`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: dominantRoot, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${dominantRoot}7alt`,
          categoryLabel: 'Color / Tensión',
          function: 'Valt (Superlocrio Disminuido)',
          origin: 'Modo Superlocrio Disminuido (Préstamo)',
          mode: 'Superlocrio Disminuido',
          target: `${nextChord.root}`,
          tension: 'Máxima',
          styles: ['Jazz Moderno', 'Fusion', 'Gospel Moderno'],
          explanation: `Sustituye el dominante diatónico por un dominante alterado extremo (Valt) aplicando el conjunto de tensiones del modo Superlocrio Disminuido para intensificar la resolución.`
        }
      })
    } else if (isHarmonicMinorScale) {
      // Suggest Picardy Third (I Mayor, e.g. A major)
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Tercera de Picardía (i ➔ I)`,
        text: `Se detecta la resolución hacia la tónica menor i (${nextChord.root}m). Para lograr un cierre brillante, majestuoso y glorioso clásico, te sugerimos emplear la Tercera de Picardía, transformando el acorde final en un acorde de tónica Mayor (${nextChord.root} mayor), prestado de la escala mayor paralela.`,
        preview: `${nextChord.root} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: nextChord.root, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${nextChord.root}`,
          categoryLabel: 'Intercambio Modal',
          function: 'I (Mayor Paralela)',
          origin: 'Mayor Paralela (Préstamo)',
          mode: 'Menor Armónica',
          target: `${nextChord.root}`,
          tension: 'Baja-Media',
          styles: ['Clásico', 'Gospel', 'Metal Progresivo'],
          explanation: `La Tercera de Picardía (Picardy Third) resuelve de forma inesperada una frase en tono menor sobre una tónica Mayor, aportando luz y resolución triunfal.`
        }
      })
    } else if (isLocrianSharp6Scale) {
      // Locrian ♮6: iv/♭vii ➔ iø to iv/♭vii ➔ i (stabilizing with parallel natural minor tónica)
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Estabilizar Centro Tonal (${nextChord.root}dim ➔ ${nextChord.root}m)`,
        text: `Se detecta la resolución hacia el primer grado semidisminuido inestable iø (${nextChord.root}dim). Para dar mayor estabilidad tonal a la sección, te sugerimos tomar prestado el acorde de tónica menor (${nextChord.root} menor) de la escala menor natural paralela, convirtiendo el reposo disminuido tenso en un punto de descanso estable.`,
        preview: `${nextChord.root}dim ➔ ${nextChord.root}m`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: nextChord.root, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${nextChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'i (Menor Natural)',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Locrio ♮6',
          target: `${nextChord.root}m`,
          tension: 'Baja',
          styles: ['JAZZ', 'POP', 'CINE'],
          explanation: `Sustituye la tónica semidisminuida inestable por la tónica menor estable de la menor natural para resolver la tensión estructural del modo Locrio ♮6.`
        }
      })
    } else if (isLocrianScale) {
      // Locrian: iv/♭vii ➔ i° to iv/♭vii ➔ i (stabilizing with parallel natural minor tónica)
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Estabilizar Centro Tonal (${nextChord.root}dim ➔ ${nextChord.root}m)`,
        text: `Se detecta la resolución hacia el primer grado disminuido inestable i° (${nextChord.root}dim). Para dar mayor estabilidad tonal a la sección, te sugerimos tomar prestado el acorde de tónica menor (${nextChord.root} menor) de la escala menor natural paralela, convirtiendo el reposo disminuido tenso en un punto de descanso estable.`,
        preview: `${nextChord.root}dim ➔ ${nextChord.root}m`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: nextChord.root, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${nextChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'i (Menor Natural)',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Locrio',
          target: `${nextChord.root}m`,
          tension: 'Baja',
          styles: ['JAZZ', 'POP', 'CINE'],
          explanation: `Sustituye la tónica disminuida inestable por la tónica menor estable de la menor natural para resolver la tensión estructural del modo Locrio.`
        }
      })
    } else if (isMixolydianScale) {
      // Mixolydian: vii° ➔ I to ♭VII ➔ I (restoring Mixolydian character)
      const flatVIIRoot = getScaleNotes(ivChord.activeKey, ivChord.activeScale)[6] || transposeNote(ivChord.activeKey, 10, ivChord.activeKey)
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Restaurar color Mixolidio (${ivChord.root}dim ➔ ${flatVIIRoot})`,
        text: `Se detecta el acorde disminuido vii° (${ivChord.root}dim) resolviendo a la tónica. Este acorde introduce la sensible tonal de la escala mayor, eliminando la sensación mixolidia. Te sugerimos sustituirlo por el grado característico ♭VII (${flatVIIRoot} mayor) para restaurar el color mixolidio y lograr una resolución más abierta y rockera.`,
        preview: `${ivChord.root}dim ➔ ${flatVIIRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: flatVIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatVIIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VII',
          origin: 'Modo Mixolidio (Diatónico)',
          mode: 'Mixolidio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['ROCK', 'BLUES', 'FUNK'],
          explanation: `Sustituir el vii° disminuido tonal por el ♭VII mayor restablece el intervalo ♭7 característico del modo Mixolidio, devolviendo la sonoridad modal abierta.`
        }
      })
    } else if (isLydianScale) {
      // Lydian: #iv° ➔ I to IV ➔ I (borrowing from Major parallel scale)
      const natIVRoot = transposeNote(ivChord.activeKey, 5, ivChord.activeKey) // Perfect 4th
      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Intercambio modal con Mayor Paralela (${ivChord.root}dim ➔ ${natIVRoot})`,
        text: `Sustituir el acorde característico disminuido #iv° (${ivChord.root}dim) por el subdominante IV mayor (${natIVRoot} mayor) prestado del modo mayor paralelo. Esto relaja temporalmente el brillo Lidio, pero crea un contraste clásico que libera la tensión modal y prepara un reposo más tradicional.`,
        preview: `${ivChord.root}dim ➔ ${natIVRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: natIVRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${natIVRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'IV',
          origin: 'Escala Mayor Paralela (Préstamo)',
          mode: 'Lidio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['POP', 'CINE', 'ROCK'],
          explanation: `El préstamo del IV grado mayor de la escala mayor paralela reemplaza la nota característica #4 por la cuarta justa natural, atenuando el carácter flotante del Lidio para retornar a una sonoridad familiar.`
        }
      })
    } else if (isPhrygianScale) {
      // Frigio: iv o v° ➔ i a V o V7 (borrowing from Phrygian Dominant or minor armónica)
      const vRoot = getScaleNotes(ivChord.activeKey, ivChord.activeScale)[4] || transposeNote(ivChord.activeKey, 7, ivChord.activeKey)
      const isSourceV = normDegree(ivChord.degree) === 'v'
      
      const titleText = isSourceV 
        ? `Préstamo modal Frigio Dominante (${ivChord.root}dim ➔ ${vRoot}7)`
        : `Préstamo modal Frigio Dominante (${ivChord.root}m ➔ ${vRoot}7)`
        
      const textDesc = isSourceV
        ? `Sustituir el acorde diatónico inestable v° (${ivChord.root}dim) por el dominante V7 (${vRoot}7) prestado de Frigio Dominante introduce la sensible cromática (tercera mayor del V), resolviendo con gran fuerza y tensión a la tónica.`
        : `Sustituir el acorde subdominante iv (${ivChord.root}m) por el dominante V7 (${vRoot}7) prestado de Frigio Dominante introduce la sensible cromática (tercera mayor del V), resolviendo con gran fuerza y tensión a la tónica.`

      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: titleText,
        text: textDesc,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${vRoot}7 ➔ ${nextChord.root}m`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}7`,
          categoryLabel: 'Intercambio Modal',
          function: 'V7',
          origin: 'Frigio Dominante (Préstamo)',
          mode: 'Frigio',
          target: `${nextChord.root}m`,
          tension: 'Alta',
          styles: ['FLAMENCO', 'METAL', 'CINE'],
          explanation: `El préstamo del grado V7 mayor introduce la sensible del centro tonal (${transposeNote(vRoot, 4, ivChord.activeKey)}), proporcionando una resolución sumamente direccional y de color característico.`
        }
      })
    } else if (isDorianScale) {
      // Dórico: IV ➔ i a iv ➔ i (Minor natural borrowing)
      const minorSixthNote = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)
      const miInfo = getModalInterchange('bVI_natural', scaleType)

      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Intercambio modal menor natural (${ivChord.root} ➔ ${ivChord.root}m)`,
        text: `Convertir el subdominante diatónico característico IV (${ivChord.root}) en menor (${ivChord.root}m) es un hermoso préstamo del modo menor natural paralelo. Introduce la sexta menor de paso (${minorSixthNote}) que rompe temporalmente el brillo dórico y añade una sutil melancolía que resuelve hacia la tónica ${nextChord.root}.`,
        preview: `${ivChord.root} ➔ ${ivChord.root}m ➔ ${nextChord.root}m`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'min', tensions: ivChord.tensions, bass: ivChord.bass } }
        ],
        metadata: {
          name: `${ivChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'iv',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Dórico',
          target: `${nextChord.root}m`,
          tension: 'Media',
          styles: ['POP', 'JAZZ', 'FUSION'],
          explanation: `El préstamo del cuarto grado menor introduce la nota ${minorSixthNote} (6.ª bemol), aportando el color menor natural para contrastar el brillo dórico.`
        }
      })
    } else if (isMinorScale) {
      // Menor natural: iv ➔ i a IV ➔ i (Dorian IV borrowing)
      const majorSixthNote = transposeNote(ivChord.activeKey, 9, ivChord.activeKey)
      const miInfo = getModalInterchange('IV_major', scaleType)

      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Intercambio modal Dorian (${ivChord.root} ➔ ${ivChord.root}m)`,
        text: `Convertir el subdominante diatónico iv (${ivChord.root}m) en mayor (${ivChord.root}) introduce la sexta mayor brillante (${majorSixthNote}) prestada del modo Dórico.`,
        preview: `${ivChord.root}m ➔ ${ivChord.root} ➔ ${nextChord.root}m`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'maj', tensions: ivChord.tensions, bass: ivChord.bass } }
        ],
        metadata: {
          name: `${ivChord.root}`,
          categoryLabel: 'Intercambio Modal',
          function: 'IV (Dorian)',
          origin: 'Modo Dórico (Préstamo)',
          target: `${nextChord.root}m`,
          tension: 'Media',
          styles: ['ROCK', 'POP', 'JAZZ'],
          explanation: `El préstamo del IV grado mayor introduce la nota ${majorSixthNote} (sexta mayor del modo dórico), suavizando la melancolía del iv grado menor.`
        }
      })
    } else if (isMelodicMinorScale) {
      const flatVIRoot = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)
      candidates.push({
        id: `rule_13_melodic_minor_${systemIndex}`,
        category: 'color',
        title: `Préstamo modal ♭VI (Menor Natural)`,
        text: `Se detecta la resolución hacia la tónica menor. Te sugerimos tomar prestado el acorde de sexto grado bemol mayor ♭VI (${flatVIRoot} mayor) de la escala menor natural paralela para suavizar el brillo de la menor melódica e inyectar un color más melancólico y majestuoso.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${flatVIRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: flatVIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatVIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VI',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Menor Melódica',
          target: `${nextChord.root}`,
          tension: 'Baja-Media',
          styles: ['Jazz', 'Fusion', 'Pop', 'Cine'],
          explanation: `El acorde ♭VI mayor prestado de la menor natural interrumpe el carácter brillante de la sexta mayor melódica.`
        }
      })
    } else if (isDorianFlat2Scale) {
      const flatVIRoot = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)
      candidates.push({
        id: `rule_13_dorian_flat2_${systemIndex}`,
        category: 'color',
        title: `Préstamo modal ♭VI (Frigio / Menor Natural)`,
        text: `Te sugerimos tomar prestado el acorde de sexto grado bemol mayor ♭VI (${flatVIRoot} mayor) del modo Frigio paralelo. Esto aporta un respiro armónico mayor estable frente a la tensión de la segunda menor modal.`,
        preview: `${ivChord.root}${ivChord.type || ''} ➔ ${flatVIRoot} ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: flatVIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatVIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VI',
          origin: 'Modo Frigio (Préstamo)',
          mode: 'Dórico ♭2',
          target: `${nextChord.root}`,
          tension: 'Baja',
          styles: ['Jazz', 'Fusion', 'Cine'],
          explanation: `Sustituye el acorde inestable por el grado ♭VI mayor estable para reposar la progresión.`
        }
      })
    } else if (isLydianAugmentedScale) {
      const stableTonicRoot = nextChord.root
      candidates.push({
        id: `rule_13_lydian_augmented_${systemIndex}`,
        category: 'color',
        title: `Estabilizar Quinta Aumentada (I+ ➔ Imaj7)`,
        text: `Se detecta la tónica aumentada I+ (${nextChord.root}maj7#5). Te sugerimos tomar prestado el acorde de tónica mayor diatónica (${stableTonicRoot}maj7) del Modo Lidio natural, resolviendo la tensión de la quinta aumentada en una quinta justa tradicional.`,
        preview: `${nextChord.root}maj7#5 ➔ ${stableTonicRoot}maj7`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: stableTonicRoot, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${stableTonicRoot}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I (Modo Lidio)',
          origin: 'Modo Lidio Natural (Préstamo)',
          mode: 'Lidio Aumentado',
          target: `${stableTonicRoot}maj7`,
          tension: 'Baja',
          styles: ['Jazz', 'Pop', 'Cine'],
          explanation: `Sustituye la tónica aumentada por una tónica mayor con quinta justa, relajando la tensión de la quinta aumentada.`
        }
      })
    } else if (isLydianDominantScale) {
      const stableTonicRoot = nextChord.root
      candidates.push({
        id: `rule_13_lydian_dominant_${systemIndex}`,
        category: 'color',
        title: `Comparar Color Modal (I7 ➔ Imaj7)`,
        text: `Te sugerimos tomar prestado el acorde de tónica con séptima mayor (${stableTonicRoot}maj7) del Modo Lidio natural. Esto permite comparar el carácter dominante frente al de tónica mayor de ensueño.`,
        preview: `${stableTonicRoot}7 ➔ ${stableTonicRoot}maj7`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: stableTonicRoot, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${stableTonicRoot}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'Imaj7',
          origin: 'Modo Lidio (Préstamo)',
          mode: 'Lidio Dominante',
          target: `${stableTonicRoot}maj7`,
          tension: 'Baja',
          styles: ['Jazz', 'Fusion', 'Pop'],
          explanation: `Transforma el acorde dominante en un maj7 estable para reposar la tonalidad.`
        }
      })
    } else if (isMixolydianFlat6Scale) {
      const stableTonicRoot = nextChord.root
      candidates.push({
        id: `rule_13_mixolydian_flat6_${systemIndex}`,
        category: 'color',
        title: `Restaurar color Mixolidio (I7b6 ➔ I7)`,
        text: `Te sugerimos tomar prestado el acorde de tónica dominante con sexta justa (${stableTonicRoot}7) de la escala Mixolidia natural para disipar la melancolía de la sexta bemol.`,
        preview: `${stableTonicRoot}7(b13) ➔ ${stableTonicRoot}7`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: stableTonicRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${stableTonicRoot}7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I7',
          origin: 'Modo Mixolidio (Préstamo)',
          mode: 'Mixolidio ♭6',
          target: `${stableTonicRoot}7`,
          tension: 'Baja-Media',
          styles: ['Jazz', 'Rock', 'Gospel'],
          explanation: `Sustituye la tónica con sexta bemol por la tónica mixolidia estándar.`
        }
      })
    } else if (isLocrianSharp2Scale) {
      const locrianTonicRoot = nextChord.root
      candidates.push({
        id: `rule_13_locrian_sharp2_${systemIndex}`,
        category: 'color',
        title: `Comparar Color Modal (iø ➔ i°)`,
        text: `Te sugerimos tomar prestado el acorde disminuido de tónica i° (${locrianTonicRoot}dim) de la escala Locria tradicional para comparar la segunda mayor con la segunda bemol.`,
        preview: `${locrianTonicRoot}m7b5 ➔ ${locrianTonicRoot}dim`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: locrianTonicRoot, type: 'dim', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${locrianTonicRoot}dim`,
          categoryLabel: 'Intercambio Modal',
          function: 'i°',
          origin: 'Modo Locrio Tradicional (Préstamo)',
          mode: 'Locrio ♮2',
          target: `${locrianTonicRoot}dim`,
          tension: 'Media-Alta',
          styles: ['Jazz Moderno', 'Fusion', 'Cine'],
          explanation: `Reemplaza la segunda mayor con la segunda menor locria para incrementar la tensión.`
        }
      })
    } else if (isAlteredScale) {
      const stableTonicRoot = nextChord.root
      candidates.push({
        id: `rule_13_altered_scale_${systemIndex}`,
        category: 'color',
        title: `Estabilizar Dominante Alterado (V7alt ➔ I)`,
        text: `Se sugiere resolver el dominante alterado hacia una tónica mayor o menor estable (${stableTonicRoot}m o ${stableTonicRoot}) prestada del modo paralelo para dar resolución al clímax.`,
        preview: `${ivChord.root}7alt ➔ ${stableTonicRoot}`,
        payload: [
          { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: stableTonicRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${stableTonicRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'I',
          origin: 'Escala Mayor Paralela (Préstamo)',
          mode: 'Alterado',
          target: `${stableTonicRoot}`,
          tension: 'Baja',
          styles: ['Jazz', 'Fusion', 'Gospel'],
          explanation: `Resuelve el acorde dominante alterado sobre una tónica diatónica tradicional.`
        }
      })
    } else if (isDiminishedWHScale) {
      candidates.push({
        id: `rule_13_diminished_wh_${systemIndex}`,
        category: 'color',
        title: `Intercambio por Escala Alterada (dim7 ➔ 7alt)`,
        text: `Te sugerimos cambiar el acorde disminuido por un dominante alterado (7alt) en la misma raíz (${ivChord.root}7alt) para contrastar la tensión simétrica de la escala disminuida T-S con la tensión máxima lineal de la escala Alterada paralela.`,
        preview: `${ivChord.root}dim7 ➔ ${ivChord.root}7alt`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}7alt`,
          categoryLabel: 'Intercambio Modal',
          function: 'Sustitución de Tensión (Disminuida a Alterada)',
          origin: 'Escala Alterada Paralela (Préstamo)',
          mode: 'Disminuida T-S',
          target: `${nextChord.root}`,
          tension: 'Máxima',
          styles: ['Jazz', 'Fusion', 'Gospel'],
          explanation: `Sustituye la tensión simétrica disminuida por la tensión alterada lineal para redirigir la resolución armónica.`
        }
      })
    } else if (isDiminishedHWScale) {
      candidates.push({
        id: `rule_13_diminished_hw_${systemIndex}`,
        category: 'color',
        title: `Intercambio por Escala Alterada (7dim ➔ 7alt)`,
        text: `Te sugerimos tomar prestado el acorde de dominante alterado de la escala Alterada paralela (${ivChord.root}7alt) para contrastar el dominante disminuido simétrico con el color de dominante extremo lineal.`,
        preview: `${ivChord.root}7 ➔ ${ivChord.root}7alt`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}7alt`,
          categoryLabel: 'Intercambio Modal',
          function: 'Sustitución de Tensión (S-T a Alterada)',
          origin: 'Escala Alterada Paralela (Préstamo)',
          mode: 'Disminuida S-T',
          target: `${nextChord.root}`,
          tension: 'Máxima',
          styles: ['Jazz', 'Fusion', 'Gospel'],
          explanation: `La escala Alterada sustituye el dominante disminuido aportando un color más extremo.`
        }
      })
    } else if (isWholeToneScale) {
      candidates.push({
        id: `rule_13_whole_tone_${systemIndex}`,
        category: 'color',
        title: `Intercambio por Escala Alterada (7#5 ➔ 7alt)`,
        text: `Te sugerimos tomar prestado un acorde de la escala Alterada paralela (${ivChord.root}7alt) para sustituir el dominante aumentado simétrico, ofreciendo un color dominante de tensión extrema lineal.`,
        preview: `${ivChord.root}7#5 ➔ ${ivChord.root}7alt`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}7alt`,
          categoryLabel: 'Intercambio Modal',
          function: 'Sustitución de Tensión (Whole Tone a Alterada)',
          origin: 'Escala Alterada Paralela (Préstamo)',
          mode: 'Tonos Enteros',
          target: `${nextChord.root}`,
          tension: 'Máxima',
          styles: ['Jazz', 'Fusion', 'Gospel'],
          explanation: `Reemplaza el acorde de tonos enteros por un dominante alterado para resolver con mayor fuerza cromática.`
        }
      })
    } else if (isPentatonicMajorScale) {
      candidates.push({
        id: `rule_13_pentatonic_major_${systemIndex}`,
        category: 'color',
        title: `Préstamo Escala Mayor (Extender Pentatónica)`,
        text: `Te sugerimos tomar prestado un acorde de la escala Mayor paralela para completar la pentatónica, agregando el cuarto grado mayor (IV) o el séptimo grado diatónico para contrastar la estabilidad de la pentatónica con tensión tonal.`,
        preview: `${ivChord.root} ➔ IV`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}`,
          categoryLabel: 'Intercambio Modal',
          function: 'I',
          origin: 'Escala Mayor Diatónica (Préstamo)',
          mode: 'Pentatónica Mayor',
          target: `${nextChord.root}`,
          tension: 'Baja',
          styles: ['Pop', 'Folk'],
          explanation: `Rellena los grados ausentes (4 y 7) de la escala mayor natural paralela para ampliar el rango melódico.`
        }
      })
    } else if (isPentatonicMinorScale) {
      const flatSixRoot = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)
      candidates.push({
        id: `rule_13_pentatonic_minor_${systemIndex}`,
        category: 'color',
        title: `Préstamo Escala Menor (Extender Pentatónica)`,
        text: `Te sugerimos tomar prestado el acorde de sexto grado mayor ♭VI (${flatSixRoot}) de la escala menor natural paralela para contrastar la pentatónica menor introduciendo la sexta bemol.`,
        preview: `${ivChord.root} ➔ ${flatSixRoot}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: flatSixRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatSixRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VI',
          origin: 'Escala Menor Natural (Préstamo)',
          mode: 'Pentatónica Menor',
          target: `${nextChord.root}`,
          tension: 'Media-Baja',
          styles: ['Rock', 'Metal', 'Folk'],
          explanation: `Añadir el grado ♭VI introduce la sexta bemol que falta en la pentatónica menor.`
        }
      })
    } else if (isBluesScale) {
      candidates.push({
        id: `rule_13_blues_${systemIndex}`,
        category: 'color',
        title: `Limpiar Tensión (Blues ➔ Pentatónica Menor)`,
        text: `Te sugerimos eliminar la Blue Note (♭5) y contrastar la sonoridad de blues transformando el acorde en una pentatónica menor pura para rebajar el nivel de tensión.`,
        preview: `${ivChord.root}dim ➔ ${ivChord.root}m`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'i',
          origin: 'Escala Pentatónica Menor (Préstamo)',
          mode: 'Escala de Blues',
          target: `${nextChord.root}`,
          tension: 'Baja',
          styles: ['Blues', 'Rock', 'Jazz'],
          explanation: `Elimina la Blue Note para pasar de una sonoridad de tensión media a una sonoridad menor estable.`
        }
      })
    } else if (isBebopDominantScale) {
      candidates.push({
        id: `rule_13_bebop_dominant_${systemIndex}`,
        category: 'color',
        title: `Limpiar Tensión (Bebop ➔ Mixolidia)`,
        text: `Te sugerimos tomar prestado el acorde de tónica dominante de la escala Mixolidia paralela para eliminar la séptima mayor de paso y volver a la sonoridad dominante diatónica tradicional de siete notas.`,
        preview: `${ivChord.root}7 ➔ ${ivChord.root}7`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivChord.root}7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I7',
          origin: 'Modo Mixolidio (Préstamo)',
          mode: 'Bebop Dominante',
          target: `${nextChord.root}`,
          tension: 'Baja',
          styles: ['Swing', 'Jazz', 'Bebop'],
          explanation: `Elimina la séptima mayor de paso bebop y retorna al color dominante de la Mixolidia estándar.`
        }
      })
    } else {
      // Mayor: IV ➔ I a IVm ➔ I (Parallel minor borrowing)
      const minorSixthNote = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)
      const miInfo = getModalInterchange('iv_minor', scaleType)

      candidates.push({
        id: `rule_13_${systemIndex}`,
        category: 'color',
        title: `Intercambio modal (${ivChord.root}m ➔ ${nextChord.root})`,
        text: `Convertir el acorde subdominante IV (${ivChord.root}) en menor (${ivChord.root}m) es uno de los recursos de color más hermosos en el pop. Introduce la nota ${minorSixthNote} (extraída del menor paralelo), la cual conduce con una suave melancolía por semitono descendente hacia la quinta del acorde de tónica ${nextChord.root}. Al mismo tiempo, la fundamental de ${ivChord.root}m desciende hacia la tercera de ${nextChord.root}, logrando una hermosa resolución doble por semitono.`,
        preview: `${ivChord.root} ➔ ${ivChord.root}m ➔ ${nextChord.root}`,
        payload: [
          { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'min', tensions: ivChord.tensions, bass: ivChord.bass } }
        ],
        metadata: {
          name: `${ivChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'iv',
          origin: 'Modo Menor Paralelo',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media',
          styles: miInfo ? miInfo.styles.map(s => s.toUpperCase()) : ['POP', 'BALADAS', 'GOSPEL', 'CINE'],
          explanation: `${miInfo ? miInfo.explanation : ''} La sexta bemol (${minorSixthNote}) y el bajo conducen por semitono descendente doble hacia la quinta y tercera del reposo, logrando una enorme emotividad.`
        }
      })
    }
  }

  // Regla 14: Dominante prolongado a b9 / #9 / b13
  const sustainedDomIdx = activeChords.findIndex(c => normDegree(c.degree) === 'V' && ['7', '7sus4'].includes(c.type))
  if (sustainedDomIdx !== -1) {
    const sustainedDom = activeChords[sustainedDomIdx]
    const flat9Note = transposeNote(sustainedDom.root, 13, sustainedDom.activeKey)
    const flat13Note = transposeNote(sustainedDom.root, 8, sustainedDom.activeKey)
    const nextChord = activeChords[(sustainedDomIdx + 1) % 4]
    const flat9Resolution = explainNoteResolution(flat9Note, nextChord, sustainedDom.activeKey)
    const flat13Resolution = explainNoteResolution(flat13Note, nextChord, sustainedDom.activeKey)

    candidates.push({
      id: `rule_14_${systemIndex}`,
      category: 'color',
      title: 'Tensión Alterada en Dominante',
      text: `Para darle una sonoridad más densa y expresiva al dominante ${sustainedDom.root}7, podrías probar añadiendo tensiones alteradas como b9 o b13. En la resolución hacia ${nextChord.root}, la tensión b9 (${flat9Note}) se comporta así: ${flat9Resolution}; y la tensión b13 (${flat13Note}) se conduce así: ${flat13Resolution}.`,
      preview: `${sustainedDom.root}7 ➔ ${sustainedDom.root}7(b9,b13)`,
      payload: [
        { measureIndex: sustainedDom.globalMeasureIndex, beatIndex: sustainedDom.beatIndex, chord: { root: sustainedDom.root, type: '7', tensions: [...sustainedDom.tensions, 'b9', 'b13'], bass: sustainedDom.bass } }
      ],
      metadata: {
        name: `${sustainedDom.root}7(b9,b13)`,
        categoryLabel: 'Color / Estilo',
        function: 'V7(alt)',
        origin: isMinorScale ? 'Menor Natural' : 'Escala Menor Armónica / Alterada',
        target: `${nextChord.root}${nextChord.type}`,
        tension: 'Alta',
        styles: ['Jazz', 'Gospel', 'Fusion'],
        explanation: `Incrementa la atracción funcional del dominante mediante disonancias alteradas. La tensión b9 (${flat9Note}) se comporta así: ${flat9Resolution}. La tensión b13 (${flat13Note}) se conduce así: ${flat13Resolution}.`
      }
    })
  }

  // Regla 15: Cambio modal en repetición (bVI / ii_minor)
  if (isMinorScale) {
    // Menor natural: sugiere Bm (ii dórico) en lugar del ii° diatónico
    const dimChordIdx = activeChords.findIndex(c => normDegree(c.degree) === 'ii' && c.type.includes('dim'))
    if (dimChordIdx !== -1) {
      const dimChord = activeChords[dimChordIdx]
      const nextChord = activeChords[(dimChordIdx + 1) % 4]
      const miInfo = getModalInterchange('ii_minor', scaleType)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ii menor (Dórico)',
        text: `Sustituir el acorde disminuido inestable ${dimChord.root}dim por el acorde prestado ${dimChord.root}m (ii menor) suaviza las tensiones en el bajo.`,
        preview: `${dimChord.root}dim ➔ ${dimChord.root}m`,
        payload: [
          { measureIndex: dimChord.globalMeasureIndex, beatIndex: dimChord.beatIndex, chord: { root: dimChord.root, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${dimChord.root}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'ii',
          origin: 'Modo Dórico (Préstamo)',
          mode: 'Menor Natural',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'POP'],
          explanation: `El ii grado menor dórico elimina la quinta disminuida áspera del ii° diatónico menor natural, dando una transición más cálida y lírica.`
        }
      })
    }
  } else if (isDorianScale) {
    // Dórico: sugiere Em7b5 (ii° de menor natural) en lugar del ii menor dórico
    const miniiChordIdx = activeChords.findIndex(c => normDegree(c.degree) === 'ii' && ['min', 'm', 'm7', 'minor'].includes(c.type || ''))
    if (miniiChordIdx !== -1) {
      const miniiChord = activeChords[miniiChordIdx]
      const nextChord = activeChords[(miniiChordIdx + 1) % 4]
      const miInfo = getModalInterchange('ii_dim_natural', scaleType)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ii° disminuido (Menor Natural)',
        text: `El segundo grado diatónico en Dórico es menor (${miniiChord.root}m). Para preparar un acorde dominante o intensificar la transición hacia el destino, puedes tomar prestado el acorde disminuido/semidisminuido ${miniiChord.root}m7b5 del modo menor natural, introduciendo la tensión modal b5.`,
        preview: `${miniiChord.root}m ➔ ${miniiChord.root}m7b5`,
        payload: [
          { measureIndex: miniiChord.globalMeasureIndex, beatIndex: miniiChord.beatIndex, chord: { root: miniiChord.root, type: 'm7b5', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${miniiChord.root}m7b5`,
          categoryLabel: 'Intercambio Modal',
          function: 'ii° (Menor Natural)',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Dórico',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Alta',
          styles: ['JAZZ', 'FUSION', 'GOSPEL'],
          explanation: `Sustituye el segundo grado menor por el semidisminuido prestado de la menor natural para preparar resoluciones con un toque de jazz clásico.`
        }
      })
    }
  } else if (isPhrygianScale) {
    // Frigio: sugiere v menor (por ejemplo, Bm) en lugar del v° disminuido (Bdim)
    const dimvChordIdx = activeChords.findIndex(c => (c.degree === 'v°' || normDegree(c.degree) === 'v') && ['dim', 'dim7', 'm7b5', '°'].some(term => c.type.includes(term) || c.degree.includes(term)))
    if (dimvChordIdx !== -1) {
      const dimvChord = activeChords[dimvChordIdx]
      const nextChord = activeChords[(dimvChordIdx + 1) % 4]
      const vRoot = getScaleNotes(dimvChord.activeKey, dimvChord.activeScale)[4] || transposeNote(dimvChord.activeKey, 7, dimvChord.activeKey)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal v menor (Menor Natural)',
        text: `El quinto grado diatónico en el Modo Frigio es disminuido e inestable (${dimvChord.root}dim). Para suavizar la sonoridad en secciones repetitivas, te sugerimos tomar prestado el acorde de quinto grado menor (${vRoot}m) del modo menor natural paralelo, eliminando la quinta disminuida áspera.`,
        preview: `${dimvChord.root}dim ➔ ${vRoot}m`,
        payload: [
          { measureIndex: dimvChord.globalMeasureIndex, beatIndex: dimvChord.beatIndex, chord: { root: vRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${vRoot}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'v (Menor Natural)',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Frigio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['METAL', 'SOUNDTRACK', 'ROCK'],
          explanation: `Sustituye el inestable quinto grado disminuido v° (${dimvChord.root}dim) por el v menor prestado de la menor natural para estabilizar la sonoridad y dar un color modal más melódico.`
        }
      })
    }
  } else if (isLydianScale) {
    // Lydian: sugiere ii menor (por ejemplo, Dm) en lugar del II mayor (D)
    const majIICIdx = activeChords.findIndex(c => normDegree(c.degree) === 'ii' && ['maj', '7', 'major', ''].includes(c.type || ''))
    if (majIICIdx !== -1) {
      const majIICChord = activeChords[majIICIdx]
      const nextChord = activeChords[(majIICIdx + 1) % 4]
      const iiRoot = getScaleNotes(majIICChord.activeKey, majIICChord.activeScale)[1] || transposeNote(majIICChord.activeKey, 2, majIICChord.activeKey)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ii menor (Mayor Paralela)',
        text: `El segundo grado diatónico en Lidio es mayor (${majIICChord.root}). Para suavizar la sonoridad o generar variación en secciones repetitivas, te sugerimos tomar prestado el acorde de segundo grado menor (${iiRoot}m) de la escala mayor paralela.`,
        preview: `${majIICChord.root} ➔ ${iiRoot}m`,
        payload: [
          { measureIndex: majIICChord.globalMeasureIndex, beatIndex: majIICChord.beatIndex, chord: { root: iiRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'ii (Escala Mayor)',
          origin: 'Escala Mayor Paralela (Préstamo)',
          mode: 'Lidio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'POP', 'FUSION'],
          explanation: `Sustituye el segundo grado mayor característico II (${majIICChord.root}) por el ii menor prestado de la escala mayor paralela, relajando el brillo del modo Lidio durante las repeticiones.`
        }
      })
    }
  } else if (isMixolydianScale) {
    // Mixolydian: sugiere bIII prestado de Menor Natural en lugar de I repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const bIIIRoot = transposeNote(repIChord.activeKey, 3, repIChord.activeKey) // bIII
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ♭III (Menor Natural)',
        text: `El acorde de tónica I (${repIChord.root}) se repite de forma consecutiva. Para romper la monotonía armónica con un color enérgico y épico, te sugerimos tomar prestado el acorde mayor del tercer grado bemol ♭III (${bIIIRoot} mayor) de la escala menor natural paralela.`,
        preview: `${repIChord.root} ➔ ${bIIIRoot}`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: bIIIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${bIIIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭III',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Mixolidio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media',
          styles: ['ROCK', 'METAL', 'CINE'],
          explanation: `El préstamo del grado ♭III mayor (prestado de la menor natural paralela) añade un tinte de rock pesado y de gran fuerza tonal sobre la repetición de la tónica.`
        }
      })
    }
  } else if (isIonianSharp5Scale) {
    // Ionian #5: sugiere II mayor (e.g. D) de Lidia en lugar de I+ repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const iiRoot = getScaleNotes(repIChord.activeKey, repIChord.activeScale)[1] || transposeNote(repIChord.activeKey, 2, repIChord.activeKey)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal II Mayor (Modo Lidio)',
        text: `El acorde de tónica aumentada I+ (${repIChord.root}maj7#5) se repite consecutivamente. Para romper la inestabilidad y aportar una sonoridad de gran brillo, te sugerimos tomar prestado el acorde de segundo grado mayor II (${iiRoot} mayor) de la escala Lidia paralela.`,
        preview: `${repIChord.root}maj7#5 ➔ ${iiRoot}`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: iiRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'II (Modo Lidio)',
          origin: 'Modo Lidio (Préstamo)',
          mode: 'Jónico ♯5',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media',
          styles: ['JAZZ', 'FUSION', 'CINE'],
          explanation: `Sustituye la tónica aumentada repetida por el segundo grado mayor II prestado de Lidia, aportando un brillo característico y abriendo la sonoridad.`
        }
      })
    }
  } else if (isDorianSharp4Scale) {
    // Dorian #4: sugiere bVI (e.g. Bb) de Menor Natural en lugar de i repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const bVIRoot = transposeNote(repIChord.activeKey, 8, repIChord.activeKey) // bVI (Bb in D scale)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ♭VI (Menor Natural)',
        text: `El acorde de tónica menor i (${repIChord.root}m) se repite consecutivamente. Para romper la monotonía y añadir un color épico y majestuoso, te sugerimos tomar prestado el acorde de sexto grado bemol ♭VI (${bVIRoot} mayor) de la escala paralela menor natural.`,
        preview: `${repIChord.root}m ➔ ${bVIRoot}`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: bVIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${bVIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VI (Menor Natural)',
          origin: 'Menor Natural (Préstamo)',
          mode: 'Dórico ♯4',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja-Media',
          styles: ['JAZZ', 'FUSION', 'CINE'],
          explanation: `Sustituye la tónica repetida por el grado ♭VI mayor prestado de la menor natural para resolver la tensión del modo Dórico ♯4 con una transición de carácter majestuoso.`
        }
      })
    }
  } else if (isPhrygianDominantScale) {
    // Phrygian Dominant: sugiere IV mayor (e.g. A) de Mixolidio en lugar de I repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const ivRoot = getScaleNotes(repIChord.activeKey, repIChord.activeScale)[3] || transposeNote(repIChord.activeKey, 5, repIChord.activeKey) // IV (A in E scale)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal IV (Modo Mixolidio)',
        text: `El acorde de tónica dominante I (${repIChord.root}) se repite de forma consecutiva. Para romper la monotonía armónica, te sugerimos tomar prestado el acorde de cuarto grado mayor IV (${ivRoot} mayor) del Modo Mixolidio paralelo, que comparte la séptima bemol pero introduce un brillo mayor abierto y exótico.`,
        preview: `${repIChord.root} ➔ ${ivRoot}`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: ivRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${ivRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: 'IV (Modo Mixolidio)',
          origin: 'Modo Mixolidio (Préstamo)',
          mode: 'Frigio Dominante',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja-Media',
          styles: ['JAZZ', 'FUSION', 'FLAMENCO'],
          explanation: `Sustituye la tónica dominante repetida por el grado IV mayor prestado del modo Mixolidio paralelo, rompiendo la repetición con un color brillante y abierto.`
        }
      })
    }
  } else if (isLydianSharp2Scale) {
    // Lydian #2: sugiere I+ (e.g. Fmaj7#5) de Jónica #5 en lugar de I repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const iPlusRoot = repIChord.root // F

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal I+ (Modo Jónico ♯5)',
        text: `El acorde de tónica mayor I (${repIChord.root}) se repite de forma consecutiva. Para romper la repetición e introducir un color de gran misterio y brillo flotante, te sugerimos tomar prestado el acorde de tónica aumentada I+ (${iPlusRoot}maj7#5) del Modo Jónico ♯5 paralelo.`,
        preview: `${repIChord.root} ➔ ${iPlusRoot}maj7#5`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: iPlusRoot, type: 'maj7#5', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iPlusRoot}maj7#5`,
          categoryLabel: 'Intercambio Modal',
          function: 'I+ (Modo Jónico ♯5)',
          origin: 'Modo Jónico ♯5 (Préstamo)',
          mode: 'Lidio ♯2',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Alta',
          styles: ['JAZZ', 'FUSION', 'CINE'],
          explanation: `Sustituye la tónica mayor repetida por el acorde de tónica aumentada I+ prestado de Jónica ♯5, inyectando un color flotante y misterioso.`
        }
      })
    }
  } else if (isUltralocrianScale) {
    // Superlocrio Disminuido: sugiere ♭♭VII (e.g. Fmaj7) en lugar de i° repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const flatFlatVIIRoot = getScaleNotes(repIChord.activeKey, repIChord.activeScale)[6] || transposeNote(repIChord.activeKey, 9, repIChord.activeKey) // ♭♭VII (F in G# scale)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ♭♭VII (Modo Superlocrio Disminuido)',
        text: `El acorde disminuido de tónica i° (${repIChord.root}${repIChord.type || ''}) se repite de forma consecutiva. Para romper la inestabilidad extrema y aportar un respiro armónico, te sugerimos utilizar el acorde de séptima disminuida bemol ♭♭VII (${flatFlatVIIRoot} mayor / maj7), que funciona como una expansión brillante dentro del modo.`,
        preview: `${repIChord.root}${repIChord.type || ''} ➔ ${flatFlatVIIRoot}maj7`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: flatFlatVIIRoot, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatFlatVIIRoot}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: '♭♭VII (Superlocrio Disminuido)',
          origin: 'Modo Superlocrio Disminuido (Expansión)',
          mode: 'Superlocrio Disminuido',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'CINE'],
          explanation: `Sustituye la tónica disminuida repetida por el acorde mayor ♭♭VII, aliviando la inestabilidad mediante un reposo brillante en el compás de paso.`
        }
      })
    }
  } else if (isHarmonicMinorScale) {
    // Harmonic Minor: sugiere ii menor (e.g. Bm) de Menor Melódica en lugar de i repetido
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const iiRoot = getScaleNotes(repIChord.activeKey, repIChord.activeScale)[1] || transposeNote(repIChord.activeKey, 2, repIChord.activeKey)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ii menor (Menor Melódica)',
        text: `El acorde de tónica menor i (${repIChord.root}m) se repite consecutivamente. Para variar la progresión con una conducción de voces más fluida y un color sofisticado, te sugerimos tomar prestado el acorde de segundo grado menor ii (${iiRoot}m) de la escala Menor Melódica paralela (en lugar del ii° disminuido diatónico).`,
        preview: `${repIChord.root}m ➔ ${iiRoot}m`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: iiRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'ii (Menor Melódica)',
          origin: 'Menor Melódica (Préstamo)',
          mode: 'Menor Armónica',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Baja',
          styles: ['JAZZ', 'FUSION', 'POP'],
          explanation: `Sustituye la tónica repetida o el ii° disminuido por el ii menor (Bm) prestado de la menor melódica paralela, suavizando la inestabilidad de la escala disminuida diatónica.`
        }
      })
    }
  } else if (isLocrianSharp6Scale) {
    // Locrian ♮6: sugiere bVI (e.g. G) de Locrio tradicional en lugar de iø repetido
    const repIDimIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIDimIdx !== -1) {
      const repIDimChord = activeChords[repIDimIdx + 1]
      const nextChord = activeChords[(repIDimIdx + 2) % 4]
      const bVIRoot = transposeNote(repIDimChord.activeKey, 8, repIDimChord.activeKey) // bVI

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ♭VI (Locrio Tradicional)',
        text: `El acorde de tónica semidisminuido iø (${repIDimChord.root}m7b5) se repite consecutivamente. Para romper la inestabilidad tonal y añadir un color mayor reposado, te sugerimos tomar prestado el acorde de sexto grado bemol ♭VI (${bVIRoot} mayor) de la escala paralela Locria tradicional.`,
        preview: `${repIDimChord.root}m7b5 ➔ ${bVIRoot}`,
        payload: [
          { measureIndex: repIDimChord.globalMeasureIndex, beatIndex: repIDimChord.beatIndex, chord: { root: bVIRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${bVIRoot}`,
          categoryLabel: 'Intercambio Modal',
          function: '♭VI (Locrio Tradicional)',
          origin: 'Modo Locrio Tradicional (Préstamo)',
          mode: 'Locrio ♮6',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'METAL'],
          explanation: `Reemplaza la tónica repetida inestable por el grado ♭VI mayor prestado de Locrio tradicional, reduciendo la fricción disminuida mediante un reposo mayor.`
        }
      })
    }
  } else if (isLocrianScale) {
    // Locrian: sugiere ii de Locrio #2 (ii semidisminuido, e.g. C#m7b5) en lugar de i° repetido
    const repIDimIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIDimIdx !== -1) {
      const repIDimChord = activeChords[repIDimIdx + 1]
      const nextChord = activeChords[(repIDimIdx + 2) % 4]
      const iiRoot = getScaleNotes(repIDimChord.activeKey, repIDimChord.activeScale)[1] || transposeNote(repIDimChord.activeKey, 2, repIDimChord.activeKey)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ii semidisminuido (Locrio ♯2)',
        text: `El acorde de tónica disminuido i° (${repIDimChord.root}dim) se repite consecutivamente. Para variar la sonoridad y suavizar la tensión estructural, te sugerimos tomar prestado el acorde de segundo grado semidisminuido ii° (${iiRoot}m7b5) de la escala paralela Locria ♯2 (que posee novena natural).`,
        preview: `${repIDimChord.root}dim ➔ ${iiRoot}m7b5`,
        payload: [
          { measureIndex: repIDimChord.globalMeasureIndex, beatIndex: repIDimChord.beatIndex, chord: { root: iiRoot, type: 'm7b5', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}m7b5`,
          categoryLabel: 'Intercambio Modal',
          function: 'ii° (Locrio ♯2)',
          origin: 'Modo Locrio ♯2 (Préstamo)',
          mode: 'Locrio',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Alta',
          styles: ['JAZZ MODERNO', 'FUSION'],
          explanation: `El préstamo del grado ii° de Locrio ♯2 introduce la novena natural, suavizando el intervalo áspero del acorde disminuido de tónica en la repetición.`
        }
      })
    }
  } else if (isMelodicMinorScale) {
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo de tónica mayor paralela (i ➔ Imaj7)',
        text: `El acorde de tónica menor i (${repIChord.root}m) se repite consecutivamente. Para variar la sección con una sonoridad brillante y de gran resolución, te sugerimos tomar prestado el acorde de tónica Mayor (${repIChord.root}maj7) de la escala mayor paralela.`,
        preview: `${repIChord.root}m ➔ ${repIChord.root}maj7`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: repIChord.root, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${repIChord.root}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'Imaj7 (Mayor Paralela)',
          origin: 'Mayor Paralela (Préstamo)',
          mode: 'Menor Melódica',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'GOSPEL'],
          explanation: `Sustituye la tónica menor por la mayor paralela para dar un reposo luminoso y optimista en la repetición.`
        }
      })
    }
  } else if (isDorianFlat2Scale) {
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      const iiRoot = transposeNote(repIChord.root, 2, repIChord.activeKey)
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal II natural (Modo Dórico)',
        text: `El acorde de tónica menor i (${repIChord.root}m) se repite. Te sugerimos tomar prestado el segundo grado menor II (${iiRoot}m) del modo Dórico natural para comparar la sonoridad de la segunda justa frente a la segunda bemol modal.`,
        preview: `${repIChord.root}m ➔ ${iiRoot}m`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: iiRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${iiRoot}m`,
          categoryLabel: 'Intercambio Modal',
          function: 'II (Dórico)',
          origin: 'Modo Dórico (Préstamo)',
          mode: 'Dórico ♭2',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Baja',
          styles: ['JAZZ', 'FUSION'],
          explanation: `Sustituye la repetición con el grado II de dórico natural, aliviando la tensión del ♭2.`
        }
      })
    }
  } else if (isLydianAugmentedScale) {
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Estabilizar Quinta Aumentada (I+ ➔ Imaj7)',
        text: `La tónica aumentada I+ (${repIChord.root}maj7#5) se repite. Te sugerimos tomar prestado el acorde estable de tónica mayor Imaj7 (${repIChord.root}maj7) del Modo Lidio natural para suavizar la tensión de la quinta aumentada.`,
        preview: `${repIChord.root}maj7#5 ➔ ${repIChord.root}maj7`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: repIChord.root, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${repIChord.root}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I (Lidio)',
          origin: 'Modo Lidio (Préstamo)',
          mode: 'Lidio Aumentado',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'CINE'],
          explanation: `Suaviza el color aumentado de la repetición mediante el reposo con quinta justa.`
        }
      })
    }
  } else if (isLydianDominantScale) {
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Modal (I7 ➔ Imaj7)',
        text: `La tónica I7 (${repIChord.root}7) se repite. Te sugerimos tomar prestado el acorde de séptima mayor Imaj7 (${repIChord.root}maj7) de Lidio natural para comparar el carácter de dominante frente al de tónica mayor de ensueño.`,
        preview: `${repIChord.root}7 ➔ ${repIChord.root}maj7`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: repIChord.root, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${repIChord.root}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'Imaj7',
          origin: 'Modo Lidio (Préstamo)',
          mode: 'Lidio Dominante',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['JAZZ', 'FUSION', 'POP'],
          explanation: `Remplaza la tónica dominante repetida por la séptima mayor estable.`
        }
      })
    }
  } else if (isMixolydianFlat6Scale) {
    const repIIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repIIdx !== -1) {
      const repIChord = activeChords[repIIdx + 1]
      const nextChord = activeChords[(repIIdx + 2) % 4]
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal 6 natural (Mixolidio)',
        text: `La tónica I7 se repite. Te sugerimos tomar prestado el acorde de tónica mixolidia estándar (${repIChord.root}7) con sexta justa para atenuar la tensión de la sexta bemol.`,
        preview: `${repIChord.root}7(b13) ➔ ${repIChord.root}7`,
        payload: [
          { measureIndex: repIChord.globalMeasureIndex, beatIndex: repIChord.beatIndex, chord: { root: repIChord.root, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${repIChord.root}7`,
          categoryLabel: 'Intercambio Modal',
          function: 'I7',
          origin: 'Modo Mixolidio (Préstamo)',
          mode: 'Mixolidio ♭6',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja-Media',
          styles: ['JAZZ', 'ROCK', 'GOSPEL'],
          explanation: `Elimina la sexta bemol repetida para reposar la progresión en un dominante tradicional.`
        }
      })
    }
  } else if (isLocrianSharp2Scale) {
    const repIDimIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIDimIdx !== -1) {
      const repIDimChord = activeChords[repIDimIdx + 1]
      const nextChord = activeChords[(repIDimIdx + 2) % 4]
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal ♭2 (Locrio Tradicional)',
        text: `El acorde semidisminuido iø (${repIDimChord.root}m7b5) se repite. Te sugerimos tomar prestado el acorde disminuido de tónica i° (${repIDimChord.root}dim) de Locrio tradicional para comparar la segunda mayor contra la segunda menor.`,
        preview: `${repIDimChord.root}m7b5 ➔ ${repIDimChord.root}dim`,
        payload: [
          { measureIndex: repIDimChord.globalMeasureIndex, beatIndex: repIDimChord.beatIndex, chord: { root: repIDimChord.root, type: 'dim', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${repIDimChord.root}dim`,
          categoryLabel: 'Intercambio Modal',
          function: 'i°',
          origin: 'Modo Locrio Tradicional (Préstamo)',
          mode: 'Locrio ♮2',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Alta',
          styles: ['JAZZ MODERNO', 'FUSION'],
          explanation: `Reemplaza la segunda mayor por la segunda menor de locrio tradicional.`
        }
      })
    }
  } else if (isAlteredScale) {
    const repIDimIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repIDimIdx !== -1) {
      const repIDimChord = activeChords[repIDimIdx + 1]
      const nextChord = activeChords[(repIDimIdx + 2) % 4]
      const flatIIRoot = transposeNote(repIDimChord.root, 1, repIDimChord.activeKey)
      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Tritonal Alterada (V7alt ➔ ♭II7alt)',
        text: `El dominante alterado se repite. Te sugerimos realizar una sustitución tritonal alterada aplicando el acorde ♭II7alt (${flatIIRoot}7alt) para generar un color de movimiento cromático descendente muy rico en jazz y fusión.`,
        preview: `${repIDimChord.root}7alt ➔ ${flatIIRoot}7alt`,
        payload: [
          { measureIndex: repIDimChord.globalMeasureIndex, beatIndex: repIDimChord.beatIndex, chord: { root: flatIIRoot, type: '7alt', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}7alt`,
          categoryLabel: 'Rearmonización',
          function: '♭II7alt',
          origin: 'Modo Alterado (Sustitución)',
          mode: 'Alterado',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Máxima',
          styles: ['JAZZ MODERNO', 'FUSION'],
          explanation: `El uso de la sustitución tritonal alterada (♭II7alt) resuelve por semitono descendente y comparte el mismo tritono guía.`
        }
      })
    }
  } else if (isDiminishedWHScale) {
    const repDimIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repDimIdx !== -1) {
      const repChord = activeChords[repDimIdx + 1]
      const nextChord = activeChords[(repDimIdx + 2) % 4]
      const minorThirdUpRoot = transposeNote(repChord.root, 3, repChord.activeKey)
      candidates.push({
        id: `rule_15_diminished_wh_${systemIndex}`,
        category: 'color',
        title: 'Desplazamiento Simétrico Disminuido (dim7 ➔ ♭iiidim7)',
        text: `El acorde disminuido i° se repite. Te sugerimos aprovechar la simetría de la escala disminuida T-S y desplazar el segundo acorde disminuido una tercera menor hacia arriba (${minorThirdUpRoot}dim7) para variar la sonoridad manteniendo exactamente la misma función armónica.`,
        preview: `${repChord.root}dim7 ➔ ${minorThirdUpRoot}dim7`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: minorThirdUpRoot, type: 'dim7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${minorThirdUpRoot}dim7`,
          categoryLabel: 'Rearmonización',
          function: '♭iii°',
          origin: 'Escala Disminuida T-S (Simetría)',
          mode: 'Disminuida T-S',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Alta',
          styles: ['JAZZ', 'BEBOP', 'GOSPEL', 'SWING'],
          explanation: `Los acordes disminuidos desplazados por terceras menores son funcionalmente equivalentes y comparten las mismas notas básicas.`
        }
      })
    }
  } else if (isDiminishedHWScale) {
    const repDomIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repDomIdx !== -1) {
      const repChord = activeChords[repDomIdx + 1]
      const nextChord = activeChords[(repDomIdx + 2) % 4]
      const tritoneRoot = transposeNote(repChord.root, 6, repChord.activeKey)
      candidates.push({
        id: `rule_15_diminished_hw_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Tritonal con Novena Bemol (V7 ➔ ♭II7(♭9))',
        text: `El acorde de dominante se repite. Te sugerimos realizar una sustitución tritonal aplicando el acorde ♭II7(♭9) (${tritoneRoot}7(♭9)) en el segundo compás para generar un movimiento cromático descendente muy elegante.`,
        preview: `${repChord.root}7 ➔ ${tritoneRoot}7(b9)`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: tritoneRoot, type: '7', tensions: ['b9'], bass: null } }
        ],
        metadata: {
          name: `${tritoneRoot}7(♭9)`,
          categoryLabel: 'Rearmonización',
          function: '♭II7(♭9)',
          origin: 'Escala Disminuida S-T (Sustitución)',
          mode: 'Disminuida S-T',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Alta',
          styles: ['JAZZ', 'BEBOP', 'SWING', 'GOSPEL'],
          explanation: `La sustitución tritonal (♭II7) comparte el mismo tritono guía y resuelve por semitono descendente en el bajo.`
        }
      })
    }
  } else if (isWholeToneScale) {
    const repDomIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repDomIdx !== -1) {
      const repChord = activeChords[repDomIdx + 1]
      const nextChord = activeChords[(repDomIdx + 2) % 4]
      const tritoneRoot = transposeNote(repChord.root, 6, repChord.activeKey)
      candidates.push({
        id: `rule_15_whole_tone_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Whole Tone (V7♯5 ➔ ♭II7♯5)',
        text: `El acorde de dominante aumentado se repite. Te sugerimos realizar una sustitución Whole Tone aplicando el acorde ♭II7♯5 (${tritoneRoot}7♯5) para introducir un elegante movimiento descendente en el bajo manteniendo la simetría de la escala.`,
        preview: `${repChord.root}7#5 ➔ ${tritoneRoot}7#5`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: tritoneRoot, type: '7#5', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${tritoneRoot}7♯5`,
          categoryLabel: 'Rearmonización',
          function: '♭II7♯5',
          origin: 'Escala de Tonos Enteros (Sustitución)',
          mode: 'Tonos Enteros',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Alta',
          styles: ['JAZZ', 'FUSION', 'IMPRESIONISMO'],
          explanation: `Debido a la simetría de tonos enteros, la sustitución a distancia de tritono mantiene exactamente el mismo conjunto de notas.`
        }
      })
    }
  } else if (isPentatonicMajorScale) {
    const repTonicIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repTonicIdx !== -1) {
      const repChord = activeChords[repTonicIdx + 1]
      const nextChord = activeChords[(repTonicIdx + 2) % 4]
      const relativeMinorRoot = getScaleNotes(repChord.activeKey, repChord.activeScale)[4] || transposeNote(repChord.activeKey, 9, repChord.activeKey)
      candidates.push({
        id: `rule_15_pentatonic_major_${systemIndex}`,
        category: 'color',
        title: 'Variación por Relativa Menor (I ➔ vi)',
        text: `El acorde de tónica mayor se repite. Te sugerimos rearmonizar el segundo compás con su relativo menor vi (${relativeMinorRoot}m) para variar el color manteniendo la melodía pentatónica consonante.`,
        preview: `${repChord.root} ➔ ${relativeMinorRoot}m`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: relativeMinorRoot, type: 'min', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${relativeMinorRoot}m`,
          categoryLabel: 'Rearmonización',
          function: 'vi',
          origin: 'Escala Pentatónica Mayor (Relativa)',
          mode: 'Pentatónica Mayor',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['Pop', 'Folk', 'Country'],
          explanation: `El acorde de relativa menor vi comparte la mayoría de sus notas con la tónica mayor I, lo que garantiza suavidad.`
        }
      })
    }
  } else if (isPentatonicMinorScale) {
    const repTonicIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repTonicIdx !== -1) {
      const repChord = activeChords[repTonicIdx + 1]
      const nextChord = activeChords[(repTonicIdx + 2) % 4]
      const relativeMajorRoot = getScaleNotes(repChord.activeKey, repChord.activeScale)[1] || transposeNote(repChord.activeKey, 3, repChord.activeKey)
      candidates.push({
        id: `rule_15_pentatonic_minor_${systemIndex}`,
        category: 'color',
        title: 'Variación por Relativa Mayor (i ➔ ♭III)',
        text: `El acorde de tónica menor se repite. Te sugerimos rearmonizar el segundo compás con su relativo mayor ♭III (${relativeMajorRoot} mayor) para inyectar brillo melódico.`,
        preview: `${repChord.root}m ➔ ${relativeMajorRoot}`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: relativeMajorRoot, type: 'maj', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${relativeMajorRoot}`,
          categoryLabel: 'Rearmonización',
          function: '♭III',
          origin: 'Escala Pentatónica Menor (Relativa)',
          mode: 'Pentatónica Menor',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Baja',
          styles: ['Rock', 'Folk', 'Pop'],
          explanation: `El acorde relativo mayor ♭III suaviza el carácter menor agregando una sonoridad abierta.`
        }
      })
    }
  } else if (isBluesScale) {
    const repTonicIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repTonicIdx !== -1) {
      const repChord = activeChords[repTonicIdx + 1]
      const nextChord = activeChords[(repTonicIdx + 2) % 4]
      candidates.push({
        id: `rule_15_blues_${systemIndex}`,
        category: 'color',
        title: 'Rearmonización Novena de Blues (7 ➔ 7(♯9))',
        text: `La tónica de blues se repite. Te sugerimos rearmonizar el segundo compás con un acorde de séptima con novena aumentada 7(♯9) (${repChord.root}7(♯9)) para añadir la disonancia clásica y picante del blues.`,
        preview: `${repChord.root}7 ➔ ${repChord.root}7(#9)`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: repChord.root, type: '7', tensions: ['#9'], bass: null } }
        ],
        metadata: {
          name: `${repChord.root}7(♯9)`,
          categoryLabel: 'Rearmonización',
          function: '7(♯9)',
          origin: 'Escala de Blues (Tensiones)',
          mode: 'Escala de Blues',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media-Alta',
          styles: ['Blues', 'Rock', 'Jazz', 'Funk'],
          explanation: `La novena aumentada (♯9) contiene la tercera menor de la escala superpuesta sobre la tercera mayor del acorde dominante.`
        }
      })
    }
  } else if (isBebopDominantScale) {
    const repDomIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repDomIdx !== -1) {
      const repChord = activeChords[repDomIdx + 1]
      const nextChord = activeChords[(repDomIdx + 2) % 4]
      const flatIIRoot = transposeNote(repChord.root, 1, repChord.activeKey)
      candidates.push({
        id: `rule_15_bebop_dominant_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Backdoor Bebop (I7 ➔ ♭II7)',
        text: `El acorde dominante se repite. Te sugerimos rearmonizar el segundo compás con una resolución backdoor aplicando el acorde ♭II7 (${flatIIRoot}7) para generar un elegante movimiento cromático melódico propio del swing.`,
        preview: `${repChord.root}7 ➔ ${flatIIRoot}7`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: flatIIRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${flatIIRoot}7`,
          categoryLabel: 'Rearmonización',
          function: '♭II7',
          origin: 'Escala Bebop Dominante (Sustitución)',
          mode: 'Bebop Dominante',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media',
          styles: ['Bebop', 'Swing', 'Jazz'],
          explanation: `La resolución backdoor es un recurso sofisticado del bebop que resuelve por tono entero ascendente en el bajo.`
        }
      })
    }
  } else if (isHungarianMajorScale) {
    const repTonicIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'I' && normDegree(activeChords[idx+1].degree) === 'I')
    if (repTonicIdx !== -1) {
      const repChord = activeChords[repTonicIdx + 1]
      const nextChord = activeChords[(repTonicIdx + 2) % 4]
      const tritoneRoot = transposeNote(repChord.root, 6, repChord.activeKey)
      candidates.push({
        id: `rule_15_hungarian_major_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Tritonal Exótica (I ➔ ♭II7)',
        text: `El acorde de tónica mayor se repite. Te sugerimos realizar una sustitución de tensión exótica aplicando el acorde de dominante tritonal ♭II7 (${tritoneRoot}7) en el segundo compás para un movimiento de resolución sofisticado.`,
        preview: `${repChord.root} ➔ ${tritoneRoot}7`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: tritoneRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${tritoneRoot}7`,
          categoryLabel: 'Rearmonización',
          function: '♭II7',
          origin: 'Escala Mayor Húngara (Tritono)',
          mode: 'Mayor Húngara',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Alta',
          styles: ['Fusion', 'Jazz', 'Cine'],
          explanation: `El uso de la sustitución tritonal (♭II7) proporciona una resolución por semitono descendente de gran color exótico.`
        }
      })
    }
  } else if (isHungarianMinorScale) {
    const repTonicIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'i' && normDegree(activeChords[idx+1].degree) === 'i')
    if (repTonicIdx !== -1) {
      const repChord = activeChords[repTonicIdx + 1]
      const nextChord = activeChords[(repTonicIdx + 2) % 4]
      const tritoneRoot = transposeNote(repChord.root, 1, repChord.activeKey)
      candidates.push({
        id: `rule_15_hungarian_minor_${systemIndex}`,
        category: 'color',
        title: 'Sustitución Tritonal del Dominante (i ➔ ♭II7)',
        text: `El acorde de tónica menor se repite. Te sugerimos rearmonizar con el acorde de sustitución tritonal del dominante ♭II7 (${tritoneRoot}7) antes de volver a la tónica para inyectar tensión dramática de semitono descendente.`,
        preview: `${repChord.root}m ➔ ${tritoneRoot}7`,
        payload: [
          { measureIndex: repChord.globalMeasureIndex, beatIndex: repChord.beatIndex, chord: { root: tritoneRoot, type: '7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${tritoneRoot}7`,
          categoryLabel: 'Rearmonización',
          function: '♭II7',
          origin: 'Escala Menor Húngara (Tritono)',
          mode: 'Menor Húngara',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Alta',
          styles: ['Metal Neoclásico', 'Cine', 'Gitana'],
          explanation: `El acorde ♭II7 (ej: Bb7) actúa como sustituto tritonal de la dominante V7, resolviendo por semitono descendente hacia la tónica menor.`
        }
      })
    }
  } else {
    // Mayor: bVI (Modal interchange)
    const ivOrVChordIdx = activeChords.findIndex(c => ['IV', 'V'].includes(normDegree(c.degree)) && c.globalMeasureIndex > 1)
    if (ivOrVChordIdx !== -1) {
      const ivOrVChord = activeChords[ivOrVChordIdx]
      const modalRoot = transposeNote(ivOrVChord.activeKey, 8, ivOrVChord.activeKey) // bVI
      const nextChord = activeChords[(ivOrVChordIdx + 1) % 4]
      const voiceLeadingText = explainNoteResolution(modalRoot, nextChord, ivOrVChord.activeKey)
      const miInfo = getModalInterchange('bVI', scaleType)

      candidates.push({
        id: `rule_15_${systemIndex}`,
        category: 'color',
        title: 'Préstamo modal bVI',
        text: `En la segunda mitad de la sección, sustituir el acorde de ${ivOrVChord.root} por el acorde prestado ${modalRoot}maj7 (bVI) aporta un color de intercambio modal de ensueño. Al enlazar con el siguiente acorde (${nextChord.root}), la fundamental del acorde prestado (${modalRoot}) se conduce de la siguiente manera: ${voiceLeadingText}.`,
        preview: `${ivOrVChord.root} ➔ ${modalRoot}maj7`,
        payload: [
          { measureIndex: ivOrVChord.globalMeasureIndex, beatIndex: ivOrVChord.beatIndex, chord: { root: modalRoot, type: 'maj7', tensions: [], bass: null } }
        ],
        metadata: {
          name: `${modalRoot}maj7`,
          categoryLabel: 'Intercambio Modal',
          function: 'bVI',
          origin: 'Modo Menor Paralelo',
          target: `${nextChord.root}${nextChord.type}`,
          tension: 'Media',
          styles: miInfo ? miInfo.styles.map(s => s.toUpperCase()) : ['SOUNDTRACK', 'ROCK', 'POP', 'CINE'],
          explanation: `${miInfo ? miInfo.explanation : ''} Moverse al grado bVI expande el espectro de color. Conducción hacia el destino: ${voiceLeadingText}.`
        }
      })
    }
  }


  // ==================== 🔴 VOICE LEADING / FLUIDEZ (voice_leading) ====================

  // Regla 16: Bajo descendente (slash chords)
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    const deg1 = normDegree(c1.degree)
    const deg2 = normDegree(c2.degree)
    
    const isItoV = (isMinorScale || isDorianScale) ? (deg1 === 'i' && deg2 === 'v') : (deg1 === 'I' && deg2 === 'V')
    
    if (isItoV) {
      const thirdNote = getThirdOfRoot(c2.root, c2.type, c2.activeKey)
      candidates.push({
        id: `rule_16_${systemIndex}`,
        category: 'voice_leading',
        title: (isMinorScale || isDorianScale) ? 'Crear bajo descendente fluido (i ➔ v/3)' : 'Crear bajo descendente fluido (I ➔ V/3)',
        text: `En el paso de ${c1.root} a ${c2.root}, usar la primera inversión ${c2.root}/${thirdNote} (con la tercera en el bajo) suaviza el salto. El bajo se desplaza de la tónica a la tercera de la dominante por paso conjunto, logrando una conducción elegante.`,
        preview: `${c1.root} ➔ ${c2.root}/${thirdNote}`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: c2.root, type: c2.type, tensions: c2.tensions, bass: thirdNote } }
        ],
        metadata: {
          name: `${c2.root}/${thirdNote}`,
          categoryLabel: 'Voice Leading',
          function: (isMinorScale || isDorianScale) ? 'v/3 (Primera Inversión)' : 'V/3 (Primera Inversión)',
          origin: originScaleLabel,
          target: `${c2.root}`,
          tension: 'Baja',
          styles: ['Pop', 'Rock', 'Gospel'],
          explanation: `Suaviza el salto del bajo al conectar tónica con dominante. El bajo desciende suavemente por semitono o tono de ${c1.root} a la tercera de v (${thirdNote}), logrando gran fluidez.`
        }
      })
      break
    }
  }

  // Regla 17: Acordes cercanos (Inversiones)
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    const idx1 = NOTE_TO_INDEX[c1.root]
    const idx2 = NOTE_TO_INDEX[c2.root]
    if (idx1 !== undefined && idx2 !== undefined) {
      const diff = Math.abs(idx2 - idx1)
      if ((diff === 1 || diff === 2) && !c2.bass) { // Acordes cercanos en semitonos (ej: F y G)
        const thirdNote = getThirdOfRoot(c2.root, c2.type, c2.activeKey)
        candidates.push({
          id: `rule_17_${systemIndex}`,
          category: 'voice_leading',
          title: 'Usar primera inversión en paso conjunto',
          text: `Al conectar los acordes cercanos ${c1.root} y ${c2.root}, usar la inversión ${c2.root}/${thirdNote} reduce la distancia de salto en el registro grave. El bajo se mueve de la fundamental ${c1.root} a la tercera del acorde siguiente (${thirdNote}), manteniendo las líneas graves conectadas por paso conjunto.`,
          preview: `${c1.root} ➔ ${c2.root}/${thirdNote}`,
          payload: [
            { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: c2.root, type: c2.type, tensions: c2.tensions, bass: thirdNote } }
          ],
          metadata: {
            name: `${c2.root}/${thirdNote}`,
            categoryLabel: 'Voice Leading',
            function: 'Primera Inversión',
            origin: originScaleLabel,
            target: `${c2.root}`,
            tension: 'Baja',
            styles: ['Pop', 'Rock', 'Jazz'],
            explanation: `Reduce la distancia física del bajo en movimientos por grado conjunto. El bajo se desplaza suavemente de la fundamental de ${c1.root} a la tercera de ${c2.root} (${thirdNote}).`
          }
        })
        break
      }
    }
  }

  // Regla 18: Línea de bajo conectada (I ➔ VII ➔ vi / i ➔ ♭VII ➔ ♭VI)
  if (activeChords.length >= 3) {
    const c1 = activeChords[0]
    const c2 = activeChords[1]
    const c3 = activeChords[2]
    
    const isScaleI_V_VI = isMinorScale
      ? (normDegree(c1.degree) === 'i' && normDegree(c2.degree) === 'v' && normDegree(c3.degree) === 'VI')
      : (normDegree(c1.degree) === 'I' && normDegree(c2.degree) === 'V' && normDegree(c3.degree) === 'vi')

    if (isScaleI_V_VI) {
      const thirdNote = getThirdOfRoot(c2.root, c2.type, c2.activeKey)
      candidates.push({
        id: `rule_18_${systemIndex}`,
        category: 'voice_leading',
        title: isMinorScale ? 'Bajo descendente melódico conectado (i ➔ ♭VII ➔ ♭VI)' : 'Bajo descendente melódico conectado (I ➔ VII ➔ vi)',
        text: `Para guiar el oído melódicamente, puedes conectar la progresión usando la inversión ${c2.root}/${thirdNote} en el acorde de dominante. El bajo realiza un descenso melódico paso a paso en la escala en lugar de dar un gran salto interválico.`,
        preview: isMinorScale ? `${c1.root}m ➔ ${c2.root}m/${thirdNote} ➔ ${c3.root}` : `${c1.root} ➔ ${c2.root}/${thirdNote} ➔ ${c3.root}m`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: c2.root, type: c2.type, tensions: c2.tensions, bass: thirdNote } }
        ],
        metadata: {
          name: `${c2.root}/${thirdNote}`,
          categoryLabel: 'Voice Leading',
          function: isMinorScale ? 'v/3 (Bajo Escalar)' : 'V/3 (Bajo Escalar)',
          origin: originScaleLabel,
          target: `${c3.root}${c3.type}`,
          tension: 'Baja',
          styles: ['Pop', 'Rock', 'Gospel'],
          explanation: `Establece una línea de bajo escalar descendente continua. Conduce al oyente suavemente sin saltos interválicos abruptos en el registro grave.`
        }
      })
    }
  }

  // Regla 19: Repetición exacta (Variación de bajo)
  const repeatedChord = activeChords.find((c, idx) => {
    if (idx < 3) {
      const next = activeChords[idx+1]
      return c.root === next.root && c.type === next.type && !c.bass && !next.bass
    }
    return false
  })
  if (repeatedChord) {
    const idx = activeChords.indexOf(repeatedChord)
    const nextChord = activeChords[idx + 1]
    const thirdNote = getThirdOfRoot(nextChord.root, nextChord.type, nextChord.activeKey)
    candidates.push({
      id: `rule_19_${systemIndex}`,
      category: 'voice_leading',
      title: 'Variar el bajo en la repetición del acorde',
      text: `Repetir el mismo acorde de ${repeatedChord.root} en la misma posición puede sonar estático. Usar la primera inversión ${nextChord.root}/${thirdNote} en la segunda aparición mantiene el movimiento lineal del bajo, que se mueve de la fundamental ${repeatedChord.root} a su tercera mayor/menor (${thirdNote}) en la segunda mitad, creando un movimiento melódico interno que reactiva el interés armónico.`,
      preview: `${repeatedChord.root} ➔ ${nextChord.root}/${thirdNote}`,
      payload: [
        { measureIndex: nextChord.globalMeasureIndex, beatIndex: nextChord.beatIndex, chord: { root: nextChord.root, type: nextChord.type, tensions: nextChord.tensions, bass: thirdNote } }
      ],
      metadata: {
        name: `${nextChord.root}/${thirdNote}`,
        categoryLabel: 'Voice Leading',
        function: 'Primera Inversión de Repetición',
        origin: originScaleLabel,
        target: `${nextChord.root}`,
        tension: 'Baja',
        styles: ['Pop', 'Rock', 'Jazz', 'Gospel'],
        explanation: `Evita el estatismo al repetir el mismo acorde consecutivamente, variando su inversión en el bajo para generar una línea de movimiento melódica.`
      }
    })
  }

  // Regla 20: Resolución fuerte (V ➔ I) con tensión previa (sus4 o b9)
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    
    const isVtoI = isMinorScale ? (normDegree(c1.degree) === 'V' && normDegree(c2.degree) === 'i') : (normDegree(c1.degree) === 'V' && normDegree(c2.degree) === 'I')

    if (isVtoI) {
      const fourNote = transposeNote(c1.root, 5, c1.activeKey)
      const thirdNote = transposeNote(c1.root, 4, c1.activeKey)

      candidates.push({
        id: `rule_20_${systemIndex}`,
        category: 'voice_leading',
        title: 'Retardar resolución con acorde sus4',
        text: `Para retardar y embellecer la resolución final hacia la tónica ${c2.root}, puedes suspender temporalmente la tercera del dominante usando ${c1.root}7sus4. La cuarta suspendida (${fourNote}) del acorde ${c1.root}sus4 se sostiene para luego resolver descendiendo por semitono hacia la tercera mayor (${thirdNote}) del propio acorde dominante, antes de que este resuelva finalmente en la tónica ${c2.root}.`,
        preview: `${c1.root}sus4 ➔ ${c1.root} ➔ ${c2.root}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: c1.beatIndex, chord: { root: c1.root, type: '7sus4', tensions: c1.tensions, bass: c1.bass } }
        ],
        metadata: {
          name: `${c1.root}7sus4`,
          categoryLabel: 'Voice Leading',
          function: 'V7sus4 (Suspensión)',
          origin: isMinorScale ? 'Menor Armónica' : 'Escala Mayor',
          target: `${c2.root}${c2.type}`,
          tension: 'Media',
          styles: ['Pop', 'Jazz', 'Gospel'],
          explanation: `Retarda la resolución suspendiendo la tercera del dominante. La cuarta suspendida (${fourNote}) se mantiene y resuelve de forma descendente por semitono hacia la tercera (${thirdNote}).`
        }
      })
      break
    }
  }

  // ==================== 🟣 SUGERENCIAS DE MODULACIÓN (modulation) ====================

  // Regla M1: Modulación por Dominante Secundaria Detectada
  if (activeChords.length >= 2) {
    for (let i = 0; i < 3; i++) {
      const c1 = activeChords[i]
      const c2 = activeChords[i+1]
      
      const isC1Dominant = c1.type === '7'
      const scaleNotesC1 = getScaleNotes(c1.activeKey, c1.activeScale)
      const isC1NonDiatonic = !scaleNotesC1.includes(c1.root)
      const isResolvingToNext = transposeNote(c2.root, 7, c1.activeKey) === c1.root
      
      if (isC1Dominant && isC1NonDiatonic && isResolvingToNext) {
        const nextKey = c2.root
        const nextScale = ['min', 'm7', 'm7b5', 'min7', 'minor'].includes(c2.type) ? 'minor' : 'major'
        
        candidates.push({
          id: `rule_mod_1_${systemIndex}`,
          category: 'modulation',
          title: `💡 Insinuación de modulación a ${nextKey} ${nextScale === 'minor' ? 'menor' : 'Mayor'}`,
          text: `Se detecta el acorde dominante ${c1.root}7 resolviendo a ${c2.root}${c2.type}. Esto insinúa que tu música está modulando de forma natural hacia la tonalidad de ${nextKey} ${nextScale === 'minor' ? 'menor' : 'Mayor'}. Puedes aplicar un cambio de tonalidad formal a partir de ${c2.root} para actualizar el análisis armónico del sistema.`,
          preview: `Modular a ${nextKey} ${nextScale === 'minor' ? 'menor' : 'Mayor'}`,
          payload: [
            { type: 'keyChange', measureIndex: c2.globalMeasureIndex, key: nextKey, scaleType: nextScale }
          ],
          metadata: {
            name: 'Modulación Directa',
            categoryLabel: 'Modulación / Tonalidad',
            function: 'Modulación V/I local',
            origin: 'Insinuación por dominante secundario',
            target: `${nextKey} ${nextScale === 'minor' ? 'menor' : 'Mayor'}`,
            tension: 'Media-Alta',
            styles: ['POP', 'JAZZ', 'GOSPEL'],
            explanation: `El acorde dominante ${c1.root}7 resuelve hacia ${c2.root}, insinuando una transición tonal suave hacia la nueva tonalidad de ${nextKey}.`
          }
        })
        break
      }
    }
  }

  // Regla M2: Modulación por Cúmulo de Acordes fuera de escala
  const nonDiatonicChords = activeChords.filter(c => {
    const sn = getScaleNotes(c.activeKey, c.activeScale)
    return !sn.includes(c.root)
  })
  
  if (nonDiatonicChords.length >= 2) {
    const allRoots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
    const allScales = ['major', 'minor']
    let bestKey = ''
    let bestScale = 'major'
    let maxMatches = 0
    
    for (const r of allRoots) {
      for (const s of allScales) {
        const sn = getScaleNotes(r, s)
        let matches = 0
        activeChords.forEach(c => {
          if (sn.includes(c.root)) matches++
        })
        if (matches > maxMatches) {
          maxMatches = matches
          bestKey = r
          bestScale = s
        }
      }
    }
    
    const firstChord = activeChords[0]
    const isDifferent = bestKey !== firstChord.activeKey || bestScale !== firstChord.activeScale
    if (maxMatches >= 3 && isDifferent) {
      const firstNonDiatonic = nonDiatonicChords[0]
      candidates.push({
        id: `rule_mod_2_${systemIndex}`,
        category: 'modulation',
        title: `💡 Nueva tonalidad sugerida: ${bestKey} ${bestScale === 'minor' ? 'menor' : 'Mayor'}`,
        text: `Has introducido varios acordes fuera de la escala actual (${nonDiatonicChords.map(c => c.root).join(', ')}). Este bloque de acordes encaja de forma óptima en la tonalidad de ${bestKey} ${bestScale === 'minor' ? 'menor' : 'Mayor'}. Te sugerimos formalizar este cambio de tonalidad a partir del compás ${firstNonDiatonic.globalMeasureIndex + 1} para mantener la coherencia analítica.`,
        preview: `Establecer tono ${bestKey} ${bestScale === 'minor' ? 'menor' : 'Mayor'}`,
        payload: [
          { type: 'keyChange', measureIndex: firstNonDiatonic.globalMeasureIndex, key: bestKey, scaleType: bestScale }
        ],
        metadata: {
          name: 'Modulación Directa',
          categoryLabel: 'Modulación / Tonalidad',
          function: 'Cambio de Centro Tonal',
          origin: 'Modulación por cúmulo armónico',
          target: `${bestKey} ${bestScale === 'minor' ? 'menor' : 'Mayor'}`,
          tension: 'Media-Alta',
          styles: ['POP', 'ROCK', 'JAZZ'],
          explanation: `Has introducido múltiples acordes cromáticos (${nonDiatonicChords.map(c => c.root).join(', ')}) que forman parte natural de ${bestKey} ${bestScale === 'minor' ? 'menor' : 'Mayor'}. Modificar la tonalidad aclara el análisis teórico.`
        }
      })
    }
  }

  // Regla M3: Modulación Ascendente de Energía para la repetición
  const allDiatonic = activeChords.every(c => {
    const sn = getScaleNotes(c.activeKey, c.activeScale)
    return sn.includes(c.root)
  })
  if (allDiatonic && systemIndex > 0) {
    const upHalfKey = transposeNote(keyRoot, 1, keyRoot)
    candidates.push({
      id: `rule_mod_3_${systemIndex}`,
      category: 'modulation',
      title: '💡 Subir medio tono para modular la repetición',
      text: `Esta sección es muy estable. Para la siguiente vuelta o sección final, puedes subir medio tono hacia ${upHalfKey} ${scaleType === 'minor' ? 'menor' : 'Mayor'} para aumentar la intensidad, rango melódico y energía de la interpretación.`,
      preview: `Subir a ${upHalfKey} ${scaleType === 'minor' ? 'menor' : 'Mayor'}`,
      payload: [
        { type: 'keyChange', measureIndex: activeChords[3].globalMeasureIndex + 1, key: upHalfKey, scaleType: scaleType }
      ],
      metadata: {
        name: 'Modulación de Energía',
        categoryLabel: 'Modulación / Tonalidad',
        function: 'Modulación Ascendente Cromática',
        origin: 'Modulación de Clímax',
        target: `${upHalfKey} ${scaleType === 'minor' ? 'menor' : 'Mayor'}`,
        tension: 'Alta',
        styles: ['POP', 'ROCK', 'JAZZ', 'GOSPEL'],
        explanation: `Subir la afinación medio tono en la repetición final es un clásico del pop/baladas que inyecta energía adicional a la pieza y expande el rango melódico.`
      }
    })
  }

  // --- NORMALIZAR METADATOS Y MODO ASOCIADO ---
  candidates.forEach(c => {
    if (c.metadata) {
      if (!c.metadata.mode) {
        c.metadata.mode = isDorianScale ? 'Dórico' : (isMinorScale ? 'Menor Natural' : 'Escala Mayor')
      }
    }
  })

  // --- PRIORIDAD AUTOMÁTICA Y FILTRADO (Máx 3 sugerencias por sistema) ---
  const categoriesList = ['enrich', 'movement', 'color', 'voice_leading', 'modulation']
  const finalSuggestions = []
  
  categoriesList.forEach(cat => {
    const catSuggestions = candidates.filter(c => c.category === cat)
    if (catSuggestions.length > 0) {
      finalSuggestions.push(catSuggestions[0])
    }
  })

  return finalSuggestions.slice(0, 3)
}

/**
 * Aplica una sugerencia a la cuadrícula de compases
 */
export function applySuggestion(measures, payload) {
  const newMeasures = JSON.parse(JSON.stringify(measures))
  
  payload.forEach(change => {
    if (change.type === 'keyChange') {
      const m = newMeasures[change.measureIndex]
      if (m) {
        m.keyChange = {
          key: change.key,
          scaleType: change.scaleType || 'major'
        }
      }
    } else {
      const m = newMeasures[change.measureIndex]
      if (m && m.beats && m.beats[change.beatIndex] !== undefined) {
        m.beats[change.beatIndex] = {
          root: change.chord.root,
          type: change.chord.type,
          tensions: change.chord.tensions || [],
          tension: change.chord.tension || null,
          bass: change.chord.bass || null
        }
      }
    }
  })
  
  return newMeasures
}

export function analyzeModulationRelationship(fromKey, fromScale, toKey, toScale) {
  if (!fromKey || !toKey) return null
  
  const fromIdx = NOTE_TO_INDEX[fromKey]
  const toIdx = NOTE_TO_INDEX[toKey]
  if (fromIdx === undefined || toIdx === undefined) return null
  
  const semitones = (toIdx - fromIdx + 12) % 12
  
  // 1. Relativa: comparten la misma armadura de clave
  const sigFrom = getKeySignature(fromKey, fromScale || 'major')
  const sigTo = getKeySignature(toKey, toScale || 'major')
  const isSameSignature = sigFrom.type === sigTo.type && sigFrom.count === sigTo.count
  const isDifferentKey = fromKey !== toKey || fromScale !== toScale
  if (isSameSignature && isDifferentKey) {
    return {
      type: 'Relativa',
      description: 'Modulación a la Relativa. Dado que ambas tonalidades comparten la misma armadura de clave (mismas notas), la transición es extremadamente fluida y orgánica. Ofrece un cambio de color emocional (de mayor a menor o viceversa) sin alterar la afinación general.'
    }
  }
  
  // 2. Paralela
  if (fromKey === toKey && fromScale !== toScale) {
    return {
      type: 'Tonalidad Paralela',
      description: 'Modulación Paralela (Homónima). Mantiene la misma tónica fundamental pero cambia el modo (de Mayor a menor o viceversa). Aporta un contraste emocional inmediato y dramático, alterando la sonoridad sin mover el centro físico del bajo.'
    }
  }
  
  // 3. Subida de Energía (1 o 2 semitonos arriba)
  if (semitones === 1 || semitones === 2) {
    return {
      type: 'Modulación de Energía (Ascendente)',
      description: 'Modulación Ascendente por Paso Conjunto (subida de medio tono o un tono entero). Es el recurso por excelencia del pop y las baladas para las secciones finales o coros repetidos, elevando la melodía e inyectando un clímax emocional.'
    }
  }
  
  // 4. Dominante (V)
  if (semitones === 7) {
    return {
      type: 'A la Dominante (V)',
      description: 'Modulación a la Dominante. Es la transición clásica por excelencia en la música tonal. Moverse una quinta justa ascendente incrementa la brillantez y genera una tensión armónica natural que prepara un posterior reposo melódico.'
    }
  }
  
  // 5. Subdominante (IV)
  if (semitones === 5) {
    return {
      type: 'A la Subdominante (IV)',
      description: 'Modulación a la Subdominante. Conduce el flujo armónico una cuarta justa hacia arriba, lo que disminuye la tensión general y produce una sensación de expansión, descanso y calidez. Muy recomendada para puentes y secciones B.'
    }
  }
  
  // 6. Directa
  return {
    type: 'Modulación Directa',
    description: 'Modulación Directa (o cromática). Desplaza el centro tonal de forma abrupta a una región distante. Este contraste inmediato capta la atención del oyente y refresca la progresión con una textura tonal totalmente nueva.'
  }
}
