// src/core/scales.js
import { getNoteName, NOTE_TO_INDEX } from './notes.js'

// Intervalos en semitonos desde la tónica
export const SCALES = {
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    // Grados diatónicos
    degrees: [
      { numeral: 'I', tetrad: 'maj7', triad: 'maj' },
      { numeral: 'ii', tetrad: 'm7', triad: 'min' },
      { numeral: 'iii', tetrad: 'm7', triad: 'min' },
      { numeral: 'IV', tetrad: 'maj7', triad: 'maj' },
      { numeral: 'V', tetrad: '7', triad: 'maj' },
      { numeral: 'vi', tetrad: 'm7', triad: 'min' },
      { numeral: 'vii°', tetrad: 'm7b5', triad: 'dim' }
    ]
  },
  minor: {
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: [
      { numeral: 'i', tetrad: 'm7', triad: 'min' },
      { numeral: 'ii°', tetrad: 'm7b5', triad: 'dim' },
      { numeral: 'III', tetrad: 'maj7', triad: 'maj' },
      { numeral: 'iv', tetrad: 'm7', triad: 'min' },
      { numeral: 'v', tetrad: 'm7', triad: 'min' }, 
      { numeral: 'VI', tetrad: 'maj7', triad: 'maj' },
      { numeral: 'VII', tetrad: '7', triad: 'maj' }
    ]
  }
}

/**
 * Retorna los acordes diatónicos de una tonalidad y escala específica.
 * @param {string} keyRoot - Tónica (Ej: 'C', 'F#')
 * @param {string} scaleType - 'major' o 'minor'
 * @param {string} complexity - 'triad' o 'tetrad'
 */
export function getDiatonicChords(keyRoot, scaleType = 'major', complexity = 'tetrad') {
  const scale = SCALES[scaleType]
  if (!scale) return []

  const rootIndex = NOTE_TO_INDEX[keyRoot]
  
  return scale.intervals.map((interval, i) => {
    const noteIndex = rootIndex + interval
    const rootName = getNoteName(noteIndex, keyRoot)
    const degree = scale.degrees[i]
    
    const type = degree[complexity] // ej. 'maj7' o 'maj'
    
    // Simplificamos visualmente el triad mayor para que solo muestre la raíz (ej. "C" en vez de "Cmaj")
    let labelType = type
    if (type === 'maj') labelType = ''
    else if (type === 'min') labelType = 'm'
    
    return {
      degreeNumeral: degree.numeral,
      root: rootName,
      type: type,
      label: `${rootName}${labelType}`
    }
  })
}
