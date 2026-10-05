import {SCALES} from './scales.js'
import {buildExpandedSequence} from './repeatSequence.js'

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
export const canonicalDocument = value => JSON.stringify(value,(_,item)=>
  item && typeof item==='object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item)
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fail = () => {throw new Error('La composición tiene un formato no válido o incompatible. No se reemplazó tu trabajo.')}
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max
const rhythms = new Set(['auto','dotted-whole','whole','dotted-half','double','dotted-quarter','quarter','eighth','offbeat','sixteenth','triplet','quintuplet'])
const note = value => typeof value === 'string' && (value === '' || /^[A-G](?:#{1,2}|b{1,2})?$/.test(value))
const metric = value => plain(value) && integer(value.beats, 1, 32) && [2,4,8,16].includes(value.unit)
const grouping = value => value === null || (Array.isArray(value) && value.length <= 32 && value.every(n => integer(n,1,32)))
const id = value => typeof value === 'string' && value.length <= 150 && /^[a-zA-Z0-9_.-]+$/.test(value)

// Validate a full document before assigning any editor ref. Unknown musical fields
// are retained, while executable/prototype data and unsafe structure are rejected.
export function validateProjectDocument(document) {
  if (!plain(document) || document.format !== 'harmonigrid-project' || document.schemaVersion !== 1) fail()
  let nodes = 0
  const visit = (value, depth = 0) => {
    if (++nodes > 300000 || depth > 16) fail()
    if (typeof value === 'number' && !Number.isFinite(value)) fail()
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') fail()
    if (value && typeof value === 'object') {
      if (!Array.isArray(value) && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail()
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__','constructor','prototype'].includes(key)) fail()
        visit(child,depth + 1)
      }
    }
  }
  visit(document)
  const serialized = JSON.stringify(document)
  // Allow room for PostgreSQL JSONB's whitespace normalization at the SQL limit.
  if (new TextEncoder().encode(serialized).length > MAX_DOCUMENT_BYTES - 256000) fail()
  if (typeof document.title !== 'string' || !document.title.trim() || document.title.length > 500) fail()
  if (!note(document.key) || !document.key || !Object.hasOwn(SCALES,document.scaleType)) fail()
  if (!integer(document.timeSignature,1,32) || ![2,4,8,16].includes(document.timeSignatureUnit) || !grouping(document.globalGrouping)) fail()
  if (typeof document.globalGroove !== 'string' || document.globalGroove.length > 100) fail()
  for (const field of ['globalShowObligado','globalShowSubdivisions','showLyricsGlobal']) if (typeof document[field] !== 'boolean') fail()
  if (!Array.isArray(document.measures) || !integer(document.measures.length,1,999)) fail()
  const validateBeat = (beat, chord = true) => {
    if (!plain(beat)) fail()
    if (beat.id !== undefined && !id(beat.id)) fail()
    const rhythm = beat.harmonicRhythm
    if (rhythm !== undefined && !rhythms.has(String(rhythm).replace(/^rest-/,''))) fail()
    if (chord) {
      if (!note(beat.root ?? '') || (beat.bass != null && !note(beat.bass))) fail()
      if (beat.type != null && (typeof beat.type !== 'string' || beat.type.length > 50 || !/^[a-zA-Z0-9#b()/+°øΔ.-]*$/.test(beat.type))) fail()
      const tension = t => typeof t === 'string' && t.length <= 30 && /^[a-zA-Z0-9#b()/+.-]*$/.test(t)
      if (beat.tension != null && !tension(beat.tension)) fail()
      if (beat.tensions != null && (!Array.isArray(beat.tensions) || beat.tensions.length > 20 || beat.tensions.some(t=>!tension(t)))) fail()
    }
    if (beat.subdivisions !== undefined) {
      if (!Array.isArray(beat.subdivisions) || beat.subdivisions.length > 8) fail()
      beat.subdivisions.forEach(sub => {if (sub.subdivisions !== undefined) fail();validateBeat(sub,chord)})
    }
  }
  document.measures.forEach(measure => {
    if (!plain(measure) || !id(measure.id) || !Array.isArray(measure.beats) || !integer(measure.beats.length,1,32)) fail()
    if (measure.timeSignature && !metric(measure.timeSignature)) fail()
    if (measure.grouping && !grouping(measure.grouping)) fail()
    if (measure.keyChange && (!plain(measure.keyChange) || !note(measure.keyChange.key) || !measure.keyChange.key || !Object.hasOwn(SCALES,measure.keyChange.scaleType || 'major'))) fail()
    measure.beats.forEach(beat=>validateBeat(beat))
    if (measure.lyrics !== undefined) {
      const lyrics = measure.lyrics
      if (!plain(lyrics) || typeof lyrics.rawText !== 'string' || !['free','rhythm','synced'].includes(lyrics.mode)) fail()
      if (lyrics.beats !== undefined) {if (!Array.isArray(lyrics.beats) || lyrics.beats.length > 32) fail();lyrics.beats.forEach(beat=>validateBeat(beat,false))}
      for (const name of ['syllables','anchors']) if (lyrics[name] !== undefined && (!Array.isArray(lyrics[name]) || lyrics[name].length > 10000 || lyrics[name].some(x=>!plain(x)))) fail()
    }
  })
  for (const name of ['tiedSlots','lyricsTiedSlots']) {
    if (!Array.isArray(document[name]) || document[name].length > 50000 || document[name].some(s=>typeof s !== 'string' || !/^(?:lyrics_)?\d+_\d+(?:_\d+)?$/.test(s))) fail()
  }
  if (!Array.isArray(document.repeats) || document.repeats.length > document.measures.length) fail()
  buildExpandedSequence(document.measures,document.repeats)
  const prefs = document.preferences
  if (!plain(prefs) || !['compact','expanded'].includes(prefs.viewMode) || !['chords','roman'].includes(prefs.notationMode) || !integer(prefs.measuresPerSystem,1,8) || !integer(prefs.bpm,30,300)) fail()
  if (prefs.audio !== undefined) {
    const audio = prefs.audio
    if (!plain(audio) || !integer(audio.startMeasure,1,999)) fail()
    for (const name of ['bassOnly','metronome','chordsActive','continuity','fillChords']) if (typeof audio[name] !== 'boolean') fail()
    for (const [name,options] of Object.entries({metronomeSound:['beep','woodblock','cowbell','rimshot'],instrument:['rhodes','piano','guitar','organ'],triadVoicing:['fundamental','inversion1','inversion2'],tetradVoicing:['fundamental','drop2','inversion1','inversion2','inversion3']})) if (!options.includes(audio[name])) fail()
  }
  // Return a detached editable copy. Never hydrate reactive editor refs from a
  // shared response, history snapshot or cached immutable measure object.
  return JSON.parse(serialized)
}
