// Bound materialization before loops allocate copies. This is a safety ceiling,
// not a claim that every device renders a sequence of this size fluently.
import {MAX_EXPANDED_MEASURES} from './projectLimits.js'
export {MAX_EXPANDED_MEASURES} from './projectLimits.js'

const integer = (value, name, min = 1) => {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min) {
    throw new RangeError(`${name}: introduce un número entero válido (mínimo ${min}).`)
  }
  return number
}

export function buildExpandedSequence(measures = [], repeats = []) {
  if (!measures.length) return []
  if (measures.length > MAX_EXPANDED_MEASURES) {
    throw new RangeError(`La secuencia supera ${MAX_EXPANDED_MEASURES} compases.`)
  }
  // Validate all metadata before entering a loop, including unsupported types.
  const sorted = repeats.map(repeat => {
    if (!['simple', 'casilla'].includes(repeat.type)) throw new RangeError('Tipo de repetición no válido.')
    const r = {...repeat, startMeasure: integer(repeat.startMeasure, 'Inicio'), endMeasure: integer(repeat.endMeasure, 'Final'), times: integer(repeat.times, 'Repeticiones', 2)}
    if (r.times > MAX_EXPANDED_MEASURES || r.endMeasure < r.startMeasure || r.startMeasure > measures.length) throw new RangeError('Rango o cantidad de repeticiones no válido.')
    if (r.type === 'casilla') {
      r.casilla1Start = integer(repeat.casilla1Start ?? r.startMeasure, 'Primera casilla')
      r.casilla2Start = integer(repeat.casilla2Start ?? r.endMeasure + 1, 'Segunda casilla')
      r.casilla2End = integer(repeat.casilla2End ?? r.casilla2Start, 'Final de segunda casilla')
      if (r.casilla1Start < r.startMeasure || r.casilla1Start > r.endMeasure || r.casilla2Start <= r.endMeasure || r.casilla2End < r.casilla2Start) throw new RangeError('Las casillas tienen un rango no válido.')
    }
    return r
  }).sort((a, b) => a.startMeasure - b.startMeasure)
  const result = []
  const reserve = count => {
    if (result.length + count > MAX_EXPANDED_MEASURES) throw new RangeError(`La expansión supera ${MAX_EXPANDED_MEASURES} compases. Reduce el rango o las repeticiones.`)
  }
  const append = (start, end, pass, r) => {
    for (let m = start; m <= end; m++) {
      const original = measures[m - 1]
      result.push({...original, id: `${original.id}-${r.type === 'simple' ? 'rep' : 'casilla'}-${pass}-${m}`, originalMeasureIndex: m - 1, isExpandedCopy: true, displayPass: pass})
    }
  }
  let i = 0
  while (i < measures.length) {
    const r = sorted.find(repeat => repeat.startMeasure === i + 1)
    if (!r) {
      reserve(1)
      result.push({...measures[i], originalMeasureIndex: i, isExpandedCopy: false, displayPass: null})
      i++
    } else if (r.type === 'simple') {
      const end = Math.min(r.endMeasure, measures.length)
      reserve((end - r.startMeasure + 1) * r.times)
      for (let pass = 1; pass <= r.times; pass++) append(r.startMeasure, end, pass, r)
      i = end
    } else {
      const firstEnd = Math.min(r.endMeasure, measures.length)
      const commonEnd = Math.min(r.casilla1Start - 1, measures.length)
      const secondEnd = Math.min(r.casilla2End, measures.length)
      const commonCount = Math.max(0, commonEnd - r.startMeasure + 1)
      const firstCount = Math.max(0, firstEnd - r.casilla1Start + 1)
      const secondCount = Math.max(0, secondEnd - r.casilla2Start + 1)
      reserve(commonCount * r.times + firstCount * (r.times - 1) + secondCount)
      for (let pass = 1; pass < r.times; pass++) {
        append(r.startMeasure, commonEnd, pass, r)
        append(r.casilla1Start, firstEnd, pass, r)
      }
      append(r.startMeasure, commonEnd, r.times, r)
      append(r.casilla2Start, secondEnd, r.times, r)
      i = Math.max(r.endMeasure, r.casilla2End)
    }
  }
  return result.map((measure, index) => ({...measure, displayedMeasureIndex: index}))
}
