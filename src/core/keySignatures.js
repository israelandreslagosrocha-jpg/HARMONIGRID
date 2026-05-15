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
    'Ab': { type: 'flat', count: 7 }
  }
}

export function getKeySignature(key, scaleType) {
  const mapping = KEY_SIGNATURES[scaleType]
  if (!mapping) return { type: 'sharp', count: 0 }
  return mapping[key] || { type: 'sharp', count: 0 }
}

export function getKeySignatureString(key, scaleType) {
  const sig = getKeySignature(key, scaleType)
  if (sig.count === 0) return ''
  const symbol = sig.type === 'sharp' ? '#' : 'b'
  return symbol.repeat(sig.count)
}
