import { NOTE_TO_INDEX, transposeNote } from './notes.js'
import { SCALES, getScaleNotes } from './scales.js'
import { getChordDegree } from './suggestions.js'

/**
 * Determina el rol funcional (Tónica, Subdominante, Dominante) de un grado romano
 */
export function getFunctionalRole(degree) {
  if (!degree) return 'T'
  const norm = degree.replace('7', '').replace('maj', '').replace('min', '').replace('°', '').replace('+', '').toLowerCase()
  
  if (['i', 'vi', 'iii', '♭iii', '♭vi', 'i°', 'i+', 'iii°', 'vi°'].includes(norm)) return 'T'
  if (['iv', 'ii', '♭ii', '♯ii', '#ii', '♯iv', '#iv', '♭v', 'ii°', 'iv°'].includes(norm)) return 'S'
  if (['v', 'vii', '♭vii', 'vii°', 'v°', 'v+'].includes(norm)) return 'D'
  
  return 'T'
}

/**
 * Retorna la representación diatónica insignia de un rol funcional en una escala
 */
export function getTargetDegreeForRole(role, scaleType) {
  const targetMap = {
    major: { T: 'I', S: 'IV', D: 'V' },
    minor: { T: 'i', S: 'iv', D: '♭VII' },
    harmonic_minor: { T: 'i', S: 'iv', D: 'V' },
    melodic_minor: { T: 'i', S: 'IV', D: 'V' },
    dorian: { T: 'i', S: 'IV', D: '♭VII' },
    phrygian: { T: 'i', S: '♭II', D: '♭VII' },
    lydian: { T: 'I', S: 'II', D: 'V' },
    mixolydian: { T: 'I', S: 'IV', D: '♭VII' },
    locrian: { T: 'i°', S: 'iv', D: '♭II' },
    altered: { T: 'i', S: 'VI', D: 'V' },
    whole_tone: { T: 'I+', S: 'II+', D: 'V+' },
    diminished_wh: { T: 'i°', S: '♭iii°', D: 'v°' },
    diminished_hw: { T: 'I', S: '♭II', D: 'V' },
    pentatonic_major: { T: 'I', S: 'vi', D: 'V' },
    pentatonic_minor: { T: 'i', S: 'iv', D: '♭VII' },
    blues: { T: 'i', S: 'IV', D: 'v' },
    bebop_dominant: { T: 'I', S: 'IV', D: 'V' },
    hungarian_major: { T: 'I', S: '♯II°', D: 'V' },
    hungarian_gypsy_minor: { T: 'i', S: 'ii°', D: 'V' }
  }
  const map = targetMap[scaleType] || { T: 'I', S: 'IV', D: 'V' }
  return map[role] || map['T']
}

/**
 * Calcula el acorde transpuerto dada la lógica tonal, modal o funcional
 */
export function getTransposedChord(root, type, sourceKey, sourceScale, targetKey, targetScale, mode, mainSourceKey) {
  if (!root) return { root: '', type: '' }

  // Modo Tonal: Traslación cromática pura basada en el intervalo principal
  if (mode === 'tonal') {
    const sourceIdx = NOTE_TO_INDEX[mainSourceKey]
    const targetIdx = NOTE_TO_INDEX[targetKey]
    if (sourceIdx === undefined || targetIdx === undefined) return { root, type }
    const diff = (targetIdx - sourceIdx + 12) % 12
    const transposedRoot = transposeNote(root, diff, targetKey)
    return { root: transposedRoot, type: type }
  }

  // Modos Modales y Funcionales:
  // 1. Obtener el grado en la escala original
  const degree = getChordDegree(root, type, sourceKey, sourceScale)
  if (!degree) return { root, type }

  const scaleNotes = getScaleNotes(sourceKey, sourceScale)
  const scaleIndex = scaleNotes.indexOf(root)

  // Determinar la clave local de destino (manteniendo relaciones si hay modulaciones locales)
  const sourceMainIdx = NOTE_TO_INDEX[mainSourceKey]
  const targetMainIdx = NOTE_TO_INDEX[targetKey]
  const mainDiff = (targetMainIdx - sourceMainIdx + 12) % 12
  const targetLocalKey = transposeNote(sourceKey, mainDiff, targetKey)
  const targetLocalScale = targetScale

  const targetScaleNotes = getScaleNotes(targetLocalKey, targetLocalScale)

  // Si el acorde es diatónico (está dentro de la escala original)
  if (scaleIndex !== -1 && scaleIndex < targetScaleNotes.length) {
    if (mode === 'modal') {
      const targetRoot = targetScaleNotes[scaleIndex]
      const scaleDef = SCALES[targetLocalScale]
      let targetType = type

      if (scaleDef && scaleDef.degrees && scaleDef.degrees[scaleIndex]) {
        const isTetrad = ['maj7', 'm7', '7', 'm7b5', 'dim7', 'mM7', '6', 'min7'].some(t => type.includes(t))
        targetType = isTetrad ? scaleDef.degrees[scaleIndex].tetrad : scaleDef.degrees[scaleIndex].triad
        
        // Mantener extensiones o tipos suspendidos si existían
        if (type.includes('sus4')) targetType = '7sus4'
        if (type.includes('add9')) targetType = targetType + '(add9)'
      }
      return { root: targetRoot, type: targetType }
    } else if (mode === 'functional') {
      const role = getFunctionalRole(degree)
      const targetDegree = getTargetDegreeForRole(role, targetLocalScale)

      const scaleDef = SCALES[targetLocalScale]
      let targetIndex = 0
      if (scaleDef && scaleDef.degrees) {
        const matchIdx = scaleDef.degrees.findIndex(d => 
          d.numeral.replace('7','').replace('maj','').replace('min','').replace('°','').replace('+','').toLowerCase() === targetDegree.toLowerCase()
        )
        if (matchIdx !== -1) targetIndex = matchIdx
      }

      const targetRoot = targetScaleNotes[targetIndex]
      let targetType = type
      if (scaleDef && scaleDef.degrees && scaleDef.degrees[targetIndex]) {
        const isTetrad = ['maj7', 'm7', '7', 'm7b5', 'dim7', 'mM7', '6', 'min7'].some(t => type.includes(t))
        targetType = isTetrad ? scaleDef.degrees[targetIndex].tetrad : scaleDef.degrees[targetIndex].triad
      }
      return { root: targetRoot, type: targetType }
    }
  }

  // Acordes Cromáticos: Traslación cromática pura basada en el intervalo principal
  const transposedRoot = transposeNote(root, mainDiff, targetLocalKey)
  return { root: transposedRoot, type: type }
}
