// src/core/notes.js

// Usaremos un sistema numérico de 12 tonos (0-11) donde 0 = C
export const CHROMATIC_NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const CHROMATIC_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export const NOTE_TO_INDEX = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
  'A#': 10, 'Bb': 10, 'B': 11
}

// Para decidir si usar bemoles o sostenidos según la tónica
export const KEYS_WITH_SHARPS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
export const KEYS_WITH_FLATS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']

export function getNoteName(index, keyRoot = 'C') {
  // Aseguramos que el índice esté entre 0 y 11
  const normalizedIndex = ((index % 12) + 12) % 12
  
  if (KEYS_WITH_FLATS.includes(keyRoot)) {
    return CHROMATIC_NOTES_FLAT[normalizedIndex]
  }
  return CHROMATIC_NOTES_SHARP[normalizedIndex]
}

export function transposeNote(noteName, semitones, targetKeyRoot = 'C') {
  if (!noteName) return null
  const currentIndex = NOTE_TO_INDEX[noteName]
  if (currentIndex === undefined) return noteName
  
  return getNoteName(currentIndex + semitones, targetKeyRoot)
}
