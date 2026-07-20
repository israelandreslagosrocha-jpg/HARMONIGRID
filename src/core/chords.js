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
  { id: 'mM7', label: 'Menor Maj 7', suffix: 'mM7' },
  { id: 'maj7#5', label: 'Maj 7 (#5)', suffix: 'maj7(#5)' },
  { id: '7#5', label: '7 (#5)', suffix: '7(#5)' }
]

export const TENSIONS = [
  'b9', '9', '#9',
  '11', '#11',
  'b13', '13',
  'add9', 'b5', '#5'
]

/**
 * Formatea un acorde para visualización
 * @param {Object} chordObj - { root: 'C', type: 'maj7', tension: '9', tensions: ['9', '#11'], bass: 'E' }
 */
export function formatChord(chordObj) {
  if (!chordObj || !chordObj.root) return ''
  
  let result = chordObj.root
  
  if (chordObj.type) {
    const typeDef = CHORD_TYPES.find(t => t.id === chordObj.type || t.suffix === chordObj.type)
    result += typeDef ? typeDef.suffix : chordObj.type
  }
  
  // Soporte para múltiples tensiones (sin duplicados)
  if (chordObj.tensions && chordObj.tensions.length > 0) {
    const uniqueTensions = Array.from(new Set(chordObj.tensions))
    result += `(${uniqueTensions.join(', ')})`
  } else if (chordObj.tension) {
    // Fallback para tensión única tradicional
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

/**
 * Convierte un acorde (root, type, tensions, bass) a notación en Grados Romanos universal para cualquier escala.
 */
export function getRomanNumeralForChord(chordObj, activeKey = 'C', activeScale = 'major') {
  if (!chordObj || !chordObj.root) return ''
  const keyIdx = NOTE_TO_INDEX[activeKey]
  const chordRootIdx = NOTE_TO_INDEX[chordObj.root]
  if (keyIdx === undefined || chordRootIdx === undefined) return chordObj.root

  const semitones = (chordRootIdx - keyIdx + 12) % 12

  const ROMAN_SEMITONE_MAP = {
    0: { upper: 'I', lower: 'i' },
    1: { upper: '♭II', lower: '♭ii' },
    2: { upper: 'II', lower: 'ii' },
    3: { upper: '♭III', lower: '♭iii' },
    4: { upper: 'III', lower: 'iii' },
    5: { upper: 'IV', lower: 'iv' },
    6: { upper: '♭V', lower: '♭v' },
    7: { upper: 'V', lower: 'v' },
    8: { upper: '♭VI', lower: '♭vi' },
    9: { upper: 'VI', lower: 'vi' },
    10: { upper: '♭VII', lower: '♭vii' },
    11: { upper: 'VII', lower: 'vii' }
  }

  const isMinorType = ['min', 'minor', 'm', 'm7', 'dim', 'dim7', 'm7b5', 'mM7'].includes(chordObj.type)
  const mapEntry = ROMAN_SEMITONE_MAP[semitones] || { upper: 'I', lower: 'i' }
  let romanBase = isMinorType ? mapEntry.lower : mapEntry.upper

  let typeSuffix = ''
  if (chordObj.type) {
    if (['maj7'].includes(chordObj.type)) typeSuffix = 'maj7'
    else if (['m7'].includes(chordObj.type)) typeSuffix = '7'
    else if (['7'].includes(chordObj.type)) typeSuffix = '7'
    else if (['m7b5'].includes(chordObj.type)) typeSuffix = 'm7b5'
    else if (['dim'].includes(chordObj.type)) typeSuffix = 'dim'
    else if (['dim7'].includes(chordObj.type)) typeSuffix = 'dim7'
    else if (['aug', 'maj7#5', '7#5'].includes(chordObj.type)) typeSuffix = '+'
    else if (['sus4'].includes(chordObj.type)) typeSuffix = 'sus4'
    else if (['sus2'].includes(chordObj.type)) typeSuffix = 'sus2'
    else if (['mM7'].includes(chordObj.type)) typeSuffix = 'mM7'
  }

  let result = `${romanBase}${typeSuffix}`

  if (chordObj.tensions && chordObj.tensions.length > 0) {
    const uniqueTensions = Array.from(new Set(chordObj.tensions))
    result += `(${uniqueTensions.join(', ')})`
  } else if (chordObj.tension) {
    if (['b9', '#9', '#11', 'b13', 'b5', '#5'].includes(chordObj.tension)) {
      result += `(${chordObj.tension})`
    } else {
      result += chordObj.tension
    }
  }

  if (chordObj.bass) {
    const bassIdx = NOTE_TO_INDEX[chordObj.bass]
    if (bassIdx !== undefined) {
      const chordInterval = (bassIdx - chordRootIdx + 12) % 12
      if (chordInterval === 3 || chordInterval === 4) result += `/3`
      else if (chordInterval === 7) result += `/5`
      else if (chordInterval === 10 || chordInterval === 11) result += `/7`
      else {
        const bassSemitones = (bassIdx - keyIdx + 12) % 12
        const bassMap = ROMAN_SEMITONE_MAP[bassSemitones]
        if (bassMap) result += `/${bassMap.upper}`
      }
    }
  }

  return result
}
