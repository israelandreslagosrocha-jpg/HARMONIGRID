import { jsPDF } from "jspdf"
import { formatChord } from "./chords.js"

export function generatePDF(project, exportOption = 'chords-only') {
  const GROOVE_PATTERNS = {
    Ninguno: ['quarter', 'quarter', 'quarter', 'quarter'],
    Pop: ['quarter', 'quarter', 'quarter', 'eighth'],
    Ballad: ['quarter', 'quarter', 'quarter', 'quarter'],
    Funk: ['eighth', 'eighth', 'eighth', 'eighth'],
    Latin: ['eighth', 'eighth', 'eighth', 'eighth'],
    Bossa: ['quarter', 'offbeat', 'quarter', 'offbeat'],
    Rock: ['quarter', 'quarter', 'quarter', 'quarter'],
    Upbeat: ['offbeat', 'offbeat', 'offbeat', 'offbeat'],
    'Half-time': ['quarter', 'quarter', 'quarter', 'quarter'],
    Arpegio: ['eighth', 'eighth', 'eighth', 'eighth'],
    'Push final': ['sixteenth', 'sixteenth', 'sixteenth', 'sixteenth']
  }

  const getSubdivisionCount = (rhythm, isDenom8 = false, beat = null) => {
    if (isDenom8 && rhythm === 'eighth') {
      return beat && beat.eighthPattern ? 2 : 1
    }
    if (rhythm === 'eighth' || rhythm === 'offbeat') return 2
    if (rhythm === 'sixteenth') return 4
    if (rhythm === 'triplet') return 3
    if (rhythm === 'quintuplet') return 5
    return 1
  }

  const getEffectiveRhythm = (measure, beat, beatIdx) => {
    if (!beat) return 'quarter'
    if (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto') {
      return beat.harmonicRhythm
    }
    const mGroove = measure.groove || 'global'
    if (mGroove === 'neutral') {
      return 'quarter'
    }
    if (mGroove === 'custom') {
      return 'quarter'
    }
    const globalGroove = project.globalGroove || 'Ninguno'
    const pattern = GROOVE_PATTERNS[globalGroove] || GROOVE_PATTERNS.Ninguno
    return pattern[beatIdx] || 'quarter'
  }

  const getRhythmDisplayIconPDF = (rhythm, isDenom8) => {
    const isRest = rhythm && rhythm.startsWith('rest-')
    const base = isRest ? rhythm.substring(5) : rhythm
    const prefix = isRest ? 'Silencio de ' : ''
    if (isDenom8) {
      if (base === 'dotted-whole') return prefix + 'Redonda c/punto'
      if (base === 'whole') return prefix + 'Redonda'
      if (base === 'dotted-half') return prefix + 'Blanca c/punto'
      if (base === 'double') return prefix + 'Blanca'
      if (base === 'dotted-quarter') return prefix + 'Negra c/punto'
      if (base === 'quarter') return prefix + 'Negra'
      if (base === 'eighth' || base === 'auto') return prefix + 'Corchea'
      if (base === 'sixteenth') return prefix + 'Semicorchea'
    } else {
      if (base === 'dotted-whole') return prefix + 'Redonda c/punto'
      if (base === 'whole') return prefix + 'Redonda'
      if (base === 'dotted-half') return prefix + 'Blanca c/punto'
      if (base === 'double') return prefix + 'Blanca'
      if (base === 'dotted-quarter') return prefix + 'Negra c/punto'
      if (base === 'quarter' || base === 'auto') return prefix + 'Negra'
      if (base === 'eighth') return prefix + 'Corchea'
      if (base === 'sixteenth') return prefix + 'Semicorchea'
    }
    return ''
  }

  const getBeatSlotDurationPDF = (measure, beat, isDenom8) => {
    const rhythm = beat.harmonicRhythm || 'auto'
    const isRest = rhythm.startsWith('rest-')
    const base = isRest ? rhythm.substring(5) : rhythm
    if (isDenom8) {
      if (base === 'dotted-whole') return 12
      if (base === 'whole') return 8
      if (base === 'dotted-half') return 6
      if (base === 'double') return 4
      if (base === 'dotted-quarter') return 3
      if (base === 'quarter') return 2
      if (base === 'eighth') return 1
      return 1
    } else {
      if (base === 'dotted-whole') return 6
      if (base === 'whole') return 4
      if (base === 'dotted-half') return 3
      if (base === 'double') return 2
      if (base === 'dotted-quarter') return 1.5
      if (base === 'quarter') return 1
      return 1
    }
  }

  const getBeatMergeState = (measure, sig) => {
    const numBeats = sig.beats
    const isDenom8 = sig.unit === 8
    const subdivisionsOn = measure.showSubdivisions !== false
    
    const states = Array.from({ length: numBeats }, () => ({ isMerged: false, flexGrow: 1 }))
    
    if (subdivisionsOn) {
      if (measure.showObligado) {
        // Strict Mode: merge based on explicit figures duration
        for (let i = 0; i < numBeats; i++) {
          if (states[i].isMerged) continue
          const beat = measure.beats[i] || { root: '', type: '' }
          if (beat.root || beat.harmonicRhythm) {
            const dur = getBeatSlotDurationPDF(measure, beat, isDenom8)
            states[i].flexGrow = dur
            for (let j = 1; j < dur; j++) {
              if (i + j < numBeats) {
                states[i + j].isMerged = true
                states[i + j].flexGrow = 0
              }
            }
          }
        }
      } else {
        // Normal Mode: auto-extend chords until next chord or end of measure
        for (let i = 0; i < numBeats; i++) {
          if (states[i].isMerged) continue
          const beat = measure.beats[i] || { root: '', type: '' }
          if (beat.root) {
            let dur = 1
            let j = i + 1
            while (j < numBeats) {
              const nextBeat = measure.beats[j] || { root: '', type: '' }
              if (nextBeat.root) break
              dur++
              j++
            }
            states[i].flexGrow = dur
            for (let k = 1; k < dur; k++) {
              if (i + k < numBeats) {
                states[i + k].isMerged = true
                states[i + k].flexGrow = 0
              }
            }
          }
        }
      }
    }
    return states
  }

  const getBeatSlots = (measure, beat, beatIdx) => {
    const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
    const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
    const isDenom8 = sig.unit === 8
    const subCount = getSubdivisionCount(rhythm, isDenom8, beat)
    if (subCount === 1) return []
    
    if (beat.subdivisions && beat.subdivisions.length === subCount) {
      return beat.subdivisions
    }
    
    const slots = []
    for (let i = 0; i < subCount; i++) {
      if (rhythm === 'offbeat' && i === 0) {
        slots.push({ root: '', type: '', isSilence: true })
      } else {
        const isPrimary = (rhythm !== 'offbeat' && i === 0) || (rhythm === 'offbeat' && i === 1)
        slots.push({
          root: isPrimary ? beat.root : '',
          type: isPrimary ? beat.type : '',
          tensions: isPrimary ? [...(beat.tensions || [])] : [],
          tension: isPrimary ? beat.tension : null,
          bass: isPrimary ? beat.bass : null,
          isSilence: isPrimary ? (beat.isSilence || !beat.root) : true
        })
      }
    }
    return slots
  }

  const splitChordDisplayPDF = (chordStr) => {
    if (!chordStr || chordStr === '-') return { main: '-', bass: '' }
    const parts = chordStr.split('/')
    return {
      main: parts[0],
      bass: parts[1] ? `/${parts[1]}` : ''
    }
  }

  // --- LYRICS HELPERS ---

  const tokenizeText = (text) => {
    if (!text) return []
    const regex = /(\s+)|([^\s]+(?:\s+|$))/g
    return text.match(regex) || []
  }

  const distributeTokens = (tokens, P) => {
    const result = Array.from({ length: P }, () => '')
    if (tokens.length === 0) return result
    
    if (tokens.length <= P) {
      tokens.forEach((tok, idx) => {
        result[idx] = tok
      })
      return result
    }
    
    const tokensPerSlot = tokens.length / P
    let tokenIdx = 0
    for (let i = 0; i < P; i++) {
      const nextTokenIdx = Math.round((i + 1) * tokensPerSlot)
      result[i] = tokens.slice(tokenIdx, nextTokenIdx).join('')
      tokenIdx = nextTokenIdx
    }
    return result
  }

  const getAllMeasureSlotsPDF = (measure, sig) => {
    const slots = []
    const mergeStates = getBeatMergeState(measure, sig)
    measure.beats.slice(0, sig.beats).forEach((beat, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return
      slots.push({
        id: beat.id,
        beat: beat,
        state: state,
        index: bIdx
      })
    })
    return slots
  }

  const getMeasureLyricsLayoutPDF = (measure, sig) => {
    const rawText = measure.lyrics?.rawText || ''
    const anchors = measure.lyrics?.anchors || []
    
    const allSlots = getAllMeasureSlotsPDF(measure, sig)
    const slotCount = allSlots.length
    
    const result = {}
    allSlots.forEach(s => {
      result[s.id] = {
        slotId: s.id,
        hasLyrics: false,
        hasAssociated: false,
        preText: '',
        associatedText: '',
        postText: '',
        normalText: '',
        preStart: 0, preEnd: 0,
        assocStart: 0, assocEnd: 0,
        postStart: 0, postEnd: 0,
        normalStart: 0, normalEnd: 0
      }
    })
    
    if (slotCount === 0 || !rawText) {
      return result
    }
    
    const activeAnchors = []
    anchors.forEach(anchor => {
      const slotIdx = allSlots.findIndex(s => s.id === anchor.chordId)
      if (slotIdx !== -1) {
        activeAnchors.push({
          anchor,
          slotIdx,
          start: anchor.start,
          end: anchor.end
        })
      }
    })
    
    activeAnchors.sort((a, b) => a.slotIdx - b.slotIdx)
    
    if (activeAnchors.length === 0) {
      const tokens = tokenizeText(rawText)
      const distributed = distributeTokens(tokens, slotCount)
      
      let currentCharIdx = 0
      allSlots.forEach((s, idx) => {
        const text = distributed[idx] || ''
        result[s.id] = {
          slotId: s.id,
          hasLyrics: text.length > 0,
          hasAssociated: false,
          normalText: text,
          normalStart: currentCharIdx,
          normalEnd: currentCharIdx + text.length
        }
        currentCharIdx += text.length
      })
      
      return result
    }
    
    const K = activeAnchors.length
    
    const anchorWords = activeAnchors.map((aa, idx) => {
      let wordStart = aa.start
      const prevEnd = idx > 0 ? activeAnchors[idx - 1].end : 0
      while (wordStart > prevEnd && !/\s/.test(rawText[wordStart - 1])) {
        wordStart--
      }
      
      let wordEnd = aa.end
      const nextStart = idx < K - 1 ? activeAnchors[idx + 1].start : rawText.length
      while (wordEnd < nextStart && !/\s/.test(rawText[wordEnd])) {
        wordEnd++
      }
      
      return {
        wordStart,
        wordEnd,
        prefixStart: wordStart,
        prefixEnd: aa.start,
        suffixStart: aa.end,
        suffixEnd: wordEnd
      }
    })
    
    const distributeRange = (startChar, endChar, targets) => {
      if (startChar >= endChar) return
      const text = rawText.substring(startChar, endChar)
      const tokens = tokenizeText(text)
      const distributed = distributeTokens(tokens, targets.length)
      
      let currentCharIdx = startChar
      targets.forEach((target, idx) => {
        const part = distributed[idx] || ''
        const partLen = part.length
        const start = currentCharIdx
        const end = currentCharIdx + partLen
        currentCharIdx = end
        
        if (partLen === 0) return
        
        const slotRes = result[target.slotId]
        if (!slotRes) return
        slotRes.hasLyrics = true
        
        if (target.type === 'pre') {
          slotRes.preText = slotRes.preText ? (part + slotRes.preText) : part
          slotRes.preStart = start
          slotRes.preEnd = end + (slotRes.preEnd - slotRes.preStart)
        } else if (target.type === 'post') {
          slotRes.postText = slotRes.postText ? (slotRes.postText + part) : part
          slotRes.postStart = slotRes.postStart || start
          slotRes.postEnd = end
        } else {
          slotRes.normalText = part
          slotRes.normalStart = start
          slotRes.normalEnd = end
        }
      })
    }
    
    activeAnchors.forEach((aa, idx) => {
      const word = anchorWords[idx]
      const slotRes = result[aa.anchor.chordId]
      if (!slotRes) return
      slotRes.hasLyrics = true
      slotRes.hasAssociated = true
      slotRes.associatedText = rawText.substring(aa.start, aa.end)
      slotRes.assocStart = aa.start
      slotRes.assocEnd = aa.end
      slotRes.anchor = aa.anchor
      
      const suffixText = rawText.substring(word.suffixStart, word.suffixEnd)
      if (suffixText) {
        slotRes.postText = suffixText
        slotRes.postStart = word.suffixStart
        slotRes.postEnd = word.suffixEnd
      }
      
      const prefixText = rawText.substring(word.prefixStart, word.prefixEnd)
      if (prefixText) {
        slotRes.preText = prefixText
        slotRes.preStart = word.prefixStart
        slotRes.preEnd = word.prefixEnd
      }
    })
    
    const reg0Targets = []
    const firstAnchorIdx = activeAnchors[0].slotIdx
    for (let i = 0; i < firstAnchorIdx; i++) {
      reg0Targets.push({ slotId: allSlots[i].id, type: 'normal' })
    }
    reg0Targets.push({ slotId: allSlots[firstAnchorIdx].id, type: 'pre' })
    distributeRange(0, anchorWords[0].wordStart, reg0Targets)
    
    for (let k = 0; k < K - 1; k++) {
      const curr = activeAnchors[k]
      const next = activeAnchors[k + 1]
      const currWord = anchorWords[k]
      const nextWord = anchorWords[k + 1]
      
      const regKTargets = []
      regKTargets.push({ slotId: allSlots[curr.slotIdx].id, type: 'post' })
      for (let i = curr.slotIdx + 1; i < next.slotIdx; i++) {
        regKTargets.push({ slotId: allSlots[i].id, type: 'normal' })
      }
      regKTargets.push({ slotId: allSlots[next.slotIdx].id, type: 'pre' })
      distributeRange(currWord.wordEnd, nextWord.wordStart, regKTargets)
    }
    
    const last = activeAnchors[K - 1]
    const lastWord = anchorWords[K - 1]
    const regKLastTargets = []
    regKLastTargets.push({ slotId: allSlots[last.slotIdx].id, type: 'post' })
    for (let i = last.slotIdx + 1; i < slotCount; i++) {
      regKLastTargets.push({ slotId: allSlots[i].id, type: 'normal' })
    }
    distributeRange(lastWord.wordEnd, rawText.length, regKLastTargets)
    
    return result
  }

  const getSyllableAtSlotPDF = (project, measure, measureIdx, beatIdx, subIdx) => {
    if (!measure.lyrics || !measure.lyrics.syllables) return null
    
    const slotId = subIdx !== null && subIdx !== undefined
      ? `lyrics_${measureIdx}_${beatIdx}_${subIdx}`
      : `lyrics_${measureIdx}_${beatIdx}`
      
    const matched = measure.lyrics.syllables.filter(s => s.rhythmEventId === slotId)
    if (matched.length > 0) {
      const joinedText = matched.map(s => s.text).join('')
      const hasTied = matched.some(s => s.tied)
      return { text: joinedText, isRoot: true, tied: hasTied }
    }
    
    const lyricsTiedSlots = project.lyricsTiedSlots ? new Set(project.lyricsTiedSlots) : new Set()
    if (!lyricsTiedSlots.has(slotId)) return null
    
    const slotList = []
    for (let m = 0; m <= measureIdx; m++) {
      const currM = project.measures[m]
      if (!currM) continue
      const sig = currM.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      const isDenom8 = sig.unit === 8
      const mergeStates = getBeatMergeState(currM, sig)
      
      currM.beats.slice(0, sig.beats).forEach((beat, b) => {
        const state = mergeStates[b] || { isMerged: false, flexGrow: 1 }
        if (state.isMerged) return
        
        const rhythm = getEffectiveRhythm(currM, beat, b)
        const subCount = getSubdivisionCount(rhythm, isDenom8, beat)
        const hasSubdivisions = subCount > 1
        
        if (!hasSubdivisions) {
          slotList.push({
            id: `lyrics_${m}_${b}`,
            measureIdx: m,
            beatIdx: b,
            subIdx: null,
            isSilence: beat.isSilence || !beat.root
          })
        } else {
          const slots = getBeatSlots(currM, beat, b)
          slots.forEach((sub, s) => {
            slotList.push({
              id: `lyrics_${m}_${b}_${s}`,
              measureIdx: m,
              beatIdx: b,
              subIdx: s,
              isSilence: sub.isSilence || !sub.root
            })
          })
        }
      })
    }
    
    const curIdx = slotList.findIndex(b => b.id === slotId)
    if (curIdx === -1 || slotList[curIdx].isSilence) return null
    
    let scanIdx = curIdx
    while (scanIdx > 0 && lyricsTiedSlots.has(slotList[scanIdx].id)) {
      scanIdx--
      const prevBlock = slotList[scanIdx]
      if (prevBlock.isSilence) break
      const prevMeasure = project.measures[prevBlock.measureIdx]
      if (prevMeasure && prevMeasure.lyrics && prevMeasure.lyrics.syllables) {
        const prevSlotId = prevBlock.id
        const prevSyllable = prevMeasure.lyrics.syllables.find(s => s.rhythmEventId === prevSlotId)
        if (prevSyllable) {
          return { text: '~', isRoot: false, tied: true }
        }
      }
    }
    
    return null
  }

  const getChordFontSizes = (measure, sig) => {
    let chordCount = 0
    let maxLength = 0
    const numBeats = sig.beats
    const isDenom8 = sig.unit === 8
    
    const checkChord = (chordObj) => {
      if (chordObj.root) {
        chordCount++
        const chordStr = formatChord(chordObj)
        if (chordStr.length > maxLength) {
          maxLength = chordStr.length
        }
      }
    }
    
    for (let i = 0; i < numBeats; i++) {
      const beat = measure.beats[i]
      if (!beat) continue
      const rhythm = getEffectiveRhythm(measure, beat, i)
      const subCount = getSubdivisionCount(rhythm, isDenom8, beat)
      
      if (subCount > 1) {
        const slots = getBeatSlots(measure, beat, i)
        slots.forEach(slot => {
          checkChord(slot)
        })
      } else {
        checkChord(beat)
      }
    }
    
    // Base font size depends on chord count
    let mainSize = 11.5
    let bassSize = 8.5
    
    if (chordCount === 2) {
      mainSize = 9.5
      bassSize = 7.5
    } else if (chordCount === 3) {
      mainSize = 8.5
      bassSize = 6.5
    } else if (chordCount >= 4) {
      mainSize = 7.5
      bassSize = 5.5
    }
    
    // Further scale down if chord names are very long
    if (maxLength > 7) {
      mainSize -= 1.0
      bassSize -= 0.5
    }
    if (maxLength > 10) {
      mainSize -= 1.0
      bassSize -= 0.5
    }
    
    // Bounds check
    mainSize = Math.max(6.0, mainSize)
    bassSize = Math.max(4.5, bassSize)
    
    return { main: mainSize, bass: bassSize }
  }

  const getMeasureLyricsHeight = (doc, measure, option, measureWidth, sig) => {
    if (!measure.lyrics) return 0
    if (option === 'chords-only' || option === 'chords-only-expanded') {
      return 0
    }
    if (option === 'chords-and-lyrics-free') {
      const text = measure.lyrics.rawText || ""
      if (!text.trim()) return 0
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      const lines = doc.splitTextToSize(text, measureWidth - 4)
      return lines.length * 3.5 + 2
    }
    if (option === 'chords-and-lyrics-rhythm') {
      let hasAny = false
      const numBeats = sig.beats
      const measureIdx = measure.originalMeasureIndex !== undefined ? measure.originalMeasureIndex : project.measures.indexOf(measure)
      
      for (let b = 0; b < numBeats; b++) {
        const beat = measure.beats[b]
        if (!beat) continue
        const rhythm = getEffectiveRhythm(measure, beat, b)
        const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
        const hasSubdivisions = subCount > 1
        
        if (!hasSubdivisions) {
          if (getSyllableAtSlotPDF(project, measure, measureIdx, b, null)) {
            hasAny = true
            break
          }
        } else {
          for (let s = 0; s < subCount; s++) {
            if (getSyllableAtSlotPDF(project, measure, measureIdx, b, s)) {
              hasAny = true
              break
            }
          }
        }
      }
      return hasAny ? 6 : 0
    }
    if (option === 'chords-and-lyrics-synced') {
      const rawText = measure.lyrics.rawText || ""
      return rawText.trim() ? 6 : 0
    }
    return 0
  }

  const drawFooter = (doc, pageHeight, pageWidth) => {
    doc.setLineWidth(0.2)
    doc.setDrawColor(210, 210, 210)
    doc.line(marginX, pageHeight - 20, pageWidth - 15, pageHeight - 20)
    
    const textWidth = doc.getTextWidth("HarmoniGrid by TeoMusicRecords")
    const circleRadius = 3
    const gap = 2
    const totalWidth = (circleRadius * 2) + gap + textWidth
    const circleX = (pageWidth / 2) - (totalWidth / 2) + circleRadius
    const circleY = pageHeight - 14
    
    doc.setFillColor(109, 40, 217) // #6d28d9 violet circle
    doc.circle(circleX, circleY, circleRadius, "F")
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(255, 255, 255)
    doc.text("H", circleX, circleY + 0.9, { align: "center" })
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text("HarmoniGrid by TeoMusicRecords", circleX + circleRadius + gap, circleY + 1)
    
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
  }

  const drawFreeLyrics = (doc, measure, mStartX, currentY, measureWidth) => {
    const text = measure.lyrics?.rawText || ""
    if (!text.trim()) return
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    
    const lines = doc.splitTextToSize(text, measureWidth - 4)
    let ly = currentY + 22
    lines.forEach((line) => {
      doc.text(line, mStartX + 2, ly)
      ly += 3.5
    })
    
    doc.setTextColor(0, 0, 0)
  }

  const drawSyllableLyrics = (doc, project, measure, globalMeasureIndex, mStartX, currentY, currentMeasureWidth, sig) => {
    const isDenom8 = sig.unit === 8
    let timeSigOffsetLocal = 0
    if (measure.timeSignature && globalMeasureIndex > 0) {
      const prevMeasure = project.measures[globalMeasureIndex - 1]
      const prevSig = prevMeasure 
        ? (prevMeasure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 })
        : { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      if (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit) {
        timeSigOffsetLocal = 8
      }
    }
    const effectiveMeasureWidth = currentMeasureWidth - timeSigOffsetLocal
    
    const mergeStates = getBeatMergeState(measure, sig)
    const beatGrows = measure.beats.slice(0, sig.beats).map((b, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return 0
      return state.flexGrow
    })
    const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    
    let currentXOffset = 0
    measure.beats.slice(0, sig.beats).forEach((beat, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return
      
      const currentBeatWidth = (state.flexGrow / totalGrow) * effectiveMeasureWidth
      const startXForBeats = mStartX + timeSigOffsetLocal + currentXOffset
      
      const rhythm = getEffectiveRhythm(measure, beat, bIdx)
      const subCount = getSubdivisionCount(rhythm, isDenom8, beat)
      const hasSubdivisions = subCount > 1
      
      if (hasSubdivisions) {
        const slots = getBeatSlots(measure, beat, bIdx)
        const visibleSlots = []
        if (rhythm !== 'sixteenth') {
          slots.forEach((s, idx) => {
            visibleSlots.push({ ...s, originalIndex: idx, flexGrow: 1 })
          })
        } else {
          for (let i = 0; i < slots.length; i++) {
            if (slots[i].isMerged) continue
            let flexGrow = 1
            let j = i + 1
            while (j < slots.length && slots[j].isMerged) {
              flexGrow++
              j++
            }
            visibleSlots.push({ ...slots[i], originalIndex: i, flexGrow })
          }
        }
        
        const subWidth = currentBeatWidth / subCount
        visibleSlots.forEach((sub) => {
          const subX = startXForBeats + (sub.originalIndex * subWidth) + ((subWidth * sub.flexGrow) / 2)
          const sylData = getSyllableAtSlotPDF(project, measure, globalMeasureIndex, bIdx, sub.originalIndex)
          if (sylData) {
            let textToDraw = sylData.text
            if (sylData.tied) {
              textToDraw += "~"
            }
            doc.text(textToDraw, subX, currentY + 23, { align: "center" })
          }
        })
      } else {
        const beatX = startXForBeats + (currentBeatWidth / 2)
        const sylData = getSyllableAtSlotPDF(project, measure, globalMeasureIndex, bIdx, null)
        if (sylData) {
          let textToDraw = sylData.text
          if (sylData.tied) {
            textToDraw += "~"
          }
          doc.text(textToDraw, beatX, currentY + 23, { align: "center" })
        }
      }
      currentXOffset += currentBeatWidth
    })
    
    doc.setTextColor(0, 0, 0)
  }

  const drawSyncedLyricsForMeasure = (doc, measure, layout, mStartX, currentY, currentMeasureWidth, sig, globalMeasureIndex) => {
    let timeSigOffsetLocal = 0
    if (measure.timeSignature && globalMeasureIndex > 0) {
      const prevMeasure = project.measures[globalMeasureIndex - 1]
      const prevSig = prevMeasure 
        ? (prevMeasure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 })
        : { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      if (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit) {
        timeSigOffsetLocal = 8
      }
    }
    const effectiveMeasureWidth = currentMeasureWidth - timeSigOffsetLocal
    const mergeStates = getBeatMergeState(measure, sig)
    const beatGrows = measure.beats.slice(0, sig.beats).map((b, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return 0
      return state.flexGrow
    })
    const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
    
    let currentXOffset = 0
    measure.beats.slice(0, sig.beats).forEach((beat, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return
      
      const currentBeatWidth = (state.flexGrow / totalGrow) * effectiveMeasureWidth
      const startXForBeats = mStartX + timeSigOffsetLocal + currentXOffset
      const beatX = startXForBeats + (currentBeatWidth / 2)
      
      const slotRes = layout[beat.id]
      if (slotRes && slotRes.hasLyrics) {
        if (slotRes.hasAssociated) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8.5)
          doc.setTextColor(109, 40, 217) // #6d28d9 violet accent
          
          const assocText = slotRes.associatedText || ""
          const assocWidth = doc.getTextWidth(assocText)
          doc.text(assocText, beatX, currentY + 23, { align: "center" })
          
          const preText = slotRes.preText || ""
          if (preText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8)
            doc.setTextColor(80, 80, 80)
            doc.text(preText, beatX - (assocWidth / 2) - 0.3, currentY + 23, { align: "right" })
          }
          
          const postText = slotRes.postText || ""
          if (postText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8)
            doc.setTextColor(80, 80, 80)
            doc.text(postText, beatX + (assocWidth / 2) + 0.3, currentY + 23, { align: "left" })
          }
        } else {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.setTextColor(80, 80, 80)
          const normalText = slotRes.normalText || ""
          doc.text(normalText, beatX, currentY + 23, { align: "center" })
        }
      }
      currentXOffset += currentBeatWidth
    })
    
    doc.setTextColor(0, 0, 0)
  }

  // project: { title, key, scaleType, timeSignature, measures, repeats, keySignatureStr }
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // --- CONFIGURACIÓN DE ESTILOS ---
  const marginX = 25 // Un poco más de margen para que quepa la armadura y métrica a la izquierda
  const marginY = 30
  const usableWidth = pageWidth - marginX - 15 // Margen derecho de 15
  const measuresPerRow = 4
  const measureWidth = usableWidth / measuresPerRow
  const lineYOffset = 15 // Dónde se dibuja la línea base del sistema respecto al inicio de la fila

  let currentY = marginY + 20

  // --- CABECERA ---
  doc.setFont("helvetica", "bold")
  doc.setFontSize(24)
  doc.text(project.title || "Sin Título", pageWidth / 2, marginY, { align: "center" })

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Esquema Armonico", marginX, marginY - 5)

  if (project.globalGroove && project.globalGroove !== 'Ninguno') {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Groove Global: ${project.globalGroove}`, pageWidth - 15, marginY - 5, { align: "right" })
  }

  // --- PIE DE PÁGINA ---
  drawFooter(doc, pageHeight, pageWidth)

  // --- DIBUJO DE SISTEMAS (FILAS) ---
  const rows = project.systems || []
  if (rows.length === 0) {
    for (let i = 0; i < project.measures.length; i += measuresPerRow) {
      rows.push(project.measures.slice(i, i + measuresPerRow))
    }
  }

  doc.setLineWidth(0.5)

  // Helper para buscar repeticiones
  const isRepeatStart = (mIdxGlobal) => {
    if (project.viewMode === 'expanded') return false
    return (project.repeats || []).some(r => r.startMeasure === mIdxGlobal + 1)
  }
  const getRepeatEndData = (mIdxGlobal) => {
    if (project.viewMode === 'expanded') return null
    return (project.repeats || []).find(r => r.endMeasure === mIdxGlobal + 1)
  }

  const getCasillaData = (mIdxGlobal) => {
    if (project.viewMode === 'expanded') return null
    const mNum = mIdxGlobal + 1
    for (const r of project.repeats || []) {
      if (r.type === 'casilla') {
        if (mNum >= r.casilla1Start && mNum <= r.endMeasure) {
          return {
            type: 1,
            isStart: mNum === r.casilla1Start,
            isEnd: mNum === r.endMeasure,
            times: r.times
          }
        }
        if (mNum >= r.casilla2Start && mNum <= r.casilla2End) {
          return {
            type: 2,
            isStart: mNum === r.casilla2Start,
            isEnd: mNum === r.casilla2End,
            times: r.times
          }
        }
      }
    }
    return null
  }

  rows.forEach((rowMeasures, rowIdx) => {
    // Si nos pasamos del alto de página, creamos una nueva
    const actualMeasureWidth = usableWidth / rowMeasures.length
    let maxLyricsHeight = 0
    rowMeasures.forEach((measure) => {
      const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      const h = getMeasureLyricsHeight(doc, measure, exportOption, actualMeasureWidth, sig)
      if (h > maxLyricsHeight) maxLyricsHeight = h
    })
    const currentRowHeight = 25 + maxLyricsHeight

    if (currentY + currentRowHeight > pageHeight - 30) {
      doc.addPage()
      currentY = marginY + 10
      drawFooter(doc, pageHeight, pageWidth)
      doc.setLineWidth(0.5)
    }

    const startX = marginX
    const lineY = currentY + lineYOffset
    // Since rows might not be equal width if systems have variable measure count, absoluteRowStartIndex is computed by summing previous measures
    let absoluteRowStartIndex = 0
    for (let prevIdx = 0; prevIdx < rowIdx; prevIdx++) {
      absoluteRowStartIndex += rows[prevIdx].length
    }

    // Información de Cifra indicadora y Tonalidad (Solo en la primera fila, dibujada ANTES del sistema)
    if (rowIdx === 0) {
      // Dibujar clave / armadura de clave
      if (project.keySignatureStr) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(14)
        // Draw right-aligned to prevent overlapping the time signature
        doc.text(project.keySignatureStr, marginX - 14, lineY - 6, { align: "right" })
      }
      
      doc.setFont("times", "bold")
      doc.setFontSize(22)
      doc.text(project.timeSignature.toString(), marginX - 12, lineY - 0.5)
      doc.text((project.timeSignatureUnit || 4).toString(), marginX - 12, lineY + 6.5)
    }

    // Pre-calculate measure widths and start positions for this row
    const measureWidths = rowMeasures.map(() => usableWidth / rowMeasures.length)

    const measureStarts = []
    let currentAccumulatedX = startX
    for (let colIdx = 0; colIdx < rowMeasures.length; colIdx++) {
      measureStarts.push(currentAccumulatedX)
      currentAccumulatedX += measureWidths[colIdx]
    }

    // 1. Acordes, Secciones y Letras
    rowMeasures.forEach((measure, colIdx) => {
      const globalMeasureIndex = absoluteRowStartIndex + colIdx
      const currentMeasureWidth = measureWidths[colIdx]
      const mStartX = measureStarts[colIdx]

      // Casilla Brackets (Modo Compacto)
      const casillaData = getCasillaData(globalMeasureIndex)
      if (casillaData) {
        const bracketY = currentY - 2
        const hookLength = 2.5
        
        doc.setLineWidth(0.4)
        doc.line(mStartX, bracketY, mStartX + currentMeasureWidth, bracketY) // horizontal line
        
        if (casillaData.isStart) {
          doc.line(mStartX, bracketY, mStartX, bracketY + hookLength) // left hook
          
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8)
          const label = casillaData.type === 1 ? `1. (x${casillaData.times || 2})` : "2."
          doc.text(label, mStartX + 1.5, bracketY - 1)
        }
        if (casillaData.isEnd) {
          doc.line(mStartX + currentMeasureWidth, bracketY, mStartX + currentMeasureWidth, bracketY + hookLength) // right hook
        }
      }

      // Sección Label
      if (measure.sectionLabel) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        
        // Caja alrededor del texto
        const textWidth = doc.getTextWidth(measure.sectionLabel)
        const boxPadding = 2
        doc.setFillColor(255, 255, 255)
        doc.rect(mStartX, currentY + 2, textWidth + (boxPadding * 2), 6, "FD")
        
        doc.text(measure.sectionLabel, mStartX + boxPadding, currentY + 6.5)
      }

      // Ritmo Armónico Label above measure (only if it differs from the global groove)
      let rhythmLabel = ""
      const mGroove = measure.groove || 'global'
      if (mGroove === 'neutral') {
        rhythmLabel = "neutral"
      } else {
        const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
        const isDenom8 = sig.unit === 8
        const overrides = []
        const translateRhythmNameLocal = (rhythm) => {
          const base = rhythm && rhythm.startsWith('rest-') ? rhythm.substring(5) : rhythm
          if (base === 'eighth') return isDenom8 ? "Semicorcheas (x2)" : "Corcheas (x2)"
          if (base === 'sixteenth') return isDenom8 ? "Fusas (x4)" : "Semicorcheas (x4)"
          if (base === 'offbeat') return isDenom8 ? "Contratiempo de Semicorchea" : "Contratiempo"
          if (base === 'triplet') return isDenom8 ? "Tresillo de Semicorcheas (x3)" : "Tresillo (x3)"
          if (base === 'quintuplet') return isDenom8 ? "Quintillo de Semicorcheas (x5)" : "Quintillo (x5)"
          return ""
        }
        
        const measureBeats = measure.beats.slice(0, sig.beats)
        measureBeats.forEach((b, bIdx) => {
          if (b.harmonicRhythm && b.harmonicRhythm !== 'auto') {
            const inherited = GROOVE_PATTERNS[project.globalGroove || 'Ninguno']?.[bIdx] || 'quarter'
            if (b.harmonicRhythm !== inherited) {
              const name = translateRhythmNameLocal(b.harmonicRhythm)
              if (name && !overrides.includes(name)) {
                overrides.push(name)
              }
            }
          }
        })
        if (overrides.length > 0) {
          rhythmLabel = overrides.join(", ")
        }
      }
      
      if (rhythmLabel) {
        doc.setFont("helvetica", "oblique")
        doc.setFontSize(7)
        doc.setTextColor(120, 120, 120)
        const rhythmY = measure.sectionLabel ? currentY + 10.5 : currentY + 6.5
        doc.text(rhythmLabel, mStartX + 2, rhythmY)
        doc.setTextColor(0, 0, 0)
      }

      // Local Time Signature Change Indicator (PRO only, when measure.timeSignature exists)
      let timeSigOffset = 0
      const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      
      let shouldShowLocalTimeSig = false
      if (measure.timeSignature && globalMeasureIndex > 0) {
        const prevMeasure = project.measures[globalMeasureIndex - 1]
        const prevSig = prevMeasure 
          ? (prevMeasure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 })
          : { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
        if (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit) {
          shouldShowLocalTimeSig = true
        }
      }

      if (shouldShowLocalTimeSig) {
        doc.setFont("times", "bold")
        doc.setFontSize(13)
        doc.text(measure.timeSignature.beats.toString(), mStartX + 2.5, lineY - 0.5)
        doc.text(measure.timeSignature.unit.toString(), mStartX + 2.5, lineY + 4.5)
        timeSigOffset = 8 // mm of indentation for beats drawing
      }

      // 2. Acordes y Slashes
      const effectiveMeasureWidth = currentMeasureWidth - timeSigOffset
      const mergeStates = getBeatMergeState(measure, sig)
      const beatGrows = measure.beats.slice(0, sig.beats).map((b, bIdx) => {
        const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
        if (state.isMerged) return 0
        return state.flexGrow
      })
      const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
      
      let currentXOffset = 0
      measure.beats.slice(0, sig.beats).forEach((beat, bIdx) => {
        const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
        if (state.isMerged) return
        
        const currentBeatWidth = (state.flexGrow / totalGrow) * effectiveMeasureWidth
        const startXForBeats = mStartX + timeSigOffset + currentXOffset
        
        const rhythm = getEffectiveRhythm(measure, beat, bIdx)
        const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
        const hasSubdivisions = subCount > 1
        
        if (hasSubdivisions) {
          const slots = getBeatSlots(measure, beat, bIdx)
          
          // Compute visible slots for PDF layout
          const visibleSlots = []
          if (rhythm !== 'sixteenth') {
            slots.forEach((s, idx) => {
              visibleSlots.push({ ...s, originalIndex: idx, flexGrow: 1 })
            })
          } else {
            for (let i = 0; i < slots.length; i++) {
              if (slots[i].isMerged) continue
              let flexGrow = 1
              let j = i + 1
              while (j < slots.length && slots[j].isMerged) {
                flexGrow++
                j++
              }
              visibleSlots.push({ ...slots[i], originalIndex: i, flexGrow })
            }
          }

          const subWidth = currentBeatWidth / subCount
          visibleSlots.forEach((sub) => {
            const subX = startXForBeats + (sub.originalIndex * subWidth) + ((subWidth * sub.flexGrow) / 2)
            
            // Draw subdivisions line indicators at the center of the visible slot inside the staff
            if (measure.showSubdivisions !== false) {
              const subSlashX = subX
              doc.setLineWidth(0.15)
              doc.line(subSlashX - 1, lineY + 2, subSlashX + 1, lineY - 2)
            }

            if (rhythm === 'offbeat' && sub.originalIndex === 0) {
              doc.setFont("helvetica", "normal")
              doc.setFontSize(8)
              doc.setTextColor(150, 150, 150)
              doc.text("x", subX, currentY + 15, { align: "center" })
              doc.setTextColor(0, 0, 0)
            } else if (sub.isSilence || !sub.root) {
              doc.setFont("helvetica", "normal")
              doc.setFontSize(8)
              doc.setTextColor(150, 150, 150)
              doc.text("𝄾", subX, currentY + 15, { align: "center" })
              doc.setTextColor(0, 0, 0)
            }
            
            if (sub.root) {
              const chordStr = formatChord(sub)
              const split = splitChordDisplayPDF(chordStr)
              const fontSizes = getChordFontSizes(measure, sig)
              
              doc.setFont("helvetica", "bold")
              doc.setFontSize(fontSizes.main)
              if (split.bass) {
                doc.text(split.main, subX, currentY + 5.5, { align: "center" })
                doc.setFont("helvetica", "medium")
                doc.setFontSize(fontSizes.bass)
                doc.text(split.bass, subX, currentY + 9, { align: "center" })
              } else {
                doc.text(split.main, subX, currentY + 7, { align: "center" })
              }
            }
          })
        } else {
          // Draw slash or silence indicator inside staff space first!
          const beatX = startXForBeats + (currentBeatWidth / 2)
          if (measure.showObligado && beat.harmonicRhythm && !beat.root) {
            // It's a rest/silence!
            doc.setFont("helvetica", "normal")
            doc.setFontSize(10)
            doc.setTextColor(150, 150, 150)
            doc.text("𝄾", beatX, currentY + 15, { align: "center" })
            
            const figName = getRhythmDisplayIconPDF(beat.harmonicRhythm, sig.unit === 8)
            if (figName) {
              doc.setFont("helvetica", "italic")
              doc.setFontSize(6.5)
              doc.text(figName, beatX, currentY + 19, { align: "center" })
            }
            doc.setTextColor(0, 0, 0)
          } else {
            // Normal beat: draw slash on the horizontal line
            doc.setLineWidth(0.3)
            doc.line(beatX - 2, lineY + 3, beatX + 2, lineY - 3)
            
            if (measure.showObligado && beat.harmonicRhythm) {
              const figName = getRhythmDisplayIconPDF(beat.harmonicRhythm, sig.unit === 8)
              if (figName) {
                doc.setFont("helvetica", "italic")
                doc.setFontSize(6.5)
                doc.setTextColor(120, 120, 120)
                doc.text(figName, beatX, currentY + 19, { align: "center" })
                doc.setTextColor(0, 0, 0)
              }
            }
          }
          
          // Draw chord above the staff space if it exists!
          if (beat.root) {
            const chordStr = formatChord(beat)
            const split = splitChordDisplayPDF(chordStr)
            const fontSizes = getChordFontSizes(measure, sig)

            doc.setFont("helvetica", "bold")
            doc.setFontSize(fontSizes.main)
            if (split.bass) {
              doc.text(split.main, beatX, currentY + 5.5, { align: "center" })
              doc.setFont("helvetica", "medium")
              doc.setFontSize(fontSizes.bass)
              doc.text(split.bass, beatX, currentY + 9, { align: "center" })
            } else {
              doc.text(split.main, beatX, currentY + 7, { align: "center" })
            }
          }
        }
        currentXOffset += currentBeatWidth
      })

      // 3. Renderizar letra de este compás según la opción de exportación
      if (exportOption === 'chords-and-lyrics-free') {
        drawFreeLyrics(doc, measure, mStartX, currentY, currentMeasureWidth)
      } else if (exportOption === 'chords-and-lyrics-rhythm') {
        drawSyllableLyrics(doc, project, measure, globalMeasureIndex, mStartX, currentY, currentMeasureWidth, sig)
      } else if (exportOption === 'chords-and-lyrics-synced') {
        const layout = getMeasureLyricsLayoutPDF(measure, sig)
        drawSyncedLyricsForMeasure(doc, measure, layout, mStartX, currentY, currentMeasureWidth, sig, globalMeasureIndex)
      }

      // 4. Barras de compás y repeticiones
      doc.setLineWidth(0.5)
      
      const repStart = isRepeatStart(globalMeasureIndex)
      const repEndData = getRepeatEndData(globalMeasureIndex)

      // Barra izquierda del compás
      if (colIdx === 0 || repStart) {
        if (repStart) {
          doc.setLineWidth(1.5)
          doc.line(mStartX, lineY - 5, mStartX, lineY + 5) // gruesa
          doc.setLineWidth(0.3)
          doc.line(mStartX + 1.5, lineY - 5, mStartX + 1.5, lineY + 5) // fina
          // Puntos
          doc.circle(mStartX + 3, lineY - 1.5, 0.4, "F")
          doc.circle(mStartX + 3, lineY + 1.5, 0.4, "F")
        } else if (colIdx === 0) {
          doc.line(mStartX, lineY - 5, mStartX, lineY + 5)
        }
      }

      // Barra derecha del compás
      const mEndX = mStartX + currentMeasureWidth
      if (repEndData) {
        // Puntos
        doc.circle(mEndX - 3, lineY - 1.5, 0.4, "F")
        doc.circle(mEndX - 3, lineY + 1.5, 0.4, "F")
        doc.setLineWidth(0.3)
        doc.line(mEndX - 1.5, lineY - 5, mEndX - 1.5, lineY + 5) // fina
        doc.setLineWidth(1.5)
        doc.line(mEndX, lineY - 5, mEndX, lineY + 5) // gruesa
        
        // Texto (xN)
        doc.setFont("helvetica", "italic")
        doc.setFontSize(9)
        doc.text(`(x${repEndData.times || 2})`, mEndX - 2, currentY + 8, { align: "right" })
      } else {
        doc.setLineWidth(0.5)
        doc.line(mEndX, lineY - 5, mEndX, lineY + 5)
      }
    })

    // Líneas horizontales del sistema
    const endX = startX + rowMeasures.reduce((sum, _, cIdx) => sum + measureWidths[cIdx], 0)
    doc.setLineWidth(0.5)
    doc.line(startX, lineY, endX, lineY)

    currentY += currentRowHeight
  })

  // Guardar PDF
  const safeTitle = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'esquema'
  doc.save(`${safeTitle}_harmonigrid.pdf`)
}
