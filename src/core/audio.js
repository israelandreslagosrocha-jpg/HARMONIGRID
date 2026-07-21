// src/core/audio.js
import { NOTE_TO_INDEX } from './notes.js'

export const CHORD_TYPE_INTERVALS = {
  'maj': [0, 4, 7],
  '': [0, 4, 7],
  'min': [0, 3, 7],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'm7b5': [0, 3, 6, 10],
  'dim7': [0, 3, 6, 9],
  'mM7': [0, 3, 7, 11],
  'maj7#5': [0, 4, 8, 11],
  'maj7(#5)': [0, 4, 8, 11],
  '7#5': [0, 4, 8, 10],
  '7(#5)': [0, 4, 8, 10],
  '6': [0, 4, 7, 9],
  'm6': [0, 3, 7, 9],
  '69': [0, 4, 7, 9, 14],
  'm69': [0, 3, 7, 9, 14]
}

export const TENSION_INTERVALS = {
  'b9': [13],
  '9': [14],
  '#9': [15],
  '11': [17],
  '#11': [18],
  'b13': [20],
  '13': [21],
  'add9': [14],
  'b5': [6],
  '#5': [8],
  '6': [9],
  '6/9': [9, 14]
}

/**
 * Transforma una lista de intervalos según el estilo de voicing deseado
 */
export function getVoicedIntervals(intervals, style) {
  if (intervals.length < 3) return [...intervals]

  const sorted = [...intervals].sort((a, b) => a - b)
  
  switch (style) {
    case 'inversion1':
      return [...sorted.slice(1), sorted[0] + 12]
    case 'inversion2':
      return [...sorted.slice(2), sorted[0] + 12, sorted[1] + 12]
    case 'inversion3':
      if (sorted.length >= 4) {
        return [...sorted.slice(3), sorted[0] + 12, sorted[1] + 12, sorted[2] + 12]
      }
      return [...sorted.slice(2), sorted[0] + 12, sorted[1] + 12]
    case 'drop2':
      if (sorted.length >= 4) {
        // Drop the second voice from the top (index len - 2) by an octave
        const secondHighestIdx = sorted.length - 2
        const dropped = sorted[secondHighestIdx] - 12
        const others = sorted.filter((_, idx) => idx !== secondHighestIdx)
        let res = [dropped, ...others].sort((a, b) => a - b)
        // Keep notes in positive range
        const minVal = Math.min(...res)
        if (minVal < 0) {
          res = res.map(n => n + 12)
        }
        return res
      }
      return sorted
    case 'fundamental':
    default:
      return sorted
  }
}

/**
 * Retorna los números de notas MIDI de un acorde en su estado fundamental o voicing
 */
