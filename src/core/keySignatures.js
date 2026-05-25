// src/core/keySignatures.js
import { NOTE_TO_INDEX, getNoteName, CHROMATIC_NOTES_SHARP, CHROMATIC_NOTES_FLAT } from './notes.js'

export const KEY_SIGNATURES = {
  major: {
    'C': { type: 'sharp', count: 0 },
    'G': { type: 'sharp', count: 1 },
    'D': { type: 'sharp', count: 2 },
    'A': { type: 'sharp', count: 3 },
    'E': { type: 'sharp', count: 4 },
    'B': { type: 'sharp', count: 5 },
    'F#': { type: 'sharp', count: 6 },
    'C#': { type: 'sharp', count: 7 },
    'G#': { type: 'sharp', count: 8 },
    'D#': { type: 'sharp', count: 9 },
    'A#': { type: 'sharp', count: 10 },
    'F': { type: 'flat', count: 1 },
    'Bb': { type: 'flat', count: 2 },
    'Eb': { type: 'flat', count: 3 },
    'Ab': { type: 'flat', count: 4 },
    'Db': { type: 'flat', count: 5 },
    'Gb': { type: 'flat', count: 6 },
    'Cb': { type: 'flat', count: 7 }
  },
  minor: {
    'A': { type: 'sharp', count: 0 },
    'E': { type: 'sharp', count: 1 },
    'B': { type: 'sharp', count: 2 },
    'F#': { type: 'sharp', count: 3 },
    'C#': { type: 'sharp', count: 4 },
    'G#': { type: 'sharp', count: 5 },
    'D#': { type: 'sharp', count: 6 },
    'A#': { type: 'sharp', count: 7 },
    'D': { type: 'flat', count: 1 },
    'G': { type: 'flat', count: 2 },
    'C': { type: 'flat', count: 3 },
    'F': { type: 'flat', count: 4 },
    'Bb': { type: 'flat', count: 5 },
    'Eb': { type: 'flat', count: 6 },
    'Ab': { type: 'flat', count: 7 },
    'Db': { type: 'flat', count: 8 },
    'Gb': { type: 'flat', count: 9 }
  }
}

// Mapeo de cada una de las 27 escalas a su escala madre y offset en semitonos
export const SCALE_PARENTS = {
  // Mayor / Menor
  major: { parentType: 'major', offset: 0 },
  minor: { parentType: 'minor', offset: 0 },
  
  // Modos Griegos (Derivan de la escala Mayor)
  dorian: { parentType: 'major', offset: 2 },
  phrygian: { parentType: 'major', offset: 4 },
  lydian: { parentType: 'major', offset: 5 },
  mixolydian: { parentType: 'major', offset: 7 },
  locrian: { parentType: 'major', offset: 11 },
  
  // Menores Avanzadas y modos de Menor Armónica (Mapean a la menor natural/armónica del mismo centro de tono o relativas)
  harmonic_minor: { parentType: 'minor', offset: 0 },
  locrian_sharp6: { parentType: 'minor', offset: 2 },
  ionian_sharp5: { parentType: 'minor', offset: 3 },
  dorian_sharp4: { parentType: 'minor', offset: 5 },
  phrygian_dominant: { parentType: 'minor', offset: 7 },
  lydian_sharp2: { parentType: 'minor', offset: 8 },
  ultralocrian: { parentType: 'minor', offset: 11 },
  
  // Modos de Menor Melódica
  melodic_minor: { parentType: 'minor', offset: 0 },
  dorian_flat2: { parentType: 'minor', offset: 2 },
  lydian_augmented: { parentType: 'minor', offset: 3 },
  lydian_dominant: { parentType: 'minor', offset: 5 },
  mixolydian_flat6: { parentType: 'minor', offset: 7 },
  locrian_sharp2: { parentType: 'minor', offset: 9 },
  altered: { parentType: 'minor', offset: 11 },
  
  // Simétricas y Populares (sin armadura de clave formal, tratadas como limpia o heredando de su raíz)
  diminished_wh: { parentType: 'none', offset: 0 },
  diminished_hw: { parentType: 'none', offset: 0 },
  whole_tone: { parentType: 'none', offset: 0 },
  pentatonic_major: { parentType: 'major', offset: 0 },
  pentatonic_minor: { parentType: 'minor', offset: 0 },
  blues: { parentType: 'minor', offset: 0 },
  harmonic_major: { parentType: 'major', offset: 0 },
  hungarian_gypsy_minor: { parentType: 'minor', offset: 0 },
  hungarian_major: { parentType: 'none', offset: 0 },
  bebop_dominant: { parentType: 'major', offset: 7 }
}

/**
 * Resuelve la tónica de la escala madre basándose en el offset de semitonos.
 * @param {string} keyRoot - Tónica actual (ej. 'D')
 * @param {string} scaleType - Identificador de la escala (ej. 'dorian')
 */
export function getParentKeyRoot(keyRoot, scaleType) {
  const mapping = SCALE_PARENTS[scaleType]
  if (!mapping || mapping.parentType === 'none') return keyRoot
  
  const rootIndex = NOTE_TO_INDEX[keyRoot]
  if (rootIndex === undefined) return keyRoot
  
  // Restamos el offset para volver a la escala madre
  const parentIndex = ((rootIndex - mapping.offset) % 12 + 12) % 12
  
  const sharpName = CHROMATIC_NOTES_SHARP[parentIndex]
  const flatName = CHROMATIC_NOTES_FLAT[parentIndex]
  
  if (sharpName === flatName) return sharpName
  
  // Si la tónica actual es sostenida, preferimos sostenido para la escala madre
  if (keyRoot.includes('#')) {
    return sharpName
  }
  // En cualquier otro caso (tónica natural o bemol), preferimos bemol
  return flatName
}

/**
 * Retorna la armadura de clave (sostenidos/bemoles y cantidad) de una escala.
 * @param {string} key - Tónica
 * @param {string} scaleType - Identificador de la escala
 */
export function getKeySignature(key, scaleType) {
  const parentMapping = SCALE_PARENTS[scaleType]
  if (!parentMapping || parentMapping.parentType === 'none') {
    return { type: 'sharp', count: 0 }
  }
  
  const parentRoot = getParentKeyRoot(key, scaleType)
  const mapping = KEY_SIGNATURES[parentMapping.parentType]
  if (!mapping) return { type: 'sharp', count: 0 }
  
  return mapping[parentRoot] || { type: 'sharp', count: 0 }
}

/**
 * Retorna la armadura de clave formateada en texto plano (ej. "##" o "bbb").
 * @param {string} key - Tónica
 * @param {string} scaleType - Identificador de la escala
 */
export function getKeySignatureString(key, scaleType) {
  const sig = getKeySignature(key, scaleType)
  if (sig.count === 0) return ''
  const symbol = sig.type === 'sharp' ? '#' : 'b'
  return symbol.repeat(sig.count)
}
