// src/core/suggestions.js
import { NOTE_TO_INDEX, transposeNote } from './notes.js'
import { getScaleNotes, SCALES } from './scales.js'
import { getKeySignature } from './keySignatures.js'

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
  const isMinor = ['min', 'm7', 'm7b5', 'mM7', 'min7', 'dim', 'dim7'].includes(chordType)
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

/**
 * Analiza un sistema específico de 4 compases y genera sugerencias basadas en las 20 reglas universales.
 */
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
 * Analiza un sistema específico de 4 compases y genera sugerencias basadas en las 20 reglas universales.
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
    return deg.replace('7', '').replace('maj', '').replace('min', '').replace('°', '')
  }

  // Helper para obtener nota de tensión 9
  const getNineNoteOfRoot = (root, keyCtx) => {
    return transposeNote(root, 2, keyCtx)
  }

  // ==================== 🟢 ENRIQUECIMIENTO (enrich) ====================

  // Regla 1: Tríadas a Tétradas
  const triadChordIdx = activeChords.findIndex(c => ['maj', 'min'].includes(c.type))
  if (triadChordIdx !== -1) {
    const triadChord = activeChords[triadChordIdx]
    const isMin = triadChord.type === 'min'
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
      ]
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
      ]
    })
  }

  // Regla 3: Acorde Mayor a maj7 o add9
  const majChordIdx = activeChords.findIndex(c => ['maj', 'major'].includes(c.type) || (c.type === 'maj7' && !c.tensions.includes('9')))
  if (majChordIdx !== -1) {
    const majChord = activeChords[majChordIdx]
    const isTriad = majChord.type === 'maj'
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
      ]
    })
  }

  // Regla 4: Acorde Menor a m7 o m9
  const minChordIdx = activeChords.findIndex(c => ['min', 'minor'].includes(c.type) || (c.type === 'm7' && !c.tensions.includes('9')))
  if (minChordIdx !== -1) {
    const minChord = activeChords[minChordIdx]
    const isTriad = minChord.type === 'min'
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
      ]
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
      ]
    })
  }


  // ==================== 🟡 MOVIMIENTO ARMÓNICO (movement) ====================

  // Regla 6: ii -> V -> I incompleto (Completar cadencia)
  let iiv1Matched = false
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    const deg1 = normDegree(c1.degree)
    const deg2 = normDegree(c2.degree)

    if (deg1 === 'ii' && deg2 === 'I') {
      const vRoot = getScaleNotes(c1.activeKey, c1.activeScale)[4] || transposeNote(c1.activeKey, 7, c1.activeKey)
      const vRootThird = transposeNote(vRoot, 4, c1.activeKey)
      const vRootSeventh = transposeNote(vRoot, 10, c1.activeKey)
      const c2Third = getThirdOfRoot(c2.root, c2.type, c1.activeKey)

      candidates.push({
        id: `rule_6_${systemIndex}`,
        category: 'movement',
        title: 'Completar cadencia ii–V–I',
        text: `Se detecta el paso directo de ii (${c1.root}m) a I (${c2.root}). Podrías explorar insertar el acorde dominante ${vRoot}7 en el segundo tiempo de ${c1.root}m. Esto completa la clásica cadencia ii-V-I, creando una tensión tritononal que conduce de forma fluida: la tercera de ${vRoot}7 (${vRootThird}) actúa como sensible y resuelve por semitono ascendente hacia la fundamental de ${c2.root}, mientras que su séptima (${vRootSeventh}) desciende por semitono hacia la tercera de ${c2.root} (${c2Third}).`,
        preview: `${c1.root}m ➔ ${vRoot}7 ➔ ${c2.root}`,
        payload: [
          { measureIndex: c1.globalMeasureIndex, beatIndex: 2, chord: { root: vRoot, type: '7', tensions: [], bass: null } }
        ]
      })
      iiv1Matched = true
      break
    }
  }

  // Regla 7: Dominante secundario estrictamente relacionado con el acorde menor/mayor siguiente
  let secDomMatched = false
  if (!iiv1Matched) {
    // Buscamos si existe un acorde diatónico objetivo (ii, iii, IV, V, vi) en los compases 2, 3 o 4
    const targetChordIdx = activeChords.findIndex((c, idx) => {
      if (idx === 0) return false
      // No sugerimos secundario para el primer grado (sería dominante primario)
      const degNormalized = normDegree(c.degree)
      if (degNormalized === 'I' || degNormalized === 'i') return false
      // Debe estar en la escala
      const sn = getScaleNotes(c.activeKey, c.activeScale)
      const isDiatonic = sn.includes(c.root)
      // Evitamos resolver a acordes disminuidos
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

      candidates.push({
        id: `rule_7_${systemIndex}`,
        category: 'movement',
        title: `Insertar Dominante Secundario (${secDomRoot}7 ➔ ${targetChord.root}${targetChord.type})`,
        text: `Para intensificar y dar una dirección armónica lógica y directa hacia el acorde de ${targetChord.root}${targetChord.type} (${targetChord.degree}), una opción clásica es anteponer su dominante secundario, ${secDomRoot}7 (V/${targetChord.degree}), en la segunda mitad del compás de ${prevChord.root}. ${voiceLeadingExplanation} Esto embellece la transición en pos de la continuidad armónica.`,
        preview: `${prevChord.root} ➔ ${secDomRoot}7 ➔ ${targetChord.root}`,
        payload: [
          { measureIndex: prevChord.globalMeasureIndex, beatIndex: 2, chord: { root: secDomRoot, type: '7', tensions: [], bass: null } }
        ]
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

          candidates.push({
            id: `rule_8_${systemIndex}`,
            category: 'movement',
            title: 'Insertar acorde de paso cromático',
            text: `Existe un salto de tono entero entre ${c1.root} y ${c2.root}. Podrías explorar insertar un acorde de paso disminuido ${passRoot}dim en medio. Esto crea una línea de bajo cromática ascendente (${c1.root} ➔ ${passRoot} ➔ ${c2.root}) de gran fluidez, donde las notas del acorde de paso (${passRoot}, ${passThird}, ${passFifth}) se enlazan por semitonos o notas comunes hacia el acorde de destino ${c2.root}.`,
            preview: `${c1.root} ➔ ${passRoot}dim ➔ ${c2.root}`,
            payload: [
              { measureIndex: c1.globalMeasureIndex, beatIndex: 2, chord: { root: passRoot, type: 'dim', tensions: [], bass: null } }
            ]
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
      ]
    })
  }

  // Regla 10: V a V7 o V alterado resolviendo a I
  const domChordIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'V' && normDegree(activeChords[idx+1].degree) === 'I')
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
      ]
    })
  }


  // ==================== 🔵 COLOR / MODAL (color) ====================

  // Regla 11: Mayor (I o IV) a #11 (Lidio)
  const lydianChordIdx = activeChords.findIndex(c => ['I', 'IV'].includes(normDegree(c.degree)) && (c.type === 'maj' || c.type === 'maj7' || c.type === 'major'))
  if (lydianChordIdx !== -1) {
    const lydianChord = activeChords[lydianChordIdx]
    const sharp11Note = transposeNote(lydianChord.root, 6, lydianChord.activeKey)
    const nextChord = activeChords[(lydianChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(sharp11Note, nextChord, lydianChord.activeKey)

    candidates.push({
      id: `rule_11_${systemIndex}`,
      category: 'color',
      title: 'Añadir color Lidio (#11)',
      text: `Podrías probar añadiendo la tensión #11 al acorde mayor de ${lydianChord.root} (${lydianChord.degree}). Esta nota característica del modo Lidio introduce una sonoridad brillante y de ensueño. Al conectar con el siguiente acorde (${nextChord.root}), la tensión #11 (${sharp11Note}) se conduce de la siguiente manera: ${voiceLeadingText}.`,
      preview: `${lydianChord.root} ➔ ${lydianChord.root}(#11)`,
      payload: [
        { measureIndex: lydianChord.globalMeasureIndex, beatIndex: lydianChord.beatIndex, chord: { root: lydianChord.root, type: lydianChord.type, tensions: [...lydianChord.tensions, '#11'], bass: lydianChord.bass } }
      ]
    })
  }

  // Regla 12: Menor (ii o vi) a 13 (Dórico)
  const dorianChordIdx = activeChords.findIndex(c => ['ii', 'vi'].includes(normDegree(c.degree)) && (c.type === 'min' || c.type === 'm7' || c.type === 'minor'))
  if (dorianChordIdx !== -1) {
    const dorianChord = activeChords[dorianChordIdx]
    const thirteenNote = transposeNote(dorianChord.root, 9, dorianChord.activeKey)
    const nextChord = activeChords[(dorianChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(thirteenNote, nextChord, dorianChord.activeKey)

    candidates.push({
      id: `rule_12_${systemIndex}`,
      category: 'color',
      title: 'Añadir color Dórico (13)',
      text: `Para darle un carácter de jazz clásico y un tinte más fresco al acorde menor de ${dorianChord.root}m, una opción excelente es agregar la tensión 13. Al resolver al siguiente acorde (${nextChord.root}), la nota 13 (${thirteenNote}) se conecta así: ${voiceLeadingText}.`,
      preview: `${dorianChord.root}m ➔ ${dorianChord.root}m7(13)`,
      payload: [
        { measureIndex: dorianChord.globalMeasureIndex, beatIndex: dorianChord.beatIndex, chord: { root: dorianChord.root, type: dorianChord.type, tensions: [...dorianChord.tensions, '13'], bass: dorianChord.bass } }
      ]
    })
  }

  // Regla 13: IV menor resolviendo a la tónica I (Intercambio modal)
  const ivChordIdx = activeChords.findIndex((c, idx) => idx < 3 && normDegree(c.degree) === 'IV' && normDegree(activeChords[idx+1].degree) === 'I')
  if (ivChordIdx !== -1) {
    const ivChord = activeChords[ivChordIdx]
    const nextChord = activeChords[ivChordIdx + 1]
    const minorSixthNote = transposeNote(ivChord.activeKey, 8, ivChord.activeKey)

    candidates.push({
      id: `rule_13_${systemIndex}`,
      category: 'color',
      title: `Intercambio modal (${ivChord.root}m ➔ ${nextChord.root})`,
      text: `Convertir el acorde subdominante IV (${ivChord.root}) en menor (${ivChord.root}m) es uno de los recursos de color más hermosos en el pop. Introduce la nota ${minorSixthNote} (sexta menor de la escala), la cual conduce con una suave melancolía por semitono descendente hacia la quinta del acorde de tónica ${nextChord.root} (${transposeNote(nextChord.root, 7, ivChord.activeKey)}). Al mismo tiempo, la fundamental de ${ivChord.root}m (${ivChord.root}) desciende por semitono hacia la tercera de ${nextChord.root} (${getThirdOfRoot(nextChord.root, nextChord.type, ivChord.activeKey)}), logrando una doble resolución por semitono de enorme belleza.`,
      preview: `${ivChord.root} ➔ ${ivChord.root}m ➔ ${nextChord.root}`,
      payload: [
        { measureIndex: ivChord.globalMeasureIndex, beatIndex: ivChord.beatIndex, chord: { root: ivChord.root, type: 'min', tensions: ivChord.tensions, bass: ivChord.bass } }
      ]
    })
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
      ]
    })
  }

  // Regla 15: Cambio modal en repetición (bVI / bVII)
  const ivOrVChordIdx = activeChords.findIndex(c => ['IV', 'V'].includes(normDegree(c.degree)) && c.globalMeasureIndex > 1)
  if (ivOrVChordIdx !== -1) {
    const ivOrVChord = activeChords[ivOrVChordIdx]
    const modalRoot = transposeNote(ivOrVChord.activeKey, 8, ivOrVChord.activeKey) // bVI
    const nextChord = activeChords[(ivOrVChordIdx + 1) % 4]
    const voiceLeadingText = explainNoteResolution(modalRoot, nextChord, ivOrVChord.activeKey)

    candidates.push({
      id: `rule_15_${systemIndex}`,
      category: 'color',
      title: 'Préstamo modal bVI',
      text: `En la segunda mitad de la sección, sustituir el acorde de ${ivOrVChord.root} por el acorde prestado ${modalRoot}maj7 (bVI) aporta un color de intercambio modal de ensueño. Al enlazar con el siguiente acorde (${nextChord.root}), la fundamental del acorde prestado (${modalRoot}) se conduce de la siguiente manera: ${voiceLeadingText}.`,
      preview: `${ivOrVChord.root} ➔ ${modalRoot}maj7`,
      payload: [
        { measureIndex: ivOrVChord.globalMeasureIndex, beatIndex: ivOrVChord.beatIndex, chord: { root: modalRoot, type: 'maj7', tensions: [], bass: null } }
      ]
    })
  }


  // ==================== 🔴 VOICE LEADING / FLUIDEZ (voice_leading) ====================

  // Regla 16: Bajo descendente (slash chords)
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    const deg1 = normDegree(c1.degree)
    const deg2 = normDegree(c2.degree)
    if (deg1 === 'I' && deg2 === 'V') {
      const thirdNote = getThirdOfRoot(c2.root, c2.type, c2.activeKey)
      candidates.push({
        id: `rule_16_${systemIndex}`,
        category: 'voice_leading',
        title: 'Crear bajo descendente fluido (I ➔ V/3)',
        text: `En el paso de ${c1.root} a ${c2.root}, usar la primera inversión ${c2.root}/${thirdNote} (con la tercera en el bajo) suaviza el salto. El bajo se desplaza suavemente de la tónica ${c1.root} a la tercera de V (${thirdNote}) por semitono/paso conjunto descendente, evitando el salto abrupto de quinta y logrando una conducción elegante.`,
        preview: `${c1.root} ➔ ${c2.root}/${thirdNote}`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: c2.root, type: c2.type, tensions: c2.tensions, bass: thirdNote } }
        ]
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
          ]
        })
        break
      }
    }
  }

  // Regla 18: Línea de bajo conectada (I ➔ VII ➔ vi)
  if (activeChords.length >= 3) {
    const c1 = activeChords[0]
    const c2 = activeChords[1]
    const c3 = activeChords[2]
    if (normDegree(c1.degree) === 'I' && normDegree(c2.degree) === 'V' && normDegree(c3.degree) === 'vi') {
      const thirdNote = getThirdOfRoot(c2.root, c2.type, c2.activeKey)
      candidates.push({
        id: `rule_18_${systemIndex}`,
        category: 'voice_leading',
        title: 'Bajo descendente melódico conectado (I ➔ VII ➔ vi)',
        text: `Para guiar el oído melódicamente, puedes conectar la progresión I (${c1.root}) ➔ V (${c2.root}) ➔ vi (${c3.root}m) usando la inversión ${c2.root}/${thirdNote} en el acorde de dominante. El bajo realiza un descenso melódico paso a paso en la escala (${c1.root} ➔ ${thirdNote} ➔ ${c3.root}) en lugar de dar un gran salto interválico, guiando al oído con suavidad hacia la resolución menor.`,
        preview: `${c1.root} ➔ ${c2.root}/${thirdNote} ➔ ${c3.root}m`,
        payload: [
          { measureIndex: c2.globalMeasureIndex, beatIndex: c2.beatIndex, chord: { root: c2.root, type: c2.type, tensions: c2.tensions, bass: thirdNote } }
        ]
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
      ]
    })
  }

  // Regla 20: Resolución fuerte (V ➔ I) con tensión previa (sus4 o b9)
  for (let i = 0; i < 3; i++) {
    const c1 = activeChords[i]
    const c2 = activeChords[i+1]
    if (normDegree(c1.degree) === 'V' && normDegree(c2.degree) === 'I') {
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
        ]
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
          ]
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
        ]
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
      ]
    })
  }

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