export function getRootPositionMidi(chordObj, triadVoicingStyle = 'fundamental', tetradVoicingStyle = 'fundamental') {
  if (!chordObj || !chordObj.root) return []
  const rootIndex = NOTE_TO_INDEX[chordObj.root]
  if (rootIndex === undefined) return []

  const rootMidi = 60 + rootIndex // C4 como base (una octava más arriba por defecto)

  // Obtener intervalos base
  const intervals = CHORD_TYPE_INTERVALS[chordObj.type] || [0, 4, 7]
  let allIntervals = [...intervals]

  // Agregar tensiones
  if (chordObj.tensions && chordObj.tensions.length > 0) {
    chordObj.tensions.forEach(t => {
      const tInt = TENSION_INTERVALS[t]
      if (tInt) allIntervals.push(...tInt)
    })
  } else if (chordObj.tension) {
    const tInt = TENSION_INTERVALS[chordObj.tension]
    if (tInt) allIntervals.push(...tInt)
  }

  // Si tiene 'omit3', remover intervalos de 3ra (3 y 4 semitonos)
  const isOmit3 = (chordObj.tensions && chordObj.tensions.includes('omit3')) || chordObj.tension === 'omit3'
  if (isOmit3) {
    allIntervals = allIntervals.filter(i => i !== 3 && i !== 4)
  }

  allIntervals = [...new Set(allIntervals)].sort((a, b) => a - b)

  // Aplicar estilo de voicing según la cantidad de notas
  const voicingStyle = allIntervals.length >= 4 ? tetradVoicingStyle : triadVoicingStyle
  const voicedIntervals = getVoicedIntervals(allIntervals, voicingStyle)

  let chordMidiNotes = []
  if (chordObj.bass) {
    const bassIndex = NOTE_TO_INDEX[chordObj.bass]
    if (bassIndex !== undefined) {
      // El bajo es la nota más baja en la Octava 2
      const bassMidi = 36 + bassIndex
      chordMidiNotes.push(bassMidi)

      // El resto del acorde se coloca de forma ascendente sobre el bajo,
      // desplazado una octava más arriba para dar espacio al bajo.
      const chordPitchClasses = voicedIntervals.map(inv => (rootIndex + inv) % 12)
      const remainingPitchClasses = chordPitchClasses.filter(pc => pc !== bassIndex)

      let lastMidi = bassMidi + 17 // Salto de octava + cuarta/quinta arriba para evitar choque acústico y hacer notorio el bajo
      remainingPitchClasses.forEach(pc => {
        let noteMidi = pc + 12 * Math.ceil((lastMidi - pc) / 12)
        if (noteMidi <= bassMidi) {
          noteMidi += 12
        }
        chordMidiNotes.push(noteMidi)
        lastMidi = noteMidi
      })
    }
  } else {
    // Si no hay bajo modificado, simplemente sumamos el rootMidi
    chordMidiNotes = voicedIntervals.map(inv => rootMidi + inv)
  }

  return chordMidiNotes
}

/**
 * Modifica las notas MIDI del acorde destino para que tengan continuidad armónica (voice leading)
 * con respecto al acorde anterior.
 */
export function getVoiceLedMidi(chordObj, prevMidiNotes, triadVoicingStyle = 'fundamental', tetradVoicingStyle = 'fundamental') {
  const currentFund = getRootPositionMidi(chordObj, triadVoicingStyle, tetradVoicingStyle)
  if (!prevMidiNotes || prevMidiNotes.length === 0 || currentFund.length === 0) {
    return currentFund
  }

  // Si tiene un bajo modificado explícito, conservamos el bajo en su octava baja
  // y aplicamos voice leading en las voces superiores.
  if (chordObj.bass) {
    const bassMidi = currentFund[0]
    const upperFund = currentFund.slice(1)
    const upperPrev = prevMidiNotes.slice(1)

    if (upperPrev.length === 0) return currentFund

    const upperVoiced = upperFund.map((n, idx) => {
      const p = upperPrev[Math.min(idx, upperPrev.length - 1)]
      const k = Math.round((p - n) / 12)
      return n + 12 * k
    })

    return [bassMidi, ...upperVoiced]
  } else {
    // Voice leading general para todas las notas
    return currentFund.map((n, idx) => {
      const p = prevMidiNotes[Math.min(idx, prevMidiNotes.length - 1)]
      const k = Math.round((p - n) / 12)
      return n + 12 * k
    })
  }
}

/**
 * Reproduce los clics del metrónomo
 */
