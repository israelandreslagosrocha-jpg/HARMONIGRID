import { jsPDF } from "jspdf"
import { formatChord } from "./chords.js"

export function generatePDF(project) {
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
  const isRepeatStart = (mIdxGlobal) => project.repeats.some(r => r.startMeasure === mIdxGlobal + 1)
  const getRepeatEndData = (mIdxGlobal) => project.repeats.find(r => r.endMeasure === mIdxGlobal + 1)

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

      // 2. Acordes y Slashes
      const beatWidth = measureWidth / project.timeSignature
      measure.beats.forEach((beat, bIdx) => {
        if (beat.root) {
          let chordStr = formatChord(beat)
          if (beat.type === 'maj') chordStr = beat.root
          if (beat.type === 'min') chordStr = beat.root + 'm'
          if (beat.type === 'dim') chordStr = beat.root + 'dim'

          doc.setFont("helvetica", "bold")
          doc.setFontSize(12)
          doc.text(chordStr, mStartX + (bIdx * beatWidth) + (beatWidth / 2), currentY + 12, { align: "center" })
        }
        
        // Slashes rítmicos
        const slashX = mStartX + (bIdx * beatWidth) + (beatWidth / 2)
        doc.setLineWidth(0.3)
        doc.line(slashX - 2, lineY + 3, slashX + 2, lineY - 3)
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
