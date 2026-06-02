// src/core/scales.js
import { getNoteName, NOTE_TO_INDEX } from './notes.js'

// Intervalos en semitonos desde la tónica
export const SCALES = {
  // Mayor / Menor (Core)
  major: {
    name: 'Mayor',
    englishName: 'Major',
    category: 'major_minor',
    isPro: false,
    intervals: [0, 2, 4, 5, 7, 9, 11],
    formula: 'T – T – S – T – T – T – S',
    characteristic: 'Escala diatónica fundamental de la música occidental.',
    explanation: 'Es la escala diatónica fundamental de la música occidental. Su estructura de intervalos de tono y semitono (T-T-S-T-T-T-S) define el modo mayor, caracterizado por una sonoridad brillante y alegre. Sus notas se organizan de forma natural siguiendo el orden del círculo de quintas.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'IV', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'm7b5' }
    ]
  },
  minor: {
    name: 'Menor Natural',
    englishName: 'Natural Minor',
    category: 'major_minor',
    isPro: false,
    intervals: [0, 2, 3, 5, 7, 8, 10],
    formula: 'T – S – T – T – S – T – T',
    characteristic: 'Escala menor relativa, también conocida como Modo Eólico.',
    explanation: 'Se construye a partir del sexto (6.º) grado de su escala mayor relativa (por ejemplo, La menor es relativa de Do Mayor). Comparte su misma armadura de clave pero inicia en su sexto grado, lo que le otorga una sonoridad melancólica, reflexiva y natural.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭III', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VI', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  
  // Modos Griegos
  dorian: {
    name: 'Dórico',
    englishName: 'Dorian',
    category: 'greek_modes',
    isPro: true,
    intervals: [0, 2, 3, 5, 7, 9, 10],
    formula: 'T – S – T – T – T – S – T',
    characteristic: 'Menor con 6.ª mayor. Carácter melancólico, folk y jazz.',
    explanation: 'Es el segundo modo de la escala mayor, construido desde el segundo (2.º) grado de la escala mayor madre (ej. Re Dórico surge de Do Mayor). Es una escala menor con la sexta nota mayor, lo que le da un toque medieval, místico y muy utilizado en el jazz y el rock clásico.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: '♭III', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'IV', triad: 'maj', tetrad: '7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭VII', triad: 'maj', tetrad: 'maj7' }
    ]
  },
  phrygian: {
    name: 'Frigio',
    englishName: 'Phrygian',
    category: 'greek_modes',
    isPro: true,
    intervals: [0, 1, 3, 5, 7, 8, 10],
    formula: 'S – T – T – T – S – T – T',
    characteristic: 'Menor con 2.ª menor. Sonido español, flamenco y misterioso.',
    explanation: 'Es el tercer modo de la escala mayor, construido desde el tercer (3.º) grado de la escala mayor madre (ej. Mi Frigio surge de Do Mayor). Es una escala menor con la segunda nota menor (segunda bemol), responsable de su carácter tenso, oscuro y de fuerte influencia flamenca o española.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: '♭II', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭III', triad: 'maj', tetrad: '7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: 'v°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭VI', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭VII', triad: 'min', tetrad: 'm7' }
    ]
  },
  lydian: {
    name: 'Lidio',
    englishName: 'Lydian',
    category: 'greek_modes',
    isPro: true,
    intervals: [0, 2, 4, 6, 7, 9, 11],
    formula: 'T – T – T – S – T – T – S',
    characteristic: 'Mayor con 4.ª aumentada (#4). Sonido etéreo, espacial y brillante.',
    explanation: 'Es el cuarto modo de la escala mayor, construido desde el cuarto (4.º) grado de la escala mayor madre (ej. Fa Lidio surge de Do Mayor). Es una escala mayor con la cuarta nota aumentada (#4), lo que genera una sonoridad sumamente brillante, de ensueño y cinematográfica.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'II', triad: 'maj', tetrad: '7' },
      { numeral: 'iii', triad: 'min', tetrad: 'm7' },
      { numeral: '#iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'V', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: 'vii', triad: 'min', tetrad: 'm7' }
    ]
  },
  mixolydian: {
    name: 'Mixolidio',
    englishName: 'Mixolydian',
    category: 'greek_modes',
    isPro: true,
    intervals: [0, 2, 4, 5, 7, 9, 10],
    formula: 'T – T – S – T – T – S – T',
    characteristic: 'Mayor con 7.ª menor. Base del Blues, Rock y Funk.',
    explanation: 'Es el quinto modo de la escala mayor, construido desde el quinto (5.º) grado de la escala mayor madre (ej. Sol Mixolidio surge de Do Mayor). Es una escala mayor con la séptima nota menor (b7), lo que suaviza la tensión final y la convierte en la escala base del blues, rock y funk.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: '7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'IV', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VII', triad: 'maj', tetrad: 'maj7' }
    ]
  },
  locrian: {
    name: 'Locrio',
    englishName: 'Locrian',
    category: 'greek_modes',
    isPro: true,
    intervals: [0, 1, 3, 5, 6, 8, 10],
    formula: 'S – T – T – S – T – T – T',
    characteristic: 'Escala disminuida inestable con 2.ª menor y 5.ª disminuida.',
    explanation: 'Es el séptimo modo de la escala mayor, construido desde el séptimo (7.º) grado de la escala mayor madre (ej. Si Locrio surge de Do Mayor). Su sonoridad es disminuida e inestable debido a que posee una quinta disminuida (b5) y una segunda menor (b2), siendo el modo más tenso de la escala mayor.',
    degrees: [
      { numeral: 'i°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭II', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: '♭V', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭VI', triad: 'maj', tetrad: '7' },
      { numeral: '♭vii', triad: 'min', tetrad: 'm7' }
    ]
  },

  // Menores Avanzadas
  harmonic_minor: {
    name: 'Menor Armónica',
    englishName: 'Harmonic Minor',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 2, 3, 5, 7, 8, 11],
    formula: 'T – S – T – T – S – 1.5T – S',
    characteristic: 'Escala menor con 7.ª mayor. Tensión de dominante fuerte.',
    explanation: 'Nace para solucionar la falta de tensión resolutiva en la menor natural, aumentando medio tono el séptimo grado (sensible) para crear un acorde de dominante fuerte. Tiene una sonoridad dramática y exótica con un intervalo de tono y medio entre el 6.º y 7.º grado.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'mM7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭III+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: '♭VI', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'dim7' }
    ]
  },
  melodic_minor: {
    name: 'Menor Melódica',
    englishName: 'Melodic Minor',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 2, 3, 5, 7, 9, 11],
    formula: 'T – S – T – T – T – T – S',
    characteristic: 'Escala menor con 6.ª y 7.ª mayores. Sonido jazz moderno.',
    explanation: 'Creada para suavizar el salto melódico de tono y medio de la menor armónica, ascendiendo también el sexto grado. En la música popular y el jazz moderno se usa tanto de subida como de bajada, siendo la madre de modos muy avanzados para improvisación.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'mM7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: '♭III+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'IV', triad: 'maj', tetrad: '7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'm7b5' }
    ]
  },

  // Modos de Menor Armónica
  locrian_sharp6: {
    name: 'Locrio ♯6',
    englishName: 'Locrian #6',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 1, 3, 5, 6, 9, 10],
    formula: 'S – T – T – S – 1.5T – S – T',
    characteristic: 'Locrio con 6.ª mayor. Segundo modo de la menor armónica.',
    explanation: 'Segundo modo de la escala menor armónica (construido sobre el II grado). Es como un locrio pero con una sexta mayor, lo que suaviza la tensión y la hace ideal para acordes menores de séptima con quinta disminuida (m7b5) con un color especial.',
    degrees: [
      { numeral: 'iø', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭II+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: '♭V', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'VI°', triad: 'dim', tetrad: 'dim7' },
      { numeral: '♭vii', triad: 'min', tetrad: 'm7' }
    ]
  },
  ionian_sharp5: {
    name: 'Jónico ♯5',
    englishName: 'Ionian #5',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 2, 4, 5, 8, 9, 11],
    formula: 'T – T – S – 1.5T – S – T – S',
    characteristic: 'Jónico con 5.ª aumentada. Tercer modo de la menor armónica.',
    explanation: 'Tercer modo de la escala menor armónica (construido sobre el III grado). Es una escala mayor con la quinta aumentada (#5), generando un sonido de acorde aumentado, misterioso, flotante y moderno.',
    degrees: [
      { numeral: 'I+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: 'III', triad: 'maj', tetrad: '7' },
      { numeral: 'IV', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'v°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'VI', triad: 'min', tetrad: 'mM7' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'm7b5' }
    ]
  },
  dorian_sharp4: {
    name: 'Dórico ♯4',
    englishName: 'Dorian #4',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 2, 3, 6, 7, 9, 10],
    formula: 'T – S – 1.5T – S – T – S – T',
    characteristic: 'Dórico con 4.ª aumentada. Sonido rumano y gitano.',
    explanation: 'Cuarto modo de la escala menor armónica (construido sobre el IV grado). Combina la melancolía del dórico con la tensión de una cuarta aumentada, típica de la música folclórica de Europa del Este (también llamada escala gitana).',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: '♭III+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '#iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭VII', triad: 'maj', tetrad: 'maj7' }
    ]
  },
  phrygian_dominant: {
    name: 'Frigio Dominante',
    englishName: 'Phrygian Dominant',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 1, 4, 5, 7, 8, 10],
    formula: 'S – 1.5T – S – T – S – T – T',
    characteristic: 'Frigio con 3.ª mayor. Exótico, usado en rock, metal y flamenco.',
    explanation: 'Quinto modo de la escala menor armónica (construido sobre el V grado, ej. Mi Frigio Dominante surge de La menor armónica). Es el modo más popular de este grupo; posee una tercera mayor combinada con una segunda menor, generando el clásico sonido exótico del flamenco, el heavy metal y las bandas sonoras.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: '7' },
      { numeral: '♭II', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'iv', triad: 'min', tetrad: 'mM7' },
      { numeral: 'v°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭VI+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭vii', triad: 'min', tetrad: 'm7' }
    ]
  },
  lydian_sharp2: {
    name: 'Lidio ♯2',
    englishName: 'Lydian #2',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 3, 4, 6, 7, 9, 11],
    formula: '1.5T – S – T – S – T – T – S',
    characteristic: 'Lidio con 2.ª aumentada. Sexto modo de la menor armónica.',
    explanation: 'Sexto modo de la escala menor armónica (construido sobre el VI grado). Es una escala mayor con una segunda aumentada (#2) y cuarta aumentada (#4), lo que produce una atmósfera sumamente inusual, dramática y mística.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♯ii°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'iii+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♯iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'V', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: 'vii', triad: 'min', tetrad: 'm7' }
    ]
  },
  ultralocrian: {
    name: 'Superlocrio Disminuido',
    englishName: 'Ultralocrian',
    category: 'harmonic_minor_modes',
    isPro: true,
    intervals: [0, 1, 3, 4, 6, 8, 9],
    formula: 'S – T – S – T – T – S – 1.5T',
    characteristic: 'Locrio disminuido. Séptimo modo de la menor armónica.',
    explanation: 'Séptimo modo de la escala menor armónica (construido sobre el VII grado). Reduce aún más el locrio disminuyendo la séptima a una séptima disminuida (bb7), ofreciendo tensión máxima sobre acordes disminuidos.',
    degrees: [
      { numeral: 'i°', triad: 'dim', tetrad: 'dim7' },
      { numeral: '♭ii', triad: 'min', tetrad: 'mM7' },
      { numeral: '♭iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭iv+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭v', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VI', triad: 'maj', tetrad: '7' },
      { numeral: '♭♭VII', triad: 'maj', tetrad: 'maj7' }
    ]
  },

  // Modos de Menor Melódica
  dorian_flat2: {
    name: 'Dórico ♭2',
    englishName: 'Dorian b2',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 1, 3, 5, 7, 9, 10],
    formula: 'S – T – T – T – T – S – T',
    characteristic: 'Dórico con 2.ª menor. Sonido moderno de jazz y fusión.',
    explanation: 'Segundo modo de la escala menor melódica (construido sobre el II grado). Es una escala menor que mezcla la tensión del frigio (b2) con la brillantez del dórico (6M), muy usada en jazz fusión e improvisación moderna.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: '♭II', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭III+', triad: 'maj', tetrad: '7' },
      { numeral: 'iv', triad: 'maj', tetrad: '7' },
      { numeral: 'v°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'VIø', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭VII', triad: 'min', tetrad: 'mM7' }
    ]
  },
  lydian_augmented: {
    name: 'Lidio Aumentado',
    englishName: 'Lydian Augmented',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 2, 4, 6, 8, 9, 11],
    formula: 'T – T – T – T – S – T – S',
    characteristic: 'Lidio con 5.ª aumentada (#5). Sonido brillante y suspendido.',
    explanation: 'Tercer modo de la escala menor melódica (construido sobre el III grado). Es un lidio con la quinta aumentada (#5), sonando de forma muy suspendida e ideal para acordes maj7(#5).',
    degrees: [
      { numeral: 'I+maj7', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'II', triad: 'maj', tetrad: '7' },
      { numeral: 'iii', triad: 'maj', tetrad: '7' },
      { numeral: '#iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '#V°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'vi', triad: 'min', tetrad: 'mM7' },
      { numeral: 'vii', triad: 'min', tetrad: 'm7' }
    ]
  },
  lydian_dominant: {
    name: 'Lidio Dominante',
    englishName: 'Lydian Dominant',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 2, 4, 6, 7, 9, 10],
    formula: 'T – T – T – S – T – S – T',
    characteristic: 'Lidio con 7.ª menor. Ideal para dominantes no funcionales.',
    explanation: 'Cuarto modo de la escala menor melódica (construido sobre el IV grado). Mezcla la cuarta aumentada (#4) con la séptima menor (b7), ideal para acordes dominantes que no resuelven a la tónica de forma convencional.',
    degrees: [
      { numeral: 'I7(#11)', triad: 'maj', tetrad: '7' },
      { numeral: 'II', triad: 'maj', tetrad: '7' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '#iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'v', triad: 'min', tetrad: 'mM7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VII', triad: 'aug', tetrad: 'maj7#5' }
    ]
  },
  mixolydian_flat6: {
    name: 'Mixolidio ♭6',
    englishName: 'Mixolydian b6',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 2, 4, 5, 7, 8, 10],
    formula: 'T – T – S – T – S – T – T',
    characteristic: 'Mixolidio con 6.ª menor. Carácter menor sobre acorde dominante.',
    explanation: 'Quinto modo de la escala menor melódica (construido sobre el V grado). Es una escala mayor con la sexta bemol (b6), dando un paso melancólico y romántico antes de resolver.',
    degrees: [
      { numeral: 'I7', triad: 'maj', tetrad: '7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'IVm', triad: 'min', tetrad: 'mM7' },
      { numeral: 'v°', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VI+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  locrian_sharp2: {
    name: 'Locrio ♯2',
    englishName: 'Locrian #2',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 2, 3, 5, 6, 8, 10],
    formula: 'T – S – T – S – T – T – T',
    characteristic: 'Locrio con 2.ª mayor. Sexto modo de la menor melódica.',
    explanation: 'Sexto modo de la escala menor melódica (construido sobre el VI grado). Es un locrio con la segunda nota mayor, lo que lo hace muy estable y la opción principal para improvisar sobre acordes semidisminuidos (m7b5).',
    degrees: [
      { numeral: 'iø', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'ii', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭III', triad: 'min', tetrad: 'mM7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: '♭V', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♭VI', triad: 'maj', tetrad: '7' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  altered: {
    name: 'Alterada',
    englishName: 'Altered',
    category: 'melodic_minor_modes',
    isPro: true,
    intervals: [0, 1, 3, 4, 6, 8, 10],
    formula: 'S – T – S – T – T – T – T',
    characteristic: 'Superlocrio. Escala de máxima tensión para dominantes alterados.',
    explanation: 'Séptimo modo de la escala menor melódica (construido sobre el VII grado). Altera todos los grados posibles (b2, #2, b5, #5, b7), siendo la escala de máxima tensión sobre acordes dominantes alterados (7alt).',
    degrees: [
      { numeral: 'i°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭ii', triad: 'min', tetrad: 'mM7' },
      { numeral: '♭iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'III+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'IV', triad: 'maj', tetrad: '7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'm7b5' }
    ]
  },

  // Simétricas
  diminished_wh: {
    name: 'Disminuida T-S',
    englishName: 'Diminished W-H',
    category: 'symmetric',
    isPro: true,
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    formula: 'T – S – T – S – T – S – T – S',
    characteristic: 'Escala simétrica de 8 notas. Tono/Semitono. Acordes disminuidos.',
    explanation: 'Escala simétrica de 8 notas construida alternando tonos y semitonos. Se repite simétricamente cada tercera menor y es la herramienta definitiva para acordes disminuidos con séptima disminuida (dim7).',
    degrees: [
      { numeral: 'i°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭iii°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'v°', triad: 'dim', tetrad: 'dim7' },
      { numeral: '♭vi°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'm7b5' }
    ]
  },
  diminished_hw: {
    name: 'Disminuida S-T',
    englishName: 'Diminished H-W',
    category: 'symmetric',
    isPro: true,
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    formula: 'S – T – S – T – S – T – S – T',
    characteristic: 'Escala simétrica de 8 notas. Semitono/Tono. Acordes dominantes alterados.',
    explanation: 'Escala simétrica de 8 notas construida alternando semitonos y tonos. Se utiliza para generar máxima tensión sobre acordes dominantes, proporcionando tensiones de novena aumentada, novena bemol y quinta bemol.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: '7' },
      { numeral: '♭II', triad: 'maj', tetrad: '7' },
      { numeral: '♭III', triad: 'maj', tetrad: '7' },
      { numeral: 'III', triad: 'maj', tetrad: '7' },
      { numeral: '#IV', triad: 'maj', tetrad: '7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'VI', triad: 'maj', tetrad: '7' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  whole_tone: {
    name: 'Tonos Enteros',
    englishName: 'Whole Tone',
    category: 'symmetric',
    isPro: true,
    intervals: [0, 2, 4, 6, 8, 10],
    formula: 'T – T – T – T – T – T',
    characteristic: 'Escala simétrica de 6 notas de tono entero. Sonido flotante/aumentado.',
    explanation: 'Escala simétrica de 6 notas compuesta exclusivamente por intervalos de tono entero (T-T-T-T-T-T). Al no tener quintas justas ni semitonos, carece de centro tonal fuerte, produciendo un sonido \'flotante\' o de ensueño típico del impresionismo.',
    degrees: [
      { numeral: 'I+', triad: 'aug', tetrad: '7#5' },
      { numeral: 'II+', triad: 'aug', tetrad: '7#5' },
      { numeral: 'III+', triad: 'aug', tetrad: '7#5' },
      { numeral: '#IV+', triad: 'aug', tetrad: '7#5' },
      { numeral: 'V+', triad: 'aug', tetrad: '7#5' },
      { numeral: '♭VII+', triad: 'aug', tetrad: '7#5' }
    ]
  },

  // Populares
  pentatonic_major: {
    name: 'Pentatónica Mayor',
    englishName: 'Major Pentatonic',
    category: 'universal',
    isPro: true,
    intervals: [0, 2, 4, 7, 9],
    formula: 'T – T – 1.5T – T – 1.5T',
    characteristic: 'Escala de 5 notas sin semitonos. Muy popular en folk y rock.',
    explanation: 'Escala de 5 notas derivada de la escala mayor eliminando el 4.º y 7.º grado (los semitonos). Al no tener intervalos disonantes, es imposible tocar una nota fuera de tono, siendo la base del folk y el pop.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' }
    ]
  },
  pentatonic_minor: {
    name: 'Pentatónica Menor',
    englishName: 'Minor Pentatonic',
    category: 'universal',
    isPro: true,
    intervals: [0, 3, 5, 7, 10],
    formula: '1.5T – T – T – 1.5T – T',
    characteristic: 'Escala de 5 notas menor. El bloque fundamental del rock y blues.',
    explanation: 'Escala de 5 notas derivada de la menor natural eliminando el 2.º y 6.º grado. Es la escala más popular de la guitarra moderna, el rock y el blues por su fluidez melódica.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: '♭III', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'iv', triad: 'min', tetrad: 'm7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  blues: {
    name: 'Blues',
    englishName: 'Blues',
    category: 'universal',
    isPro: true,
    intervals: [0, 3, 5, 6, 7, 10],
    formula: '1.5T – T – S – S – 1.5T – T',
    characteristic: 'Escala pentatónica menor con la nota de blues (♭5) añadida.',
    explanation: 'Escala pentatónica menor con la adición de la \'blue note\' (5.ª disminuida / b5). Esta nota cromática de paso le da el clásico sonido melancólico, sucio e interactivo característico del Blues y el Jazz.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'm7' },
      { numeral: '♭III', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'IV', triad: 'maj', tetrad: '7' },
      { numeral: '#iv°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VII', triad: 'maj', tetrad: '7' }
    ]
  },
  harmonic_major: {
    name: 'Mayor Armónica',
    englishName: 'Harmonic Major',
    category: 'popular',
    isPro: true,
    intervals: [0, 2, 4, 5, 7, 8, 11],
    formula: 'T – T – S – T – S – 1.5T – S',
    characteristic: 'Mayor con la sexta nota bemol (♭6). Sonoridad exótica y cinematográfica.',
    explanation: 'Variación de la escala mayor natural con el sexto grado rebajado medio tono (♭6). Aporta una sonoridad brillante pero con un matiz exótico y melancólico, muy utilizada en la rearmonización de jazz y música para cine.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'iii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iv', triad: 'min', tetrad: 'mM7' },
      { numeral: 'V', triad: 'maj', tetrad: '7' },
      { numeral: 'VI+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'dim7' }
    ]
  },
  hungarian_gypsy_minor: {
    name: 'Menor Húngara',
    englishName: 'Hungarian Gypsy Minor',
    category: 'exotic',
    isPro: true,
    intervals: [0, 2, 3, 6, 7, 8, 11],
    formula: 'T – S – 1.5T – S – S – 1.5T – S',
    characteristic: 'Doble armónica menor. Carácter extremadamente expresivo y gitano.',
    explanation: 'También conocida como escala doble menor armónica, posee dos segundas aumentadas en su estructura. Ofrece una sonoridad intensa y muy dramática, típica del folclore gitano, la música de Europa del Este y muy apreciada en el rock/metal.',
    degrees: [
      { numeral: 'i', triad: 'min', tetrad: 'mM7' },
      { numeral: 'ii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♭III+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: '♯iv°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'V', triad: 'maj', tetrad: 'maj7' },
      { numeral: '♭VI', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'vii°', triad: 'dim', tetrad: 'dim7' }
    ]
  },
  hungarian_major: {
    name: 'Mayor Húngara',
    englishName: 'Hungarian Major',
    category: 'exotic',
    isPro: true,
    intervals: [0, 3, 4, 6, 7, 9, 10],
    formula: '1.5T – S – T – S – T – S – T',
    characteristic: 'Mayor con ♯2, ♯4 y ♭7. Carácter flotante y exótico para fraseo "outside".',
    explanation: 'Escala mayor exótica que combina una segunda aumentada (♯2), una cuarta aumentada (♯4) y una séptima menor (♭7). Genera una sonoridad altamente inusual y disonante, excelente para fraseos de jazz moderno y fusión avanzada para sonar fuera de la tonalidad.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: '7' },
      { numeral: '♯II°', triad: 'dim', tetrad: 'dim7' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: '♯iv°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'V+', triad: 'aug', tetrad: 'maj7#5' },
      { numeral: 'vi', triad: 'min', tetrad: 'm7' },
      { numeral: '♭VII+', triad: 'aug', tetrad: '7' }
    ]
  },
  bebop_dominant: {
    name: 'Bebop Dominante',
    englishName: 'Bebop Dominant',
    category: 'universal',
    isPro: true,
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    formula: 'T – T – S – T – T – S – S – S',
    characteristic: 'Mixolidia con séptima mayor de paso (7M). Fundamental para el fraseo de jazz.',
    explanation: 'Escala mixolidia que incorpora la séptima mayor como nota de paso entre la séptima menor y la octava. Al tener ocho notas, permite que las notas del acorde (1, 3, 5, ♭7) caigan siempre en los tiempos fuertes al tocar corcheas, siendo la base del fraseo de jazz bebop.',
    degrees: [
      { numeral: 'I', triad: 'maj', tetrad: '7' },
      { numeral: 'ii', triad: 'min', tetrad: 'm7' },
      { numeral: 'iii°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'IV', triad: 'maj', tetrad: 'maj7' },
      { numeral: 'v', triad: 'min', tetrad: 'm7' },
      { numeral: 'vi°', triad: 'dim', tetrad: 'm7b5' },
      { numeral: 'VII', triad: 'maj', tetrad: '7' },
      { numeral: 'viii°', triad: 'dim', tetrad: 'dim7' }
    ]
  }
}

export function getScaleNotes(keyRoot, scaleType) {
  const scale = SCALES[scaleType]
  if (!scale) return []
  
  const rootIndex = NOTE_TO_INDEX[keyRoot]
  if (rootIndex === undefined) return []

  const letterNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const basePitches = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 }
  
  const rootLetter = keyRoot[0]
  const rootLetterIdx = letterNames.indexOf(rootLetter)
  
  if (rootLetterIdx !== -1) {
    let letterOffsets = null
    if (scaleType === 'altered') {
      letterOffsets = [0, 1, 2, 2, 4, 5, 6] // Do, Re♭, Mi♭, Mi, Sol♭, La♭, Si♭ (Evita Fa♭ y dobla Mi)
    } else if (scaleType === 'bebop_dominant') {
      letterOffsets = [0, 1, 2, 3, 4, 5, 6, 6] // 8 notas: Do, Re, Mi, Fa, Sol, La, Si♭, Si
    } else if (scale.intervals.length === 7) {
      letterOffsets = [0, 1, 2, 3, 4, 5, 6]
    } else if (scaleType === 'pentatonic_major') {
      letterOffsets = [0, 1, 2, 4, 5]
    } else if (scaleType === 'pentatonic_minor') {
      letterOffsets = [0, 2, 3, 4, 6]
    } else if (scaleType === 'blues') {
      letterOffsets = [0, 2, 3, 4, 4, 6]
    } else if (scaleType === 'whole_tone') {
      letterOffsets = [0, 1, 2, 3, 4, 5]
    } else if (scaleType === 'diminished_wh') {
      letterOffsets = [0, 1, 2, 3, 3, 4, 5, 6]
    } else if (scaleType === 'diminished_hw') {
      letterOffsets = [0, 1, 2, 2, 3, 4, 5, 6]
    }

    if (letterOffsets && letterOffsets.length === scale.intervals.length) {
      return scale.intervals.map((interval, i) => {
        const targetPitch = (rootIndex + interval) % 12
        const letter = letterNames[(rootLetterIdx + letterOffsets[i]) % 7]
        const basePitch = basePitches[letter]
        
        let diff = (targetPitch - basePitch) % 12
        if (diff > 6) diff -= 12
        if (diff < -6) diff += 12
        
        let accidental = ''
        if (diff > 0) {
          accidental = '#'.repeat(diff)
        } else if (diff < 0) {
          accidental = 'b'.repeat(-diff)
        }
        
        return `${letter}${accidental}`
      })
    }
  }
  
  // Fallback cromático estándar si no se encuentra mapeo de letras
  return scale.intervals.map(interval => {
    return getNoteName(rootIndex + interval, keyRoot)
  })
}

/**
 * Retorna los acordes diatónicos de una tonalidad y escala específica.
 * @param {string} keyRoot - Tónica (Ej: 'C', 'F#')
 * @param {string} scaleType - Identificador de la escala
 * @param {string} complexity - 'triad' o 'tetrad'
 */
export function getDiatonicChords(keyRoot, scaleType = 'major', complexity = 'tetrad') {
  const scale = SCALES[scaleType]
  if (!scale) return []

  const notes = getScaleNotes(keyRoot, scaleType)
  
  return scale.intervals.map((interval, i) => {
    const rootName = notes[i] || getNoteName(NOTE_TO_INDEX[keyRoot] + interval, keyRoot)
    const degree = scale.degrees[i]
    if (!degree) return null
    
    const type = degree[complexity] // ej. 'maj7' o 'maj'
    
    // Simplificamos visualmente el triad mayor para que solo muestre la raíz (ej. "C" en vez de "Cmaj")
    let labelType = type
    if (type === 'maj') labelType = ''
    else if (type === 'min') labelType = 'm'
    
    return {
      degreeNumeral: degree.numeral,
      root: rootName,
      type: type,
      label: `${rootName}${labelType}`
    }
  }).filter(Boolean)
}