export function playClick(audioCtx, time, soundType, isAccent) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)

  const vol = isAccent ? 0.35 : 0.18

  if (soundType === 'beep') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time)
    gain.gain.setValueAtTime(vol, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.08 : 0.05))
    osc.start(time)
    osc.stop(time + (isAccent ? 0.09 : 0.06))
  } else if (soundType === 'woodblock') {
    osc.type = 'triangle'
    const startFreq = isAccent ? 1600 : 1200
    const endFreq = isAccent ? 1200 : 900
    osc.frequency.setValueAtTime(startFreq, time)
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.04)
    gain.gain.setValueAtTime(vol, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.07 : 0.04))
    osc.start(time)
    osc.stop(time + (isAccent ? 0.08 : 0.05))
  } else if (soundType === 'cowbell') {
    const osc2 = audioCtx.createOscillator()
    osc.type = 'square'
    osc2.type = 'square'

    const f1 = isAccent ? 800 : 540
    const f2 = isAccent ? 1200 : 800
    osc.frequency.setValueAtTime(f1, time)
    osc2.frequency.setValueAtTime(f2, time)

    const bandpass = audioCtx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(1000, time)

    osc.connect(bandpass)
    osc2.connect(bandpass)
    bandpass.connect(gain)

    gain.gain.setValueAtTime(vol * 0.8, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)

    osc.start(time)
    osc2.start(time)
    osc.stop(time + 0.12)
    osc2.stop(time + 0.12)
  } else { // 'rimshot' (caja acústica simulada)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(isAccent ? 330 : 220, time)
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.03)

    gain.gain.setValueAtTime(vol * 1.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035)
    osc.start(time)
    osc.stop(time + 0.04)

    // Generar un pequeño pulso de ruido blanco
    try {
      const bufferSize = audioCtx.sampleRate * 0.015 // 15ms de ruido
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const noise = audioCtx.createBufferSource()
      noise.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.setValueAtTime(1200, time)

      const noiseGain = audioCtx.createGain()
      noiseGain.gain.setValueAtTime(vol * 0.4, time)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012)

      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(audioCtx.destination)

      noise.start(time)
      noise.stop(time + 0.02)
    } catch (e) {
      // Ignorar fallos de buffers en entornos limitados
    }
  }
}

/**
 * Sintetiza un acorde polifónico según el instrumento seleccionado (Rhodes, Piano Acústico, Guitarra, Órgano)
 */
