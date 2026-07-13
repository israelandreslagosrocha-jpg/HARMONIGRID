import { jsPDF } from "jspdf"
import { formatChord } from "./chords.js"
import { getKeySignature } from "./keySignatures.js"

const getAccidentalNotes = (type, count) => {
  const flats = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];
  const sharps = ['f#', 'c#', 'g#', 'd#', 'a#', 'e#', 'b#'];
  const base = type === 'flat' ? flats : sharps;
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = i % 7;
    const round = Math.floor(i / 7);
    let note = base[idx];
    if (round > 0) {
      note += type === 'flat' ? 'b' : '#';
    }
    result.push(note);
  }
  return result.join(',');
};

function getKeySignatureBoxText(key, scaleType) {
  const sig = getKeySignature(key, scaleType);
  if (!sig || sig.count === 0) return '';
  const symbol = sig.type === 'flat' ? 'b' : '#';
  const count = sig.count;
  const activeNotes = getAccidentalNotes(sig.type, count);
  return `${symbol} = ${count} (${activeNotes})`;
}

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

  const EIGHTH_PATTERNS = {
    '2_notes': { slots: ['note', 'note'] },
    'silence_note': { slots: ['silence', 'note'] },
    'note_silence': { slots: ['note', 'silence'] }
  }

  const TRIPLET_PATTERNS = {
    '3_notes': { slots: ['note', 'note', 'note'] },
    'silencia_1': { slots: ['silence', 'note', 'note'] },
    'silencia_2': { slots: ['note', 'silence', 'note'] },
    'silencia_3': { slots: ['note', 'note', 'silence'] },
    'silencia_1_3': { slots: ['silence', 'note', 'silence'] },
    'silencia_1_2': { slots: ['silence', 'merged', 'note'] },
    'silencia_2_3': { slots: ['note', 'silence', 'merged'] }
  }

  const SIXTEENTH_PATTERNS = {
    '4_semi': { slots: ['note', 'note', 'note', 'note'] },
    'silencio_3_semi': { slots: ['silence', 'note', 'note', 'note'] },
    'semi_silencio_2_semi': { slots: ['note', 'silence', 'note', 'note'] },
    '2_semi_silencio_semi': { slots: ['note', 'note', 'silence', 'note'] },
    '3_semi_silencio': { slots: ['note', 'note', 'note', 'silence'] },
    'corchea_2_semi': { slots: ['note', 'merged', 'note', 'note'] },
    'silencio_corchea_2_semi': { slots: ['silence', 'merged', 'note', 'note'] },
    'semi_corchea_semi': { slots: ['note', 'note', 'merged', 'note'] },
    '2_semi_corchea': { slots: ['note', 'note', 'note', 'merged'] },
    '2_semi_silencio_corchea': { slots: ['note', 'note', 'silence', 'merged'] },
    'silencio_corchea_semi': { slots: ['silence', 'note', 'merged', 'note'] },
    'corchea_punto_semi': { slots: ['note', 'merged', 'merged', 'note'] },
    'semi_corchea_punto': { slots: ['note', 'note', 'merged', 'merged'] },
    'silencio_semi_silencio_semi': { slots: ['silence', 'note', 'silence', 'note'] },
    'silencio_corchea_punto_semi': { slots: ['silence', 'merged', 'merged', 'note'] },
    'silencio_corchea_punto': { slots: ['silence', 'note', 'merged', 'merged'] }
  }

  const getLyricsEffectiveRhythmPDF = (measure, beat, beatIdx) => {
    if (!beat) return 'auto'
    if (beat.syncWithHarmonic) {
      const mainBeat = measure.beats[beatIdx]
      if (!mainBeat) return 'auto'
      return mainBeat.harmonicRhythm || 'auto'
    }
    return beat.harmonicRhythm || 'auto'
  }

  const getLyricsBeatSlotsPDF = (measure, beat, beatIdx, isDenom8) => {
    if (!beat) return []
    let rhythm = getLyricsEffectiveRhythmPDF(measure, beat, beatIdx)
    if (rhythm === 'auto') {
      rhythm = isDenom8 ? 'eighth' : 'quarter'
    }
    const subCount = getSubdivisionCount(rhythm, isDenom8, beat)
    if (subCount === 1) return []

    if (beat.syncWithHarmonic) {
      const mainBeat = measure.beats[beatIdx]
      if (mainBeat) {
        const mainRhythm = mainBeat.harmonicRhythm || 'auto'
        const mainResolved = mainRhythm === 'auto' ? (isDenom8 ? 'eighth' : 'quarter') : mainRhythm
        const mainSubCount = getSubdivisionCount(mainResolved, isDenom8, mainBeat)
        
        if (mainSubCount === subCount) {
          const mainSlots = getBeatSlots(measure, mainBeat, beatIdx)
          if (mainSlots && mainSlots.length === subCount) {
            return mainSlots.map(s => ({
              isSilence: s.isSilence || false
            }))
          }
        }
      }
    }

    if (beat.subdivisions && beat.subdivisions.length === subCount) {
      return beat.subdivisions
    }

    const slots = []
    const patKey = rhythm === 'triplet' ? (beat.tripletPattern || '3_notes') : 
                   (rhythm === 'eighth' ? (beat.eighthPattern || '2_notes') :
                   (rhythm === 'sixteenth' ? (beat.sixteenthPattern || '4_semi') : null))
    
    const pat = patKey ? (rhythm === 'triplet' ? TRIPLET_PATTERNS[patKey] :
                          (rhythm === 'eighth' ? EIGHTH_PATTERNS[patKey] :
                           (rhythm === 'sixteenth' ? SIXTEENTH_PATTERNS[patKey] : null))) : null

    for (let i = 0; i < subCount; i++) {
      if (pat) {
        const slotType = pat.slots[i]
        slots.push({
          isSilence: slotType === 'silence',
          isMerged: slotType === 'merged'
        })
      } else if (rhythm === 'offbeat' && i === 0) {
        slots.push({ isSilence: true })
      } else {
        slots.push({ isSilence: false })
      }
    }
    return slots
  }

  const getLyricsBeatSlotDurationPDF = (measure, beat, beatIdx, isDenom8) => {
    const rhythm = beat ? (beat.harmonicRhythm || 'auto') : 'auto'
    const resolvedRhythm = rhythm === 'auto' ? getLyricsEffectiveRhythmPDF(measure, beat, beatIdx) : rhythm
    const isRest = resolvedRhythm.startsWith('rest-')
    const baseRhythm = isRest ? resolvedRhythm.substring(5) : resolvedRhythm
    
    if (isDenom8) {
      if (baseRhythm === 'dotted-whole') return 12
      if (baseRhythm === 'whole') return 8
      if (baseRhythm === 'dotted-half') return 6
      if (baseRhythm === 'double') return 4
      if (baseRhythm === 'dotted-quarter') return 3
      if (baseRhythm === 'quarter') return 2
      if (baseRhythm === 'two-eighths') return 2
      if (baseRhythm === 'sixteenth') return 2
      if (baseRhythm === 'eighth') return 1
      if (baseRhythm === 'triplet') return 2
      return 1
    } else {
      if (baseRhythm === 'dotted-whole') return 6
      if (baseRhythm === 'whole') return 4
      if (baseRhythm === 'dotted-half') return 3
      if (baseRhythm === 'double') return 2
      if (baseRhythm === 'dotted-quarter') return 1.5
      if (baseRhythm === 'quarter') return 1
      return 1
    }
  }

  const getLyricsMergedBeatsPDF = (measure, sig, isDenom8) => {
    if (!measure) return []
    const numBeats = sig.beats
    
    const states = Array.from({ length: numBeats }, (_, i) => ({
      index: i,
      beat: measure.lyrics?.beats?.[i] || { subdivisions: [] },
      isMerged: false,
      durationSlots: 1
    }))
    
    for (let i = 0; i < numBeats; i++) {
      if (states[i].isMerged) continue
      const beat = states[i].beat
      const dur = getLyricsBeatSlotDurationPDF(measure, beat, i, isDenom8)
      states[i].durationSlots = dur
      for (let j = 1; j < dur; j++) {
        if (i + j < numBeats) {
          states[i + j].isMerged = true
        }
      }
    }
    
    return states
  }

  const getEffectiveRhythm = (measure, beat, beatIdx) => {
    if (!beat) return 'quarter'
    if (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto') {
      return beat.harmonicRhythm
    }
    const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
    const isDenom8 = sig.unit === 8
    const defaultRhythm = isDenom8 ? 'eighth' : 'quarter'

    const mGroove = measure.groove || 'global'
    const activeGrooveName = mGroove === 'global' ? (project.globalGroove || 'Ninguno') : mGroove
    if (activeGrooveName === 'Ninguno' || activeGrooveName === 'neutral' || mGroove === 'neutral' || mGroove === 'custom') {
      return defaultRhythm
    }

    const pattern = GROOVE_PATTERNS[activeGrooveName] || GROOVE_PATTERNS.Ninguno
    if (pattern && pattern[beatIdx]) {
      const grooveRhythm = pattern[beatIdx]
      if (isDenom8 && grooveRhythm === 'quarter') {
        return 'eighth'
      }
      return grooveRhythm
    }
    return defaultRhythm
  }

  const getRhythmDisplayIconPDF = (beat, isDenom8) => {
    if (!beat) return ''
    const rhythm = beat.harmonicRhythm || 'auto'
    const isRest = rhythm && rhythm.startsWith('rest-')
    const base = isRest ? rhythm.substring(5) : rhythm
    const prefix = isRest ? 'Silencio de ' : ''
    
    // Check for custom patterns if rhythm is eighth, sixteenth, or triplet
    if (!isRest) {
      if (base === 'eighth' && beat.eighthPattern) {
        const labels = isDenom8 ? {
          '2_notes': '2 Semicorcheas',
          'silence_note': 'Silencio - Semicorchea',
          'note_silence': 'Semicorchea - Silencio'
        } : {
          '2_notes': '2 Corcheas',
          'silence_note': 'Silencio - Corchea',
          'note_silence': 'Corchea - Silencio'
        }
        if (labels[beat.eighthPattern]) return labels[beat.eighthPattern]
      }
      if (base === 'sixteenth' && beat.sixteenthPattern) {
        const labels = {
          '4_semi': '4 Semicorcheas',
          'silencio_3_semi': 'Silencio - 3 Semicorcheas',
          'semi_silencio_2_semi': 'Semicorchea - Silencio - 2 Semicorcheas',
          '2_semi_silencio_semi': '2 Semicorcheas - Silencio - Semicorchea',
          '3_semi_silencio': '3 Semicorcheas - Silencio',
          'corchea_2_semi': 'Corchea - 2 Semicorcheas',
          'silencio_corchea_2_semi': 'Silencio - 2 Semicorcheas',
          'semi_corchea_semi': 'Semicorchea - Corchea - Semicorchea',
          '2_semi_corchea': '2 Semicorcheas - Corchea',
          '2_semi_silencio_corchea': '2 Semicorcheas - Silencio',
          'silencio_corchea_semi': 'Silencio - Corchea - Semicorchea',
          'corchea_punto_semi': 'Corchea con punto - Semicorchea',
          'semi_corchea_punto': 'Semicorchea - Corchea con punto',
          'silencio_semi_silencio_semi': 'Silencio - Semicorchea - Silencio - Semicorchea',
          'silencio_corchea_punto_semi': 'Silencio - Semicorchea',
          'silencio_corchea_punto': 'Silencio - Corchea con punto'
        }
        if (labels[beat.sixteenthPattern]) return labels[beat.sixteenthPattern]
      }
      if (base === 'triplet' && beat.tripletPattern) {
        const labels = {
          '3_notes': 'Tresillo (3 Corcheas)',
          'silencia_1': 'Silencio - 2 Corcheas',
          'silencia_2': 'Corchea - Silencio - Corchea',
          'silencia_3': '2 Corcheas - Silencio',
          'silencia_1_3': 'Silencio - Corchea - Silencio',
          'silencia_1_2': 'Silencio - Corchea',
          'silencia_2_3': 'Corchea - Silencio'
        }
        if (labels[beat.tripletPattern]) return labels[beat.tripletPattern]
      }
    }
    
    if (isDenom8) {
      if (base === 'dotted-whole') return prefix + 'Redonda c/punto'
      if (base === 'whole') return prefix + 'Redonda'
      if (base === 'dotted-half') return prefix + 'Blanca c/punto'
      if (base === 'double') return prefix + 'Blanca'
      if (base === 'dotted-quarter') return prefix + 'Negra c/punto'
      if (base === 'quarter') return prefix + 'Negra'
      if (base === 'two-eighths') return prefix + '2 Corcheas'
      if (base === 'eighth' || base === 'auto') return prefix + 'Corchea'
      if (base === 'sixteenth') return prefix + 'Semicorchea'
      if (base === 'triplet') return prefix + 'Tresillo'
    } else {
      if (base === 'dotted-whole') return prefix + 'Redonda c/punto'
      if (base === 'whole') return prefix + 'Redonda'
      if (base === 'dotted-half') return prefix + 'Blanca c/punto'
      if (base === 'double') return prefix + 'Blanca'
      if (base === 'dotted-quarter') return prefix + 'Negra c/punto'
      if (base === 'quarter' || base === 'auto') return prefix + 'Negra'
      if (base === 'eighth') return prefix + 'Corchea'
      if (base === 'sixteenth') return prefix + 'Semicorchea'
      if (base === 'triplet') return prefix + 'Tresillo'
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
      if (base === 'double' || base === 'half') return 4
      if (base === 'dotted-quarter') return 3
      if (base === 'quarter') return 2
      if (base === 'sixteenth') return 2
      if (base === 'eighth') return 1
      if (base === 'triplet') return 2
      return 1
    } else {
      if (base === 'dotted-whole') return 6
      if (base === 'whole') return 4
      if (base === 'dotted-half') return 3
      if (base === 'double' || base === 'half') return 2
      if (base === 'dotted-quarter') return 1.5
      if (base === 'quarter') return 1
      return 1
    }
  }

  const getMeasureTimeSignaturePDF = (mIdx) => {
    if (mIdx < 0 || mIdx >= project.measures.length) {
      return { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
    }
    const m = project.measures[mIdx]
    return m.timeSignature || getMeasureTimeSignaturePDF(mIdx - 1)
  }

  const getMeasureMinWidthPDF = (measure, sig, exportOption) => {
    const isDenom8 = sig.unit === 8
    let totalMinWidth = 0
    
    // Check key change spacer width
    if (measure.keyChange) {
      totalMinWidth += 120
    }
    // Check time signature change spacer width
    if (measure.timeSignature && measure.originalMeasureIndex > 0) {
      const prevSig = getMeasureTimeSignaturePDF(measure.originalMeasureIndex - 1)
      if (measure.timeSignature.beats !== prevSig.beats || measure.timeSignature.unit !== prevSig.unit) {
        totalMinWidth += 72
      }
    }

    const numBeats = sig.beats
    const measureIdx = measure.originalMeasureIndex !== undefined ? measure.originalMeasureIndex : project.measures.indexOf(measure)

    for (let bIdx = 0; bIdx < numBeats; bIdx++) {
      let beatMinWidth = 50 // base min-width in pixels
      
      // Chords width
      const chordBeat = measure.beats[bIdx] || { root: '', type: '' }
      const rhythm = getEffectiveRhythm(measure, chordBeat, bIdx)
      let chordBaseMin = 50
      if (rhythm === 'sixteenth') chordBaseMin = 112
      else if (rhythm === 'triplet') chordBaseMin = 84
      else if (rhythm === 'quintuplet') chordBaseMin = 120
      
      beatMinWidth = Math.max(beatMinWidth, chordBaseMin)
      
      // Lyrics width
      if (exportOption === 'chords-and-lyrics-rhythm' && measure.lyrics?.mode === 'rhythm') {
        const lyricsBeat = measure.lyrics.beats?.[bIdx]
        if (lyricsBeat) {
          const lRhythm = getLyricsEffectiveRhythmPDF(measure, lyricsBeat, bIdx)
          const lSlots = getLyricsBeatSlotsPDF(measure, lyricsBeat, bIdx, isDenom8)
          const isSub = lSlots.length > 0
          
          let lyrBaseMin = 50
          if (lRhythm === 'sixteenth') lyrBaseMin = 128
          else if (lRhythm === 'triplet') lyrBaseMin = 96
          else if (lRhythm === 'quintuplet') lyrBaseMin = 144
          
          let lyrWidthNeeded = lyrBaseMin
          
          if (!isSub) {
            const syl = getSyllableAtSlotPDF(project, measure, measureIdx, bIdx, null)
            if (syl && syl.text) {
              const charWidth = 8.5
              const padding = 16
              lyrWidthNeeded = Math.max(lyrWidthNeeded, syl.text.length * charWidth + padding)
            }
          } else {
            const totalFlex = lSlots.length
            let maxSubWidth = 0
            
            lSlots.forEach((sub, sIdx) => {
              const syl = getSyllableAtSlotPDF(project, measure, measureIdx, bIdx, sIdx)
              if (syl && syl.text) {
                const charWidth = 8.5
                const padding = 16
                const slotTextLen = syl.text.length + (syl.tied ? 1 : 0)
                let slotMinWidth = slotTextLen * charWidth + padding
                if (syl.isRoot) {
                  slotMinWidth += 18
                }
                const requiredBeatWidth = slotMinWidth * totalFlex
                maxSubWidth = Math.max(maxSubWidth, requiredBeatWidth)
              }
            })
            lyrWidthNeeded = Math.max(lyrWidthNeeded, maxSubWidth)
          }
          
          beatMinWidth = Math.max(beatMinWidth, lyrWidthNeeded)
        }
      }
      
      totalMinWidth += beatMinWidth
    }
    
    // Lyrics width based on text length (for free/synced modes or general text)
    if (exportOption.includes('lyrics')) {
      const rawText = measure.lyrics?.rawText || ''
      if (rawText.trim().length > 0) {
        const textPxWidth = rawText.trim().length * 6.5 + 24
        totalMinWidth = Math.max(totalMinWidth, textPxWidth)
      }
    }
    
    return totalMinWidth
  }

  const drawPDFSubdivisionPattern = (cx, cy, slots, baseRhythm, isDenom8 = false, stemDirection = 'up') => {
    doc.saveGraphicsState && doc.saveGraphicsState();
    doc.setFillColor(80, 80, 80);
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.6);

    const n = slots.length;
    const width = n === 4 ? 12 : (n === 3 ? 10 : 8);
    const xs = [];
    for (let i = 0; i < n; i++) {
      xs.push(cx - width / 2 + (i * width) / (n - 1));
    }

    const stems = [];
    const nonSilences = [];
    slots.forEach((slot, idx) => {
      const nx = xs[idx];
      if (!slot.isSilence && !slot.isMerged) {
        stems.push({ x: nx, y: cy });
        nonSilences.push({ x: nx + 1.0, y: cy });
      } else if (slot.isSilence) {
        // Draw rest
        if (baseRhythm === 'sixteenth' || (baseRhythm === 'eighth' && isDenom8)) {
          doc.circle(nx - 1, cy - 6, 0.6, 'F');
          doc.line(nx - 1, cy - 6, nx + 1, cy - 6);
          doc.line(nx + 1, cy - 6, nx - 1, cy - 3);
          doc.circle(nx - 2, cy - 3, 0.6, 'F');
          doc.line(nx - 2, cy - 3, nx, cy - 3);
          doc.line(nx, cy - 3, nx - 1.5, cy + 1);
        } else {
          doc.circle(nx - 1, cy - 5, 0.6, 'F');
          doc.line(nx - 1, cy - 5, nx + 1, cy - 5);
          doc.line(nx + 1, cy - 5, nx - 1, cy - 1);
        }
      }
    });

    const dy = stemDirection === 'down' ? 10 : -10;
    const dy2 = stemDirection === 'down' ? 7.5 : -7.5;

    stems.forEach(stem => {
      doc.line(stem.x, stem.y, stem.x, cy + dy);
    });

    if (stems.length >= 2) {
      const firstX = stems[0].x;
      const lastX = stems[stems.length - 1].x;
      doc.setLineWidth(1.2);
      doc.line(firstX, cy + dy, lastX, cy + dy);

      if (baseRhythm === 'sixteenth' || (baseRhythm === 'eighth' && isDenom8)) {
        doc.line(firstX, cy + dy2, lastX, cy + dy2);
      }
    } else if (stems.length === 1) {
      const stem = stems[0];
      const flagOffset = stemDirection === 'down' ? 3 : -3;
      doc.line(stem.x, cy + dy, stem.x + 2, cy + dy - flagOffset);
      if (baseRhythm === 'sixteenth' || (baseRhythm === 'eighth' && isDenom8)) {
        doc.line(stem.x, cy + dy2, stem.x + 2, cy + dy2 - flagOffset);
      }
    }

    // DRAW NOTEHEADS ON TOP OF STEMS
    nonSilences.forEach(ns => {
      doc.circle(ns.x, ns.y, 1.2, 'F');
    });

    if (baseRhythm === 'triplet') {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      const tripletY = stemDirection === 'down' ? cy + 13.5 : cy - 11.5;
      doc.text("3", cx, tripletY, { align: "center" });
    }

    doc.restoreGraphicsState && doc.restoreGraphicsState();
  };

  const drawPDFSingleRhythm = (cx, cy, rhythm, isDenom8 = false, stemDirection = 'up') => {
    doc.saveGraphicsState && doc.saveGraphicsState();
    doc.setFillColor(80, 80, 80);
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.6);

    const isRest = rhythm.startsWith('rest-');
    const base = isRest ? rhythm.substring(5) : rhythm;

    const dy = stemDirection === 'down' ? 10 : -10;

    if (isRest) {
      if (base === 'whole' || base === 'dotted-whole') {
        doc.rect(cx - 3, cy - 6, 6, 2, 'F');
        doc.line(cx - 5, cy - 6, cx + 5, cy - 6);
        if (base === 'dotted-whole') {
          doc.circle(cx + 4, cy - 5, 0.6, 'F');
        }
      } else if (base === 'half' || base === 'dotted-half' || base === 'double') {
        doc.rect(cx - 3, cy - 8, 6, 2, 'F');
        doc.line(cx - 5, cy - 6, cx + 5, cy - 6);
        if (base === 'dotted-half') {
          doc.circle(cx + 4, cy - 7, 0.6, 'F');
        }
      } else if (base === 'quarter' || base === 'dotted-quarter') {
        doc.setLineWidth(1.0);
        doc.line(cx - 2, cy - 8, cx + 1, cy - 5);
        doc.line(cx + 1, cy - 5, cx - 2, cy - 2);
        doc.line(cx - 2, cy - 2, cx + 1, cy);
        doc.circle(cx - 0.5, cy + 1, 0.5, 'F');
        if (base === 'dotted-quarter') {
          doc.circle(cx + 3, cy - 2, 0.6, 'F');
        }
      } else if (base === 'eighth' || base === 'dotted-eighth') {
        doc.circle(cx - 1, cy - 5, 0.6, 'F');
        doc.line(cx - 1, cy - 5, cx + 1, cy - 5);
        doc.line(cx + 1, cy - 5, cx - 1, cy - 1);
        if (base === 'dotted-eighth') {
          doc.circle(cx + 3, cy - 3, 0.6, 'F');
        }
      } else if (base === 'sixteenth' || base === 'dotted-sixteenth') {
        doc.circle(cx - 1, cy - 6, 0.6, 'F');
        doc.line(cx - 1, cy - 6, cx + 1, cy - 6);
        doc.line(cx + 1, cy - 6, cx - 1, cy - 3);
        doc.circle(cx - 2, cy - 3, 0.6, 'F');
        doc.line(cx - 2, cy - 3, cx, cy - 3);
        doc.line(cx, cy - 3, cx - 1.5, cy + 1);
        if (base === 'dotted-sixteenth') {
          doc.circle(cx + 3, cy - 1, 0.6, 'F');
        }
      } else if (base === 'triplet') {
        const mockSlots = [{ isSilence: true }, { isSilence: true }, { isSilence: true }]
        drawPDFSubdivisionPattern(cx, cy, mockSlots, 'triplet', isDenom8, stemDirection)
      }
    } else {
      if (base === 'whole' || base === 'dotted-whole') {
        doc.ellipse(cx, cy, 2.0, 1.4, 'S');
        if (base === 'dotted-whole') {
          doc.circle(cx + 3.5, cy, 0.6, 'F');
        }
      } else if (base === 'half' || base === 'dotted-half' || base === 'double') {
        // Draw stem line first
        doc.line(cx - 1.8, cy, cx - 1.8, cy + dy);
        // Fill ellipse with white and stroke with gray so the stem goes behind
        doc.setFillColor(255, 255, 255);
        doc.ellipse(cx, cy, 2.0, 1.4, 'FD');
        doc.setFillColor(80, 80, 80); // Restore fill color
        if (base === 'dotted-half') {
          doc.circle(cx + 3.5, cy, 0.6, 'F');
        }
      } else if (base === 'quarter' || base === 'dotted-quarter') {
        doc.line(cx - 1.2, cy, cx - 1.2, cy + dy);
        doc.circle(cx, cy, 1.3, 'F');
        if (base === 'dotted-quarter') {
          doc.circle(cx + 3, cy, 0.6, 'F');
        }
      } else if (base === 'two-eighths') {
        const mockSlots = [{ isSilence: false }, { isSilence: false }]
        drawPDFSubdivisionPattern(cx, cy, mockSlots, 'eighth', isDenom8, stemDirection)
      } else if (base === 'eighth' || base === 'dotted-eighth') {
        const flagOffset = stemDirection === 'down' ? 3 : -3;
        doc.line(cx - 1.2, cy, cx - 1.2, cy + dy);
        doc.line(cx - 1.2, cy + dy, cx + 0.8, cy + dy - flagOffset); // flag
        doc.circle(cx, cy, 1.3, 'F');
        if (base === 'dotted-eighth') {
          doc.circle(cx + 3, cy, 0.6, 'F'); // dot
        }
      } else if (base === 'sixteenth' || base === 'dotted-sixteenth') {
        const flagOffset = stemDirection === 'down' ? 3 : -3;
        const dy2 = stemDirection === 'down' ? 7.5 : -7.5;
        doc.line(cx - 1.2, cy, cx - 1.2, cy + dy);
        doc.line(cx - 1.2, cy + dy, cx + 0.8, cy + dy - flagOffset); // flag 1
        doc.line(cx - 1.2, cy + dy2, cx + 0.8, cy + dy2 - flagOffset); // flag 2
        doc.circle(cx, cy, 1.3, 'F');
        if (base === 'dotted-sixteenth') {
          doc.circle(cx + 3.5, cy, 0.6, 'F'); // dot
        }
      } else if (base === 'triplet') {
        const mockSlots = [{ isSilence: false }, { isSilence: false }, { isSilence: false }]
        drawPDFSubdivisionPattern(cx, cy, mockSlots, 'triplet', isDenom8, stemDirection)
      }
    }

    doc.restoreGraphicsState && doc.restoreGraphicsState();
  };

  const getDefaultGroupingPDF = (beats, unit) => {
    if (unit === 8) {
      if (beats === 6) return [3, 3]
      if (beats === 9) return [3, 3, 3]
      if (beats === 12) return [3, 3, 3, 3]
      if (beats === 5) return [3, 2]
      if (beats === 7) return [3, 2, 2]
      if (beats === 11) return [3, 3, 3, 2]
      if (beats === 13) return [3, 3, 3, 2, 2]
      if (beats === 15) return [3, 3, 3, 3, 3]
    }
    if (unit === 4) {
      if (beats === 5) return [3, 2]
      if (beats === 7) return [3, 2, 2]
    }
    return Array.from({ length: beats }, () => 1)
  }

  const getMeasureGroupingPDF = (measure, sig) => {
    if (!measure) return getDefaultGroupingPDF(sig.beats, sig.unit)
    if (!project || !project.measures) return getDefaultGroupingPDF(sig.beats, sig.unit)
    const idx = measure.originalMeasureIndex !== undefined 
      ? measure.originalMeasureIndex 
      : project.measures.findIndex(m => m.id === measure.id)
    if (idx === null || idx === undefined || idx < 0) {
      return getDefaultGroupingPDF(sig.beats, sig.unit)
    }
    for (let i = idx; i >= 0; i--) {
      const prevM = project.measures[i]
      if (prevM && prevM.grouping) {
        const sum = prevM.grouping.reduce((a, b) => a + b, 0)
        if (sum === sig.beats) {
          return prevM.grouping
        }
      }
    }
    return getDefaultGroupingPDF(sig.beats, sig.unit)
  }

  const getBeatMergeState = (measure, sig) => {
    const numBeats = sig.beats
    const isDenom8 = sig.unit === 8
    const subdivisionsOn = measure.showSubdivisions !== false
    
    const states = Array.from({ length: numBeats }, () => ({ isMerged: false, flexGrow: 1 }))
    
    if (subdivisionsOn) {
      if (measure.showObligado) {
        // Merge beats based strictly on the measure's custom subdivision grouping
        const grouping = getMeasureGroupingPDF(measure, sig)
        let accum = 0
        grouping.forEach(g => {
          const limit = Math.min(numBeats, accum + g)
          let i = accum
          while (i < limit) {
            if (states[i].isMerged) {
              i++
              continue
            }
            const beat = measure.beats[i] || { root: '', type: '' }
            if (beat.root) {
              const dur = getBeatSlotDurationPDF(measure, beat, isDenom8)
              // Solo fusionamos hasta la duración real de la figura seleccionada dentro del grupo
              const mergeLen = Math.min(limit - i, dur)
              states[i].flexGrow = mergeLen
              for (let j = 1; j < mergeLen; j++) {
                if (i + j < numBeats) {
                  states[i + j].isMerged = true
                  states[i + j].flexGrow = 0
                }
              }
              i += mergeLen
            } else {
              // Pulso vacío dentro de la subdivisión: no se fusiona, se mantiene independiente para dibujar un slash
              i++
            }
          }
          accum += g
        })
      } else {
        // Normal Mode with Subdivisions ON: do NOT merge beats, so that every beat gets drawn
        // and we can draw vertical subdivision lines at the boundaries!
      }
    } else {
      // Normal Mode with Subdivisions OFF: do not merge beats so every beat is drawn individually as a slash
    }
    return states
  }

  const getBeatSlots = (measure, beat, beatIdx) => {
    if (!beat) return []
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

  const areChordsEqual = (c1, c2) => {
    if (!c1 || !c2) return false
    if (c1.isSilence !== c2.isSilence) return false
    if (c1.isSilence) return true
    
    if (c1.root !== c2.root) return false
    if (c1.type !== c2.type) return false
    if (c1.bass !== c2.bass) return false
    if (c1.tension !== c2.tension) return false
    
    const t1 = c1.tensions || []
    const t2 = c2.tensions || []
    if (t1.length !== t2.length) return false
    
    const s1 = [...t1].sort()
    const s2 = [...t2].sort()
    return s1.every((val, index) => val === s2[index])
  }

  const isSubdivisionCollapsed = (measure, beat, beatIdx) => {
    return false
  }

  const shouldRenderAsSubdivided = (measure, beat, beatIdx) => {
    if (!measure || !beat) return false
    if (!measure.showObligado) return false
    
    const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
    const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
    const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
    const isSub = subCount > 1
    if (!isSub) return false
    
    if (isSubdivisionCollapsed(measure, beat, beatIdx)) {
      return false
    }
    
    return true
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
    
    const mIdx = measure.originalMeasureIndex !== undefined ? measure.originalMeasureIndex : measureIdx
    const slotId = subIdx !== null && subIdx !== undefined
      ? `lyrics_${mIdx}_${beatIdx}_${subIdx}`
      : `lyrics_${mIdx}_${beatIdx}`
      
    const matched = measure.lyrics.syllables.filter(s => s.rhythmEventId === slotId)
    if (matched.length > 0) {
      const joinedText = matched.map(s => s.text).join('')
      const hasTied = matched.some(s => s.tied)
      return { text: joinedText, isRoot: true, tied: hasTied, wordId: matched[0].wordId }
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
        const hasSubdivisions = shouldRenderAsSubdivided(currM, beat, b)
        
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
          return { text: '~', isRoot: false, tied: true, wordId: prevSyllable.wordId }
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
    const isDenom8 = sig ? sig.unit === 8 : false
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
      
      const states = getLyricsMergedBeatsPDF(measure, sig, isDenom8)
      for (let b = 0; b < numBeats; b++) {
        const state = states[b]
        if (!state || state.isMerged) continue
        const beat = state.beat
        const slots = getLyricsBeatSlotsPDF(measure, beat, b, isDenom8)
        const hasSubdivisions = slots.length > 0
        
        if (!hasSubdivisions) {
          if (getSyllableAtSlotPDF(project, measure, measureIdx, b, null)) {
            hasAny = true
            break
          }
        } else {
          for (let s = 0; s < slots.length; s++) {
            if (getSyllableAtSlotPDF(project, measure, measureIdx, b, s)) {
              hasAny = true
              break
            }
          }
        }
      }
      return hasAny ? 14 : 0
    }
    if (option === 'chords-and-lyrics-synced') {
      const rawText = measure.lyrics.rawText || ""
      return rawText.trim() ? 14 : 0
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
    
    const mergeStates = getLyricsMergedBeatsPDF(measure, sig, isDenom8)
    const numBeats = sig.beats
    
    const beatGrows = mergeStates.map(state => {
      if (state.isMerged) return 0
      return state.durationSlots
    })
    const totalGrow = beatGrows.reduce((sum, g) => sum + g, 0)
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    
    let currentXOffset = 0
    const itemsToRender = []

    mergeStates.forEach((state) => {
      if (state.isMerged) return
      
      const bIdx = state.index
      const beat = state.beat
      const currentBeatWidth = (state.durationSlots / totalGrow) * effectiveMeasureWidth
      const startXForBeats = mStartX + timeSigOffsetLocal + currentXOffset
      
      const rhythm = getLyricsEffectiveRhythmPDF(measure, beat, bIdx)
      const slots = getLyricsBeatSlotsPDF(measure, beat, bIdx, isDenom8)
      const hasSubdivisions = slots.length > 0
      
      if (hasSubdivisions) {
        // Draw subdivision pattern
        const cx = startXForBeats + (currentBeatWidth / 2)
        drawPDFSubdivisionPattern(cx, currentY + 25, slots, rhythm, isDenom8)
        
        // Draw syllables
        const subCount = slots.length
        const subWidth = currentBeatWidth / subCount
        slots.forEach((sub, sIdx) => {
          const subX = startXForBeats + (sIdx * subWidth) + (subWidth / 2)
          const sylData = getSyllableAtSlotPDF(project, measure, globalMeasureIndex, bIdx, sIdx)
          if (sylData) {
            itemsToRender.push({
              x: subX,
              y: currentY + 31,
              text: sylData.text,
              tied: sylData.tied,
              isRoot: sylData.isRoot,
              wordId: sylData.wordId
            })
          }
        })
      } else {
        // Draw single note
        const beatX = startXForBeats + (currentBeatWidth / 2)
        drawPDFSingleRhythm(beatX, currentY + 25, rhythm, isDenom8)
        
        // Draw syllable
        const sylData = getSyllableAtSlotPDF(project, measure, globalMeasureIndex, bIdx, null)
        if (sylData) {
          itemsToRender.push({
            x: beatX,
            y: currentY + 31,
            text: sylData.text,
            tied: sylData.tied,
            isRoot: sylData.isRoot,
            wordId: sylData.wordId
          })
        }
      }
      currentXOffset += currentBeatWidth
    })

    // Draw syllables and centered dashes for word segments
    itemsToRender.sort((a, b) => a.x - b.x)
    itemsToRender.forEach((item, idx) => {
      let textToDraw = item.text
      if (item.tied && item.isRoot) {
        textToDraw += "~"
      }
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      doc.text(textToDraw, item.x, item.y, { align: "center" })
      
      // Draw centered dash if the next syllable has the same wordId
      if (idx < itemsToRender.length - 1) {
        const nextItem = itemsToRender[idx + 1]
        if (item.wordId && nextItem.wordId && item.wordId === nextItem.wordId && item.text !== '~' && nextItem.text !== '~') {
          const midX = (item.x + nextItem.x) / 2
          doc.text("-", midX, item.y, { align: "center" })
        }
      }
    })
    
    doc.setTextColor(0, 0, 0)
    doc.setFillColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
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
    
    const isDenom8 = sig.unit === 8
    let currentXOffset = 0
    measure.beats.slice(0, sig.beats).forEach((beat, bIdx) => {
      const state = mergeStates[bIdx] || { isMerged: false, flexGrow: 1 }
      if (state.isMerged) return
      
      const currentBeatWidth = (state.flexGrow / totalGrow) * effectiveMeasureWidth
      const startXForBeats = mStartX + timeSigOffsetLocal + currentXOffset
      const beatX = startXForBeats + (currentBeatWidth / 2)
      
      // Draw rhythm figure above lyrics
      const rhythm = getEffectiveRhythm(measure, beat, bIdx)
      const slots = getBeatSlots(measure, beat, bIdx)
      const hasSubdivisions = shouldRenderAsSubdivided(measure, beat, bIdx)
      
      if (hasSubdivisions) {
        drawPDFSubdivisionPattern(beatX, currentY + 25, slots, rhythm, isDenom8)
      } else {
        drawPDFSingleRhythm(beatX, currentY + 25, rhythm, isDenom8)
      }
      
      const slotRes = layout[beat.id]
      if (slotRes && slotRes.hasLyrics) {
        if (slotRes.hasAssociated) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8.5)
          doc.setTextColor(109, 40, 217) // #6d28d9 violet accent
          
          const assocText = slotRes.associatedText || ""
          const assocWidth = doc.getTextWidth(assocText)
          doc.text(assocText, beatX, currentY + 31, { align: "center" })
          
          const preText = slotRes.preText || ""
          if (preText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8)
            doc.setTextColor(80, 80, 80)
            doc.text(preText, beatX - (assocWidth / 2) - 0.3, currentY + 31, { align: "right" })
          }
          
          const postText = slotRes.postText || ""
          if (postText) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8)
            doc.setTextColor(80, 80, 80)
            doc.text(postText, beatX + (assocWidth / 2) + 0.3, currentY + 31, { align: "left" })
          }
        } else {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.setTextColor(80, 80, 80)
          const normalText = slotRes.normalText || ""
          doc.text(normalText, beatX, currentY + 31, { align: "center" })
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
  // --- DIBUJO DE SISTEMAS (FILAS) ---
  const rows = []
  {
    let currentSystem = []
    let currentSystemWidth = 0
    
    project.measures.forEach((measure) => {
      const sig = measure.activeTimeSignature || { beats: project.timeSignature, unit: project.timeSignatureUnit || 4 }
      const measurePxWidth = getMeasureMinWidthPDF(measure, sig, exportOption)
      const measureMmWidth = measurePxWidth * (usableWidth / 800)
      
      const wouldExceedWidth = currentSystem.length > 0 && 
        (currentSystemWidth + measureMmWidth > usableWidth + 0.1)
        
      const reachedMax = currentSystem.length >= 4
      
      if (wouldExceedWidth || reachedMax) {
        rows.push(currentSystem)
        currentSystem = [measure]
        currentSystemWidth = measureMmWidth
      } else {
        currentSystem.push(measure)
        currentSystemWidth += measureMmWidth
      }
    })
    if (currentSystem.length > 0) {
      rows.push(currentSystem)
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
      // Dibujar clave / armadura de clave en un recuadro sobre la cifra indicadora
      const boxText = getKeySignatureBoxText(project.key, project.scaleType);
      if (boxText) {
        doc.saveGraphicsState && doc.saveGraphicsState();
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        const textWidth = doc.getTextWidth(boxText);
        const boxPaddingX = 2.0;
        const boxWidth = textWidth + (boxPaddingX * 2);
        const boxHeight = 5.0;
        
        // Centrar horizontalmente sobre el área de la métrica (centro aproximado x = 15)
        const boxX = 15 - (boxWidth / 2);
        const boxY = lineY - 23;
        
        // Dibujar recuadro con borde y fondo blanco
        doc.setLineWidth(0.4)
        doc.setDrawColor(80, 80, 80)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 0.8, 0.8, "FD")
        
        // Dibujar texto
        doc.setTextColor(80, 80, 80)
        doc.text(boxText, boxX + boxPaddingX, boxY + 3.6)
        doc.restoreGraphicsState && doc.restoreGraphicsState();
      }
      
      doc.setFont("times", "bold")
      doc.setFontSize(22)
      doc.text(project.timeSignature.toString(), marginX - 12, lineY - 0.5)
      doc.text((project.timeSignatureUnit || 4).toString(), marginX - 12, lineY + 6.5)
    }

    // Pre-calculate measure widths and start positions for this row
    const measureWidths = rowMeasures.map(() => usableWidth / rowMeasures.length)

    // Líneas horizontales del sistema (dibujadas antes de las notas para que queden por detrás)
    const endX = startX + rowMeasures.reduce((sum, _, cIdx) => sum + measureWidths[cIdx], 0)
    doc.saveGraphicsState && doc.saveGraphicsState();
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(startX, lineY, endX, lineY)
    doc.restoreGraphicsState && doc.restoreGraphicsState();

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
        doc.setFont("Helvetica", "Oblique")
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

        // Draw vertical subdivision group divider lines if needed
        if (measure.showSubdivisions !== false && sig.unit === 8 && bIdx > 0) {
          const grouping = getMeasureGroupingPDF(measure, sig)
          let accum = 0
          const boundaryIndices = []
          for (let g = 0; g < grouping.length - 1; g++) {
            accum += grouping[g]
            boundaryIndices.push(accum)
          }
          if (boundaryIndices.includes(bIdx)) {
            doc.saveGraphicsState && doc.saveGraphicsState()
            doc.setDrawColor(160, 100, 240) // Purple color matching the app
            doc.setLineWidth(0.4)
            doc.line(startXForBeats, lineY - 5, startXForBeats, lineY + 5)
            doc.restoreGraphicsState && doc.restoreGraphicsState()
          }
        }
        
        const rhythm = getEffectiveRhythm(measure, beat, bIdx)
        const subCount = getSubdivisionCount(rhythm, sig.unit === 8, beat)
        const hasSubdivisions = shouldRenderAsSubdivided(measure, beat, bIdx)
        
        if (hasSubdivisions) {
          const slots = getBeatSlots(measure, beat, bIdx)
          
          if (measure.showObligado) {
            const beatX = startXForBeats + (currentBeatWidth / 2)
            drawPDFSubdivisionPattern(beatX, lineY, slots, rhythm, sig.unit === 8, 'down')
          }
          
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
            if (measure.showSubdivisions !== false && !measure.showObligado) {
              const subSlashX = subX
              doc.setLineWidth(0.15)
              doc.line(subSlashX - 1, lineY + 2, subSlashX + 1, lineY - 2)
            }

            if (rhythm === 'offbeat' && sub.originalIndex === 0) {
              if (!measure.showObligado) {
                doc.setFont("helvetica", "normal")
                doc.setFontSize(8)
                doc.setTextColor(150, 150, 150)
                doc.text("x", subX, currentY + 15, { align: "center" })
                doc.setTextColor(0, 0, 0)
              }
            } else if (sub.isSilence || !sub.root) {
              if (!measure.showObligado) {
                doc.setFont("helvetica", "normal")
                doc.setFontSize(8)
                doc.setTextColor(150, 150, 150)
                doc.text("𝄾", subX, currentY + 15, { align: "center" })
                doc.setTextColor(0, 0, 0)
              }
            }
            
            if (sub.root) {
              const chordStr = formatChord(sub)
              const split = splitChordDisplayPDF(chordStr)
              const fontSizes = getChordFontSizes(measure, sig)
              
              doc.setFont("helvetica", "bold")
              doc.setFontSize(fontSizes.main)
              if (split.bass) {
                doc.text(split.main, subX, currentY + 5.5, { align: "center" })
                doc.setFont("helvetica", "normal")
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
          if (measure.showObligado) {
            if (measure.showSubdivisions !== false && !beat.root) {
              // Draw normal slash for empty subdivision slots
              doc.setLineWidth(0.3)
              doc.line(beatX - 2, lineY + 3, beatX + 2, lineY - 3)
            } else {
              drawPDFSingleRhythm(beatX, lineY, rhythm, sig.unit === 8, 'down')
            }
          } else {
            if (beat.harmonicRhythm && !beat.root) {
              // It's a rest/silence!
              doc.setFont("helvetica", "normal")
              doc.setFontSize(10)
              doc.setTextColor(150, 150, 150)
              doc.text("𝄾", beatX, currentY + 15, { align: "center" })
              
              const figName = getRhythmDisplayIconPDF(beat, sig.unit === 8)
              if (figName) {
                doc.setFont("Helvetica", "Oblique")
                doc.setFontSize(6.5)
                doc.text(figName, beatX, currentY + 19, { align: "center" })
              }
              doc.setTextColor(0, 0, 0)
            } else {
              // Normal beat: draw slash on the horizontal line
              doc.setLineWidth(0.3)
              doc.line(beatX - 2, lineY + 3, beatX + 2, lineY - 3)
              
              if (beat.harmonicRhythm) {
                const figName = getRhythmDisplayIconPDF(beat, sig.unit === 8)
                if (figName) {
                  doc.setFont("Helvetica", "Oblique")
                  doc.setFontSize(6.5)
                  doc.setTextColor(120, 120, 120)
                  doc.text(figName, beatX, currentY + 19, { align: "center" })
                  doc.setTextColor(0, 0, 0)
                }
              }
            }
          }
          
          // Draw chord above the staff space if it exists!
          const targetChord = (beat.subdivisions && beat.subdivisions.length > 0) ? beat.subdivisions[0] : beat
          if (targetChord && targetChord.root) {
            const chordStr = formatChord(targetChord)
            const split = splitChordDisplayPDF(chordStr)
            const fontSizes = getChordFontSizes(measure, sig)

            doc.setFont("helvetica", "bold")
            doc.setFontSize(fontSizes.main)
            if (split.bass) {
              doc.text(split.main, beatX, currentY + 5.5, { align: "center" })
              doc.setFont("helvetica", "normal")
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
        doc.setFont("Helvetica", "Oblique")
        doc.setFontSize(9)
        doc.text(`(x${repEndData.times || 2})`, mEndX - 2, currentY + 8, { align: "right" })
      } else {
        doc.setLineWidth(0.5)
        doc.line(mEndX, lineY - 5, mEndX, lineY + 5)
      }
    })

    currentY += currentRowHeight
  })

  // Guardar PDF
  const safeTitle = (project.title || '').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'esquema'
  doc.save(`${safeTitle}_harmonigrid.pdf`)
}
