import { jsPDF } from 'jspdf'
import { SCALES, getScaleNotes, getDiatonicChords } from './scales.js'
import { NOTE_TO_INDEX } from './notes.js'

export const LEARNING_RESOURCES = [
  { id: 'tonalidad', title: 'Entiende tu tonalidad', description: 'Notas, grados y acordes de tu escala.' },
  { id: 'funciones', title: 'Reposo, preparación y tensión', description: 'Un mapa para comprender las funciones armónicas.' },
  { id: 'escucha', title: 'Crea y escucha', description: 'Un ejercicio breve para explorar en la app.' }
]
const spanish = note => note.replace(/^[CDEFGAB]/, letter => ({C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'})[letter])
// PDF base fonts do not include musical flat glyphs. ASCII b preserves meaning.
const printable = text => text.replaceAll('♭','b').replaceAll('♯','#').replaceAll('°',' dim').replaceAll('–','-').replaceAll('→',' > ')

export function createLearningPdf({ tonic, scale, resource, logo }) {
  if (!['major','minor'].includes(scale) || NOTE_TO_INDEX[tonic] === undefined || !LEARNING_RESOURCES.some(item => item.id === resource)) {
    throw new Error('Recurso educativo o tonalidad no disponible.')
  }
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const minor = scale === 'minor'
  const notes = getScaleNotes(tonic, scale)
  const chords = getDiatonicChords(tonic, scale, 'triad')
  const label = `${spanish(tonic)} ${SCALES[scale].name}`
  const title = LEARNING_RESOURCES.find(item => item.id === resource).title
  doc.setProperties({title:`HarmoniGrid | ${title} | ${label}`,author:'HarmoniGrid',subject:'Compone - Aprende - Organiza',creator:'HarmoniGrid'})
  doc.setFillColor('#101710'); doc.rect(0,0,210,66,'F')
  doc.setFillColor('#B8F500'); doc.rect(0,0,210,4,'F')
  if (logo) doc.addImage(logo,'JPEG',170,12,24,24)
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor('#B8F500'); doc.text('HARMONIGRID',16,18)
  doc.setFontSize(8); doc.setTextColor('#FFFFFF'); doc.text('COMPONE - APRENDE - ORGANIZA',16,25)
  doc.setFontSize(24); doc.text(doc.splitTextToSize(title,145),16,40)
  doc.setFontSize(10); doc.setTextColor('#B8F500'); doc.text(label,16,61)
  let y = 77
  const heading = text => { doc.setTextColor('#172115'); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(text,16,y); y+=8 }
  const paragraph = text => { doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor('#35402F'); const lines=doc.splitTextToSize(printable(text),176); doc.text(lines,16,y); y+=lines.length*5+5 }
  const band = text => { doc.setFillColor('#ECF8D4'); doc.roundedRect(16,y-4,178,15,3,3,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor('#172115'); doc.text(printable(text),21,y+5); y+=23 }
  if (resource === 'tonalidad') {
    heading('01 / Una escala, un centro de referencia')
    paragraph('La tónica es el centro alrededor del que organizas la música. Una escala ofrece una colección de notas; la melodía y la armonía ayudan a afirmar ese centro.')
    band(`${notes.map(spanish).join(' - ')} - ${spanish(tonic)}`)
    paragraph(`Fórmula: ${SCALES[scale].formula}. T = tono (dos semitonos); S = semitono, la distancia entre dos teclas contiguas del piano, blancas o negras.`)
    heading('02 / Construye tus tríadas')
    paragraph(`Toma una nota, salta una y toma la siguiente; repite hasta reunir tres. Sobre ${spanish(tonic)}: ${[notes[0],notes[2],notes[4]].map(spanish).join(' + ')} = ${chords[0].label}.`)
    doc.setFillColor('#172115'); doc.rect(16,y-4,178,9,'F'); doc.setTextColor('#FFFFFF'); doc.setFontSize(9); doc.text('GRADO',20,y+2); doc.text('ACORDE',64,y+2); doc.text('NOTA DEL GRADO',116,y+2); y+=12
    chords.forEach((chord,i)=>{ doc.setFillColor(i%2?'#FFFFFF':'#F4F7EF'); doc.rect(16,y-5,178,9,'F'); doc.setFont('helvetica','normal'); doc.setTextColor('#172115'); doc.text(printable(chord.degreeNumeral),20,y+1); doc.text(chord.label,64,y+1); doc.text(spanish(notes[i]),116,y+1); y+=9 })
    y+=6; paragraph(minor ? 'bIII, bVI y bVII comparan posiciones con la escala mayor de la misma tónica: no implican un bemol escrito en cada nota.' : 'Los números romanos en mayúsculas indican acordes mayores; en minúsculas, menores. dim indica un acorde disminuido.')
  } else if (resource === 'funciones') {
    heading('01 / Reposo: la tónica')
    paragraph(`${chords[0].label} (${minor?'i':'I'}) puede sentirse como llegar a casa. Escucha dónde una frase parece descansar, además de mirar sus acordes.`)
    heading('02 / Preparación: la subdominante')
    paragraph(`${chords[3].label} y ${chords[1].label} pueden preparar el camino hacia una dominante. Esta función también recibe el nombre de predominante.`)
    heading('03 / Tensión y regreso')
    paragraph(minor ? `En menor natural el quinto grado, ${chords[4].label}, es menor y no tiene sensible. En armonía tonal menor suele elevarse el séptimo grado para formar V o V7: incorpora una nota fuera de esta escala natural.` : `${chords[4].label} (V) y ${chords[6].label} (vii disminuido) suelen conducir hacia ${chords[0].label}. La sensible ${spanish(notes[6])} está a un semitono de ${spanish(tonic)} y suele ascender hacia ella.`)
    band([0,3,4,0].map(i=>chords[i].label).join(' > '))
    paragraph(minor ? 'El ejemplo usa i - iv - v - i: su quinto es menor. No representa la cadencia con V mayor y sensible elevada.' : 'I - IV - V - I permite explorar reposo, preparación, tensión y regreso. También puedes ir de I directamente a V y volver a I.')
    heading('Escucha el contexto')
    paragraph('Estas funciones describen prácticas tonales, no reglas para toda música. Inversiones, ritmo, melodía y estilo cambian el efecto. Los grados III y VI pueden prolongar una región tonal; no son sustitutos automáticos de la tónica.')
  } else {
    heading('Tu laboratorio: cuatro compases')
    band([0,3,4,0].map(i=>chords[i].label).join(' > '))
    paragraph('1. Crea cuatro compases en HarmoniGrid y escribe un acorde por compás, siguiendo el ejemplo. Elige un tempo cómodo y pulsa Play en Audio & Play.')
    paragraph('2. Escucha el primer acorde y el regreso al cuarto compás. ¿Percibes una llegada? Canta una nota que sientas como reposo.')
    paragraph('3. Termina en el tercer acorde del ejemplo. Compara: ¿sientes cierre o ganas de continuar? No hay una respuesta emocional obligatoria.')
    paragraph('4. Cambia el orden de los dos acordes centrales. Repite la escucha y describe qué cambió. Conserva la versión que mejor exprese tu idea.')
    if(minor) paragraph('Aquí el quinto acorde es menor: i - iv - v - i. La cadencia tonal i - iv - V - i usa un quinto mayor con la séptima nota de la escala elevada. Son dos colores distintos.')
    heading('Anota lo que descubriste')
    doc.setDrawColor('#B8C4AB'); for(let i=0;i<3;i++){y+=11;doc.line(16,y,194,y)} y+=15
    paragraph('Tip: cambia una sola cosa cada vez (orden, duración o tempo). Así podrás escuchar qué decisión produjo el cambio.')
  }
  if(y>265) throw new Error('El contenido supera el espacio de la ficha.')
  doc.setDrawColor('#B8F500');doc.setLineWidth(1);doc.line(16,271,194,271)
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor('#536047')
  doc.text('Recurso educativo gratuito de HarmoniGrid. Puedes compartir esta ficha conservando su autoría.',16,278)
  doc.text('Referencia docente: Music Theory for the 21st-Century Classroom, cap. Harmonic Function.',16,283)
  doc.setFont('helvetica','bold');doc.text('harmonigrid.app  |  community@harmonigrid.com',16,289)
  return doc
}