export function playChordNotes(audioCtx, time, midiNotes, durationSeconds, instrument = 'rhodes') {
  if (midiNotes.length === 0) return

  if (instrument === 'piano') {
    midiNotes.forEach(note => {
      const freq = 440 * Math.pow(2, (note - 69) / 12)
      const noteVolume = 0.15 / Math.max(midiNotes.length, 1)

      // 1. Fundamental (senoidal)
      const osc1 = audioCtx.createOscillator()
      const gain1 = audioCtx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(freq, time)
      osc1.connect(gain1)
      gain1.connect(audioCtx.destination)

      gain1.gain.setValueAtTime(0, time)
      gain1.gain.linearRampToValueAtTime(noteVolume * 0.7, time + 0.005)
      gain1.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds)

      // 2. Segundo armónico (triangular) - decae más rápido
      const osc2 = audioCtx.createOscillator()
      const gain2 = audioCtx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(freq * 2, time)
      osc2.connect(gain2)
      gain2.connect(audioCtx.destination)

      gain2.gain.setValueAtTime(0, time)
      gain2.gain.linearRampToValueAtTime(noteVolume * 0.35, time + 0.005)
      gain2.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds * 0.5)

      // 3. Tercer armónico (senoidal) - decaimiento aún más rápido
      const osc3 = audioCtx.createOscillator()
      const gain3 = audioCtx.createGain()
      osc3.type = 'sine'
      osc3.frequency.setValueAtTime(freq * 3, time)
      osc3.connect(gain3)
      gain3.connect(audioCtx.destination)

      gain3.gain.setValueAtTime(0, time)
      gain3.gain.linearRampToValueAtTime(noteVolume * 0.15, time + 0.005)
      gain3.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds * 0.3)

      // 4. Transitorio del impacto del martillo (barrido de frecuencia rápido)
      const oscHammer = audioCtx.createOscillator()
      const gainHammer = audioCtx.createGain()
      oscHammer.type = 'sine'
      oscHammer.frequency.setValueAtTime(freq * 8, time)
      oscHammer.frequency.exponentialRampToValueAtTime(freq, time + 0.015)
      oscHammer.connect(gainHammer)
      gainHammer.connect(audioCtx.destination)

      gainHammer.gain.setValueAtTime(noteVolume * 0.4, time)
      gainHammer.gain.exponentialRampToValueAtTime(0.0001, time + 0.015)

      osc1.start(time)
      osc2.start(time)
      osc3.start(time)
      oscHammer.start(time)

      osc1.stop(time + durationSeconds + 0.02)
      osc2.stop(time + durationSeconds + 0.02)
      osc3.stop(time + durationSeconds + 0.02)
      oscHammer.stop(time + 0.02)
    })
  } else if (instrument === 'guitar') {
    midiNotes.forEach(note => {
      const osc1 = audioCtx.createOscillator()
      const osc2 = audioCtx.createOscillator()
      const filter = audioCtx.createBiquadFilter()
      const gain = audioCtx.createGain()

      osc1.type = 'triangle'
      osc2.type = 'sawtooth'
      const freq = 440 * Math.pow(2, (note - 69) / 12)
      osc1.frequency.setValueAtTime(freq, time)
      osc2.frequency.setValueAtTime(freq, time)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(freq * 6, time)
      filter.frequency.exponentialRampToValueAtTime(freq * 1.2, time + Math.min(0.25, durationSeconds * 0.5))
      filter.Q.setValueAtTime(1.5, time)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(audioCtx.destination)

      const noteVolume = 0.14 / Math.max(midiNotes.length, 1)

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(noteVolume, time + 0.008) // Ataque de pulsación rápido
      gain.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds)

      osc1.start(time)
      osc2.start(time)
      osc1.stop(time + durationSeconds + 0.02)
      osc2.stop(time + durationSeconds + 0.02)
    })
  } else if (instrument === 'organ') {
    midiNotes.forEach(note => {
      const freq = 440 * Math.pow(2, (note - 69) / 12)
      const noteVolume = 0.12 / Math.max(midiNotes.length, 1)

      // Harmónicos del órgano estilo drawbars
      const harmonics = [
        { ratio: 0.5, vol: 0.5 },  // Sub-octava
        { ratio: 1.0, vol: 1.0 },  // Fundamental
        { ratio: 1.5, vol: 0.6 },  // Quinta armónica
        { ratio: 2.0, vol: 0.5 },  // Octava superior
        { ratio: 3.0, vol: 0.3 }   // Quinta doble
      ]

      const oscillators = []
      const masterGain = audioCtx.createGain()
      masterGain.connect(audioCtx.destination)

      harmonics.forEach(h => {
        const osc = audioCtx.createOscillator()
        const oscGain = audioCtx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq * h.ratio, time)
        oscGain.gain.setValueAtTime(h.vol, time)

        osc.connect(oscGain)
        oscGain.connect(masterGain)
        oscillators.push(osc)
      })

      // Envolvente de órgano clásica: entrada y salida inmediata sin decay prolongado
      masterGain.gain.setValueAtTime(0, time)
      masterGain.gain.linearRampToValueAtTime(noteVolume * 0.45, time + 0.01)
      masterGain.gain.setValueAtTime(noteVolume * 0.45, time + durationSeconds - 0.02)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds)

      oscillators.forEach(osc => {
        osc.start(time)
        osc.stop(time + durationSeconds + 0.02)
      })
    })
  } else {
    // Sonido original: Rhodes (piano eléctrico cálido)
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(900, time)
    filter.Q.setValueAtTime(1.0, time)
    filter.connect(audioCtx.destination)

    midiNotes.forEach(note => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()

      osc.type = 'triangle'
      const freq = 440 * Math.pow(2, (note - 69) / 12)
      osc.frequency.setValueAtTime(freq, time)

      osc.connect(gain)
      gain.connect(filter)

      const noteVolume = 0.18 / Math.max(midiNotes.length, 1)

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(noteVolume, time + 0.02)
      gain.gain.setValueAtTime(noteVolume, time + durationSeconds - 0.06)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds)

      osc.start(time)
      osc.stop(time + durationSeconds + 0.02)
    })
  }
}
