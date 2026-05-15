// src/core/chords.js

export const CHORD_TYPES = [
  // Triadas
  { id: 'maj', label: 'Mayor', suffix: '' },
  { id: 'min', label: 'Menor', suffix: 'm' },
  { id: 'dim', label: 'Disminuido', suffix: 'dim' },
  { id: 'aug', label: 'Aumentado', suffix: 'aug' },
  { id: 'sus4', label: 'Sus 4', suffix: 'sus4' },
  { id: 'sus2', label: 'Sus 2', suffix: 'sus2' },
  
  // Tetradas
  { id: 'maj7', label: 'Maj 7', suffix: 'maj7' },
  { id: 'm7', label: 'Menor 7', suffix: 'm7' },
  { id: '7', label: 'Dominante 7', suffix: '7' },
  { id: 'm7b5', label: 'Semi-disminuido', suffix: 'm7b5' },
  { id: 'dim7', label: 'Disminuido 7', suffix: 'dim7' },
  { id: 'mM7', label: 'Menor Maj 7', suffix: 'mM7' }
]

export const TENSIONS = [
  'b9', '9', '#9',
  '11', '#11',
  'b13', '13',
  'add9', 'b5', '#5'
]

/**
 * Formatea un acorde para visualización
 * @param {Object} chordObj - { root: 'C', type: 'maj7', tension: '9', bass: 'E' }
 */
export function formatChord(chordObj) {
  if (!chordObj || !chordObj.root) return ''
  
  let result = chordObj.root
  
  if (chordObj.type) {
    const typeDef = CHORD_TYPES.find(t => t.id === chordObj.type || t.suffix === chordObj.type)
    result += typeDef ? typeDef.suffix : chordObj.type
  }
  
  if (chordObj.tension) {
    // Si la tensión es una alteración, la encerramos en paréntesis o la añadimos tal cual, 
    // dependerá del estilo preferido. Ej: G7(b9) o G7b9
    if (['b9', '#9', '#11', 'b13', 'b5', '#5'].includes(chordObj.tension)) {
      result += `(${chordObj.tension})`
    } else {
      result += chordObj.tension
    }
  }
  
  if (chordObj.bass) {
    result += `/${chordObj.bass}`
  }
  
  return result
}
