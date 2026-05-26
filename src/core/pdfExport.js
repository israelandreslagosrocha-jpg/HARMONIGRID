import { jsPDF } from "jspdf"
import { formatChord } from "./chords.js"

export function generatePDF(project) {
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

  const getSubdivisionCount = (rhythm) => {
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

  const getBeatSlots = (measure, beat, beatIdx) => {
    const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
    const subCount = getSubdivisionCount(rhythm)
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
          bass: isPrimary ? beat.bass : null
        })
      }
    }
    return slots
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
  const rowHeight = 25 // Espacio total vertical por sistema
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
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text("HarmoniGrid By TeomusicRecords", pageWidth / 2, pageHeight - 15, { align: "center" })

  // --- DIBUJO DE SISTEMAS (FILAS) ---
  const rows = []
  for (let i = 0; i < project.measures.length; i += measuresPerRow) {
    rows.push(project.measures.slice(i, i + measuresPerRow))
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
    if (currentY + rowHeight > pageHeight - 30) {
      doc.addPage()
      currentY = marginY + 10
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("HarmoniGrid By TeomusicRecords", pageWidth / 2, pageHeight - 15, { align: "center" })
      doc.setLineWidth(0.5)
    }

    const startX = marginX
    const lineY = currentY + lineYOffset
    const absoluteRowStartIndex = rowIdx * measuresPerRow

    // Información de Cifra indicadora y Tonalidad (Solo en la primera fila, dibujada ANTES del sistema)
    if (rowIdx === 0) {
      // Dibujar clave / armadura de clave
      if (project.keySignatureStr) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(14)
        // Dibujamos la armadura un poco más arriba y a la izquierda
        doc.text(project.keySignatureStr, marginX - 16, lineY - 6)
      }
      
      doc.setFont("times", "bold")
      doc.setFontSize(22)
      doc.text(project.timeSignature.toString(), marginX - 12, lineY - 0.5)
      doc.text("4", marginX - 12, lineY + 6.5)
    }

    // 1. Acordes y Secciones
    rowMeasures.forEach((measure, colIdx) => {
      const globalMeasureIndex = absoluteRowStartIndex + colIdx
      const mStartX = startX + (colIdx * measureWidth)

      // Casilla Brackets (Modo Compacto)
      const casillaData = getCasillaData(globalMeasureIndex)
      if (casillaData) {
        const bracketY = currentY - 2
        const hookLength = 2.5
        
        doc.setLineWidth(0.4)
        doc.line(mStartX, bracketY, mStartX + measureWidth, bracketY) // horizontal line
        
        if (casillaData.isStart) {
          doc.line(mStartX, bracketY, mStartX, bracketY + hookLength) // left hook
          
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8)
          const label = casillaData.type === 1 ? `1. (x${casillaData.times || 2})` : "2."
          doc.text(label, mStartX + 1.5, bracketY - 1)
        }
        if (casillaData.isEnd) {
          doc.line(mStartX + measureWidth, bracketY, mStartX + measureWidth, bracketY + hookLength) // right hook
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
        const overrides = []
        const translateRhythmNameLocal = (rhythm) => {
          if (rhythm === 'eighth') return "Corcheas (x2)"
          if (rhythm === 'sixteenth') return "Semicorcheas (x4)"
          if (rhythm === 'offbeat') return "Contratiempo"
          if (rhythm === 'triplet') return "Tresillo (x3)"
          if (rhythm === 'quintuplet') return "Quintillo (x5)"
          return ""
        }
        
        measure.beats.forEach((b, bIdx) => {
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

      // 2. Acordes y Slashes
      const beatWidth = measureWidth / project.timeSignature
      measure.beats.forEach((beat, bIdx) => {
        const rhythm = getEffectiveRhythm(measure, beat, bIdx)
        const subCount = getSubdivisionCount(rhythm)
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

          const subWidth = beatWidth / subCount
          visibleSlots.forEach((sub) => {
            const subX = mStartX + (bIdx * beatWidth) + (sub.originalIndex * subWidth) + ((subWidth * sub.flexGrow) / 2)
            
            if (rhythm === 'offbeat' && sub.originalIndex === 0) {
              doc.setFont("helvetica", "normal")
              doc.setFontSize(8)
              doc.setTextColor(150, 150, 150)
              doc.text("x", subX, currentY + 12, { align: "center" })
              doc.setTextColor(0, 0, 0)
            } else if (sub.isSilence) {
              doc.setFont("helvetica", "normal")
              doc.setFontSize(8)
              doc.setTextColor(150, 150, 150)
              doc.text("𝄾", subX, currentY + 12, { align: "center" })
              doc.setTextColor(0, 0, 0)
            } else if (sub.root) {
              const chordStr = formatChord(sub)
              doc.setFont("helvetica", "bold")
              const effSubCount = subCount / sub.flexGrow
              doc.setFontSize(effSubCount >= 4 ? 7 : (effSubCount >= 3 ? 9 : 10))
              doc.text(chordStr, subX, currentY + 12, { align: "center" })
            }
            
            // Draw subdivisions line indicators at the center of the visible slot
            const subSlashX = mStartX + (bIdx * beatWidth) + (sub.originalIndex * subWidth) + ((subWidth * sub.flexGrow) / 2)
            doc.setLineWidth(0.15)
            doc.line(subSlashX - 1, lineY + 2, subSlashX + 1, lineY - 2)
          })
        } else {
          if (beat.root) {
            const chordStr = formatChord(beat)

            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            doc.text(chordStr, mStartX + (bIdx * beatWidth) + (beatWidth / 2), currentY + 12, { align: "center" })
          }
          
          // Slashes rítmicos
          const slashX = mStartX + (bIdx * beatWidth) + (beatWidth / 2)
          doc.setLineWidth(0.3)
          doc.line(slashX - 2, lineY + 3, slashX + 2, lineY - 3)
        }
      })

      // 3. Barras de compás y repeticiones
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
      const mEndX = mStartX + measureWidth
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
    const endX = startX + (rowMeasures.length * measureWidth)
    doc.setLineWidth(0.5)
    doc.line(startX, lineY, endX, lineY)

    currentY += rowHeight
  })

  // Guardar PDF
  const safeTitle = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'esquema'
  doc.save(`${safeTitle}_harmonigrid.pdf`)
}
