// src/core/harmonicKnowledge.js
import { transposeNote } from './notes.js'

export const HARMONIC_KNOWLEDGE = {
  // ==================== 🟡 ESCALA MAYOR ====================
  major: {
    name: 'Escala Mayor',
    version: 1,
    
    diatonic_functions: [
      { degree: 'I', function: 'Tónica', type: 'Estabilidad', explanation: 'Estabilidad tonal absoluta. Es la casa de la canción, el punto de reposo definitivo.' },
      { degree: 'ii', function: 'Subdominante', type: 'Movimiento', explanation: 'Tensión suave que prepara el movimiento hacia la dominante. Conduce con fluidez.' },
      { degree: 'iii', function: 'Tónica Extendida', type: 'Relativa', explanation: 'Estabilidad flotante. Comparte notas con la tónica, sirviendo de transición suave.' },
      { degree: 'IV', function: 'Subdominante', type: 'Preparación', explanation: 'Apertura tonal. Funciona como preparación clásica de tensión o reposo melódico.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión', explanation: 'Gran tensión que genera atracción fuerte de retorno al acorde de tónica (I).' },
      { degree: 'vi', function: 'Tónica Relativa', type: 'Descanso', explanation: 'Reposo menor. Funciona como descanso melancólico en resoluciones engañosas.' },
      { degree: 'vii°', function: 'Dominante', type: 'Máxima tensión', explanation: 'Tensión tritononal máxima. Busca resolver inmediatamente de vuelta a la tónica (I).' }
    ],

    functional_relationships: {
      'I': [
        { from: 'V', desc: 'Resolución auténtica por excelencia, de máxima tensión a reposo completo' },
        { from: 'vii°', desc: 'Resolución por semitono (sensible) con gran fricción de tritono hacia la tónica' },
        { from: 'IV', desc: 'Cadencia plagal tradicional, proporciona una sensación de reposo solemne' },
        { from: 'ii', desc: 'Conducción suave hacia el reposo final' },
        { from: 'vi', desc: 'Transición por terceras descendentes de carácter melancólico' },
        { from: 'iii', desc: 'Resolución pasiva de transición muy suave' }
      ],
      'ii': [
        { from: 'I', desc: 'Paso conjunto ascendente hacia el acorde menor de movimiento' },
        { from: 'IV', desc: 'Paso conjunto descendente o nota común que asienta la preparación' },
        { from: 'V', desc: 'Retorno desde la tensión hacia la subdominante de paso' },
        { from: 'vi', desc: 'Resolución por quintas descendentes hacia el ii grado' },
        { from: 'vii°', desc: 'Transición de tensión a movimiento' }
      ],
      'iii': [
        { from: 'I', desc: 'Ascenso suave que mantiene notas de la tónica' },
        { from: 'ii', desc: 'Ascenso de tono completo hacia la tónica extendida' },
        { from: 'IV', desc: 'Medio tono descendente directo hacia la relativa menor' },
        { from: 'V', desc: 'Tensión dominante que desciende hacia la tónica extendida' },
        { from: 'vi', desc: 'Paso conjunto ascendente hacia la relativa' }
      ],
      'IV': [
        { from: 'I', desc: 'Apertura hacia el acorde de preparación' },
        { from: 'ii', desc: 'Paso conjunto ascendente hacia el IV grado' },
        { from: 'iii', desc: 'Paso conjunto descendente' },
        { from: 'V', desc: 'Dominante que retrocede a la subdominante' },
        { from: 'vi', desc: 'Quinta descendente directa' },
        { from: 'vii°', desc: 'Suavización de la tensión hacia la preparación' }
      ],
      'V': [
        { from: 'I', desc: 'Paso hacia la tensión principal de la escala' },
        { from: 'ii', desc: 'Quinta descendente directa, la transición más común de preparación a tensión' },
        { from: 'iii', desc: 'Movimiento de tercera' },
        { from: 'IV', desc: 'Paso conjunto ascendente directo' },
        { from: 'vi', desc: 'Paso conjunto descendente hacia la dominante' },
        { from: 'vii°', desc: 'Mantiene la función de tensión' }
      ],
      'vi': [
        { from: 'I', desc: 'Caída de tercera menor hacia la tónica relativa' },
        { from: 'ii', desc: 'Paso conjunto descendente' },
        { from: 'iii', desc: 'Paso por quintas descendentes muy melódico' },
        { from: 'IV', desc: 'Paso por terceras' },
        { from: 'V', desc: 'Resolución engañosa clásica, desvía la tensión a un reposo menor' },
        { from: 'vii°', desc: 'Resolución de tensión' }
      ],
      'vii°': [
        { from: 'I', desc: 'Paso conjunto descendente' },
        { from: 'ii', desc: 'Paso conjunto' },
        { from: 'iii', desc: 'Paso por quintas' },
        { from: 'IV', desc: 'Movimiento' },
        { from: 'V', desc: 'Mantiene la tensión' },
        { from: 'vi', desc: 'Paso conjunto' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_ii',
        category: 'secondary_dominant',
        target_degree: 'ii',
        function: 'V/ii',
        explanation: 'Dominante secundario que resuelve al ii grado (acorde menor de movimiento).',
        variants: ['7', '9', '13', 'b9', '#9', '#11', 'b13', 'alt', 'sus4', '13sus'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_iii',
        category: 'secondary_dominant',
        target_degree: 'iii',
        function: 'V/iii',
        explanation: 'Dominante secundario que resuelve al iii grado (tónica extendida o menor relativa).',
        variants: ['7', '9', '13', 'b9', '#9', 'b13', 'alt', 'sus4'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'B7 ➔ Em'
      },
      {
        id: 'V_IV',
        category: 'secondary_dominant',
        target_degree: 'IV',
        function: 'V/IV',
        explanation: 'Dominante secundario que resuelve al IV grado (subdominante de preparación). En tono mayor, equivale al primer grado diatónico convertido en dominante de paso.',
        variants: ['7', '9', '13', 'b9', '#9', '#11', 'sus4'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'C7 ➔ F'
      },
      {
        id: 'V_V',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Dominante secundario que resuelve al V grado (dominante principal). Es el clásico "doble dominante".',
        variants: ['7', '9', '13', 'b9', '#9', '#11', 'alt', 'sus4', '13sus'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'D7 ➔ G'
      },
      {
        id: 'V_vi',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario que resuelve al vi grado (tónica relativa de descanso menor). Es una de las modulaciones pasajeras más hermosas.',
        variants: ['7', '9', '13', 'b9', '#9', 'b13', 'alt', 'sus4'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_vii',
        category: 'secondary_dominant',
        target_degree: 'vii°',
        function: 'V/vii°',
        explanation: 'Dominante secundario que resuelve al vii° grado. Genera máxima inestabilidad.',
        variants: ['7', 'b9', '#9', 'alt'],
        styles: ['jazz', 'gospel'],
        example: 'F#7 ➔ Bdim'
      }
    ],

    modal_interchange: [
      {
        id: 'iv_minor',
        category: 'modal_interchange',
        source_scale: 'parallel_minor',
        degree: 'iv',
        function: 'Subdominante emocional',
        explanation: 'Acorde prestado del modo menor paralelo. Introduce la sexta menor de la escala, aportando melancolía y una resolución suave por semitono hacia la tónica.',
        styles: ['pop', 'baladas', 'gospel', 'cine'],
        example: 'Fm en C Mayor'
      },
      {
        id: 'bVI',
        category: 'modal_interchange',
        source_scale: 'parallel_minor',
        degree: 'bVI',
        function: 'Color cinematográfico',
        explanation: 'Acorde prestado del modo menor paralelo. Ofrece un brillo majestuoso, inesperado y épico, muy utilizado para transiciones visuales en el cine.',
        styles: ['soundtrack', 'rock', 'pop', 'cine'],
        example: 'Abmaj7 en C Mayor'
      },
      {
        id: 'bVII',
        category: 'modal_interchange',
        source_scale: 'parallel_minor',
        degree: 'bVII',
        function: 'Backdoor dominant / Color modal',
        explanation: 'Acorde prestado del modo menor paralelo. Actúa como dominante no funcional de paso o acorde backdoor que resuelve hacia la tónica.',
        styles: ['rock', 'soul', 'blues', 'gospel'],
        example: 'Bbmaj7 en C Mayor'
      },
      {
        id: 'ii_dim',
        category: 'modal_interchange',
        source_scale: 'parallel_minor',
        degree: 'ii°',
        function: 'Tensión modal',
        explanation: 'Acorde disminuido o semidisminuido prestado del menor paralelo, ideal para sustituir al ii grado antes de ir al V dominante.',
        styles: ['pop', 'jazz', 'gospel'],
        example: 'Ddim en C Mayor'
      },
      {
        id: 'i_minor',
        category: 'modal_interchange',
        source_scale: 'parallel_minor',
        degree: 'i',
        function: 'Cambio dramático',
        explanation: 'Conversión directa de la tónica en menor, oscureciendo temporalmente la atmósfera armónica de manera súbita.',
        styles: ['pop', 'rock', 'cine'],
        example: 'Cm en C Mayor'
      },
      {
        id: 'V_aug',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'V+',
        function: 'Tensión aumentada',
        explanation: 'Acorde de dominante aumentado prestado de la escala menor armónica, que incrementa la tensión antes de resolver.',
        styles: ['jazz', 'gospel', 'fusion'],
        example: 'G+ en C Mayor'
      },
      {
        id: 'vii_dim7',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'vii°7',
        function: 'Tensión simétrica disminuida',
        explanation: 'Acorde de séptima disminuida del séptimo grado prestado de la menor armónica, con máxima tensión tritononal.',
        styles: ['jazz', 'cine', 'gospel'],
        example: 'Bdim7 en C Mayor'
      },
      {
        id: 'ii_minor7',
        category: 'modal_interchange',
        source_scale: 'melodic_minor',
        degree: 'ii',
        function: 'Suavidad Dórica',
        explanation: 'Acorde de segundo grado menor con sonoridad dórica prestado de la menor melódica.',
        styles: ['jazz', 'fusion'],
        example: 'Dm7 en C Mayor'
      },
      {
        id: 'IV_aug',
        category: 'modal_interchange',
        source_scale: 'melodic_minor',
        degree: 'IV+',
        function: 'Brillo Lidio aumentado',
        explanation: 'Acorde de cuarto grado aumentado prestado de la menor melódica.',
        styles: ['jazz', 'fusion'],
        example: 'F+ en C Mayor'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_superior',
        category: 'chromatic_approach',
        name: 'Aproximación Superior',
        explanation: 'Aproximarse al acorde de destino desde un semitono arriba (X + 1 semitono ➔ Destino).',
        example: 'Cm7 ➔ Bm'
      },
      {
        id: 'approach_inferior',
        category: 'chromatic_approach',
        name: 'Aproximación Inferior',
        explanation: 'Aproximarse al acorde de destino desde un semitono abajo (X - 1 semitono ➔ Destino).',
        example: 'A#m7 ➔ Bm'
      },
      {
        id: 'approach_enclosure',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Rodear el acorde objetivo atacando un semitono por arriba, luego un semitono por abajo y finalmente resolver (X+1 ➔ X-1 ➔ Destino).',
        example: 'Cm7 ➔ A#m7 ➔ Bm'
      },
      {
        id: 'approach_diminished',
        category: 'chromatic_approach',
        name: 'Disminuido de Aproximación',
        explanation: 'Sustituto de dominante simétrico disminuido que resuelve desde medio tono abajo.',
        example: 'A#dim7 ➔ Bm'
      },
      {
        id: 'approach_dominant',
        category: 'chromatic_approach',
        name: 'Dominante Cromático',
        explanation: 'Resolución cromática directa usando un acorde de séptima dominante a medio tono de distancia.',
        example: 'C7 ➔ Bm'
      },
      {
        id: 'approach_tritone',
        category: 'chromatic_approach',
        name: 'Sustitución por Tritono (Tritone Sub)',
        explanation: 'Aproximación cromática por semitono descendente desde un acorde dominante, sustituyendo al dominante principal (V) o secundario.',
        example: 'C7 ➔ Bm (sustituye a F#7 ➔ Bm)'
      }
    ],

    cadences: [
      {
        id: 'cad_perfect',
        category: 'cadence',
        name: 'Cadencia Auténtica Perfecta',
        degrees: ['V', 'I'],
        explanation: 'Resolución clásica y definitiva del acorde de dominante al de tónica, ambos en estado fundamental.',
        tension: 'Alta'
      },
      {
        id: 'cad_imperfect',
        category: 'cadence',
        name: 'Cadencia Auténtica Imperfecta',
        degrees: ['V7', 'I'],
        explanation: 'Resolución de dominante de séptima a tónica, aportando una sensación de conclusión pero con movimiento de voces melódico.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_plagal',
        category: 'cadence',
        name: 'Cadencia Plagal',
        degrees: ['IV', 'I'],
        explanation: 'Efecto "Amén". Resolución solemne y suave desde el cuarto grado a la tónica.',
        tension: 'Baja'
      },
      {
        id: 'cad_deceptive',
        category: 'cadence',
        name: 'Cadencia Engañosa',
        degrees: ['V', 'vi'],
        explanation: 'Desvía la tensión del dominante hacia la relativa menor (vi) en vez de resolver a la tónica esperada.',
        tension: 'Media'
      },
      {
        id: 'cad_half',
        category: 'cadence',
        name: 'Semicadencia',
        degrees: ['I', 'V'],
        explanation: 'Reposo en suspenso sobre el acorde de dominante, dejando la frase musical abierta a continuación.',
        tension: 'Media'
      },
      {
        id: 'cad_extended',
        category: 'cadence',
        name: 'Cadencia ii–V–I',
        degrees: ['ii', 'V', 'I'],
        explanation: 'El bloque fundamental de jazz y música moderna. Prepara la tensión y resuelve con fluidez extrema.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_turnaround',
        category: 'cadence',
        name: 'Turnaround (I–vi–ii–V)',
        degrees: ['I', 'vi', 'ii', 'V'],
        explanation: 'Estructura cíclica para retornar de forma infinita a la tónica y reiniciar el verso.',
        tension: 'Media'
      },
      {
        id: 'cad_circle',
        category: 'cadence',
        name: 'Círculo de Cuartas / Quintas (iii–vi–ii–V–I)',
        degrees: ['iii', 'vi', 'ii', 'V', 'I'],
        explanation: 'Progresión por quintas descendentes que abarca casi toda la diatónica con lógica armónica perfecta.',
        tension: 'Media-Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_sec_dom',
        category: 'reharmonization',
        name: 'Dominante Secundario',
        explanation: 'Anteponer el acorde de séptima dominante correspondiente al acorde objetivo para forzar su resolución.',
        example: 'F#7 ➔ Bm'
      },
      {
        id: 'reharm_ii_v_sec',
        category: 'reharmonization',
        name: 'ii-V Secundario',
        explanation: 'Insertar un acorde menor o semidisminuido preparando el dominante secundario para formar una cadencia ii-V-I local.',
        example: 'C#m7b5 ➔ F#7 ➔ Bm'
      },
      {
        id: 'reharm_tritone',
        category: 'reharmonization',
        name: 'Sustituto Tritonal (Tritone Sub)',
        explanation: 'Reemplazar un acorde dominante por otro dominante a distancia de tritono, que comparte sus mismas notas guías pero ofrece una línea de bajo cromática descendente.',
        example: 'C7 ➔ Bm'
      },
      {
        id: 'reharm_backdoor',
        category: 'reharmonization',
        name: 'Backdoor Resolution',
        explanation: 'Resolución de dominante alternativa usando un bVII7 para volver a la tónica (equivalente a un IVm invertido).',
        example: 'Bb7 ➔ C'
      },
      {
        id: 'reharm_chained_dom',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Progresión cíclica de acordes dominantes que resuelven sucesivamente por quintas descendentes.',
        example: 'E7 ➔ A7 ➔ D7 ➔ G'
      },
      {
        id: 'reharm_passing_dim',
        category: 'reharmonization',
        name: 'Disminuido de Paso',
        explanation: 'Intercalar un acorde disminuido de paso para suavizar la conducción melódica de bajos entre dos acordes diatónicos separados por un tono.',
        example: 'G ➔ G#dim ➔ Am'
      },
      {
        id: 'reharm_passing_chrom',
        category: 'reharmonization',
        name: 'Passing Chord Cromático',
        explanation: 'Intercalar un acorde de paso diatónico o cromático para dinamizar la progresión.',
        example: 'C ➔ C#dim ➔ Dm'
      },
      {
        id: 'reharm_gospel_walk',
        category: 'reharmonization',
        name: 'Gospel Walk-Up',
        explanation: 'Línea de bajo ascendente con inversiones sobre acorde de pedal de tónica.',
        example: 'C ➔ Dm/C ➔ Em/C ➔ F'
      }
    ]
  },

  // ==================== 🔵 ESCALA MENOR NATURAL (EÓLICA) ====================
  minor: {
    name: 'Escala Menor Natural',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Tónica', type: 'Estabilidad', explanation: 'Estabilidad de reposo menor. Centro tonal melancólico y principal de la escala.' },
      { degree: 'ii°', function: 'Subdominante débil', type: 'Movimiento', explanation: 'Inestabilidad disminuida. Prepara la tensión conduciendo con fricción hacia el dominante.' },
      { degree: '♭III', function: 'Tónica extendida', type: 'Relativa', explanation: 'Relativa mayor. Ofrece un reposo alternativo y brillante con notas comunes de la tónica.' },
      { degree: 'iv', function: 'Subdominante', type: 'Preparación', explanation: 'Subdominante menor. Genera una tensión suave de preparación melancólica.' },
      { degree: 'v', function: 'Dominante modal', type: 'Tensión moderada', explanation: 'Dominante modal menor. Carece de la sensible de la menor armónica, brindando una tensión suave.' },
      { degree: '♭VI', function: 'Tónica coloreada', type: 'Descanso', explanation: 'Reposo relativo de color majestuoso. Conduce con fluidez hacia el ♭VII o el iv.' },
      { degree: '♭VII', function: 'Dominante modal', type: 'Movimiento', explanation: 'Dominante de paso modal. Característico de la sonoridad menor natural o rock.' }
    ],

    functional_relationships: {
      'i': [
        { from: 'v', desc: 'Resolución modal suave sin sensible, típica del folk y la música antigua' },
        { from: '♭VII', desc: 'Cadencia modal clásica del rock o pop, resuelve con suavidad por tono entero descendente en el bajo' },
        { from: 'iv', desc: 'Cadencia plagal menor, aporta una sensación de reposo sumamente melancólica' },
        { from: 'ii°', desc: 'Resolución directa de preparación disminuida hacia el reposo menor' },
        { from: '♭VI', desc: 'Caída de tercera descendente muy coloreada' },
        { from: '♭III', desc: 'Transición suave de la relativa mayor' }
      ],
      'iv': [
        { from: 'i', desc: 'Paso hacia la subdominante de preparación menor' },
        { from: '♭III', desc: 'Movimiento de paso conjunto' },
        { from: '♭VI', desc: 'Descenso de tercera' },
        { from: '♭VII', desc: 'Conducción suave' }
      ],
      '♭VII': [
        { from: 'iv', desc: 'Movimiento subdominante a dominante modal' },
        { from: '♭VI', desc: 'Paso conjunto ascendente directo en el bajo' },
        { from: 'i', desc: 'Movimiento' }
      ],
      '♭VI': [
        { from: 'iv', desc: 'Paso conjunto' },
        { from: '♭III', desc: 'Movimiento' },
        { from: '♭VII', desc: 'Movimiento' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i',
        explanation: 'Dominante principal prestado de la menor armónica. Introduce la sensible (#7) para crear una atracción resolutiva de máxima tensión.',
        variants: ['7', '9', 'b9', '#9', 'b13', 'alt', 'sus4'],
        styles: ['pop', 'jazz', 'gospel', 'metal'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_iv',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado menor (iv).',
        variants: ['7', '9', 'b9', '#9', 'sus4'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_bIII',
        category: 'secondary_dominant',
        target_degree: '♭III',
        function: 'V/♭III',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol mayor (♭III), que es la relativa mayor.',
        variants: ['7', '9', '#11', 'sus4'],
        styles: ['pop', 'jazz', 'rock'],
        example: 'G7 ➔ C'
      },
      {
        id: 'V_bVI',
        category: 'secondary_dominant',
        target_degree: '♭VI',
        function: 'V/♭VI',
        explanation: 'Dominante secundario que resuelve al sexto grado bemol mayor (♭VI).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'C7 ➔ F'
      },
      {
        id: 'V_bVII',
        category: 'secondary_dominant',
        target_degree: '♭VII',
        function: 'V/♭VII',
        explanation: 'Dominante secundario que resuelve al séptimo grado bemol mayor (♭VII).',
        variants: ['7', '9'],
        styles: ['pop', 'rock', 'jazz'],
        example: 'D7 ➔ G'
      }
    ],

    modal_interchange: [
      {
        id: 'I_major',
        category: 'modal_interchange',
        source_scale: 'parallel_major',
        degree: 'I',
        function: 'Final brillante (Picardía)',
        explanation: 'Resolución final que convierte la tónica en mayor (Tercera de Picardía), cerrando la pieza menor con un brillo de luz y esperanza.',
        styles: ['pop', 'gospel', 'cine'],
        example: 'A en Am'
      },
      {
        id: 'IV_major',
        category: 'modal_interchange',
        source_scale: 'dorian_mode',
        degree: 'IV',
        function: 'Dorian IV',
        explanation: 'Conversión de la subdominante menor (iv) a mayor (IV), introduciendo la sexta nota mayor característica del modo Dórico.',
        styles: ['rock', 'pop', 'jazz'],
        example: 'D en Am'
      },
      {
        id: 'V_major',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'V',
        function: 'Dominante funcional',
        explanation: 'Préstamo de la menor armónica para sustituir la dominante modal menor (v) por una mayor/séptima real con sensible.',
        styles: ['pop', 'rock', 'metal', 'flamenco', 'jazz'],
        example: 'E7 en Am'
      },
      {
        id: 'ii_minor',
        category: 'modal_interchange',
        source_scale: 'dorian_mode',
        degree: 'ii',
        function: 'Dorian ii',
        explanation: 'Segundo grado menor natural (ii) en lugar del diatónico disminuido (ii°), prestado del modo dórico.',
        styles: ['jazz', 'fusion'],
        example: 'Bm en Am'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_sup',
        category: 'chromatic_approach',
        name: 'Disminuido Superior',
        explanation: 'Acorde de séptima disminuida a medio tono superior resolviendo hacia abajo (X+1 dim7 ➔ Destino).',
        example: 'Bdim7 ➔ Am'
      },
      {
        id: 'approach_chrom_sup',
        category: 'chromatic_approach',
        name: 'Cromática Superior',
        explanation: 'Paso cromático descendente directo por semitono (X+1m ➔ Destino).',
        example: 'Bbm ➔ Am'
      },
      {
        id: 'approach_chrom_inf',
        category: 'chromatic_approach',
        name: 'Cromática Inferior',
        explanation: 'Paso cromático ascendente directo por semitono (X-1m ➔ Destino).',
        example: 'G#m ➔ Am'
      },
      {
        id: 'approach_enclosure',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Rodear la tónica desde arriba y abajo en sucesión cromática rápida.',
        example: 'Bbm ➔ G#m ➔ Am'
      },
      {
        id: 'approach_dominant',
        category: 'chromatic_approach',
        name: 'Dominante Cromático',
        explanation: 'Séptima dominante que resuelve por semitono descendente (sustituto tritonal).',
        example: 'Bb7 ➔ Am'
      }
    ],

    cadences: [
      {
        id: 'cad_modal_minor',
        category: 'cadence',
        name: 'Cadencia Modal Menor',
        degrees: ['♭VII', 'i'],
        explanation: 'Resolución modal clásica por paso conjunto descendente en el bajo. Muy popular en el rock y el folk.',
        tension: 'Baja-Media'
      },
      {
        id: 'cad_classic_minor',
        category: 'cadence',
        name: 'Cadencia Menor Clásica (Armónica)',
        degrees: ['V7', 'i'],
        explanation: 'Máxima atracción tonal en menor, usando el V7 de la menor armónica para resolver en la tónica menor.',
        tension: 'Alta'
      },
      {
        id: 'cad_plagal_minor',
        category: 'cadence',
        name: 'Cadencia Plagal Menor',
        degrees: ['iv', 'i'],
        explanation: 'Resolución melancólica y suave desde la subdominante menor a la tónica menor.',
        tension: 'Baja'
      },
      {
        id: 'cad_andalusian',
        category: 'cadence',
        name: 'Cadencia Andaluza',
        degrees: ['i', '♭VII', '♭VI', 'V'],
        explanation: 'Progresión descendente clásica de origen español/flamenco, cerrando con tensión en el V mayor.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_modal_desc',
        category: 'cadence',
        name: 'Descenso Modal Menor',
        degrees: ['i', '♭VII', '♭VI'],
        explanation: 'Caída melancólica por grados conjuntos en el bajo que define la estética del rock melódico.',
        tension: 'Baja'
      },
      {
        id: 'cad_ii_v_i_minor',
        category: 'cadence',
        name: 'Cadencia ii°–V–i',
        degrees: ['ii°', 'V', 'i'],
        explanation: 'La cadencia clásica menor por excelencia. Tensión disminuida y dominante que resuelve en estabilidad menor.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_harm',
        category: 'reharmonization',
        name: 'Dominante Armónico',
        explanation: 'Reemplazar el v grado menor modal por el V mayor/séptima funcional con sensible.',
        example: 'E7 ➔ Am'
      },
      {
        id: 'reharm_ii_v_i_min',
        category: 'reharmonization',
        name: 'ii° - V - i Secundario',
        explanation: 'Preparación clásica de jazz menor usando el ii° semidisminuido y V7 alterado.',
        example: 'Bm7b5 ➔ E7 ➔ Am'
      },
      {
        id: 'reharm_tritone_min',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Dominante cromático sustituto de tritono resolviendo por semitono descendente.',
        example: 'Bb7 ➔ Am'
      },
      {
        id: 'reharm_passing_dim',
        category: 'reharmonization',
        name: 'Disminuido de Aproximación',
        explanation: 'Acorde de séptima disminuida sensible resolviendo desde medio tono abajo.',
        example: 'G#dim7 ➔ Am'
      },
      {
        id: 'reharm_chained_dom',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Encadenar dominantes secundarios que resuelven cíclicamente hacia la tónica menor.',
        example: 'B7 ➔ E7 ➔ Am'
      },
      {
        id: 'reharm_backdoor_min',
        category: 'reharmonization',
        name: 'Backdoor Menor',
        explanation: 'Resolución indirecta mediante un bVII7 resolviendo a i.',
        example: 'G7 ➔ Am'
      }
    ]
  },

  // ==================== 🔵 MODO DÓRICO ====================
  dorian: {
    name: 'Modo Dórico',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Centro modal', type: 'Estabilidad', explanation: 'Estabilidad de reposo menor modal. Es el centro gravitacional de la pieza.' },
      { degree: 'ii', function: 'Movimiento', type: 'Transición', explanation: 'Movimiento suave menor, característico por carecer de la quinta disminuida de la menor natural.' },
      { degree: '♭III', function: 'Color modal', type: 'Color', explanation: 'Relativa mayor de color brillante. Ofrece contraste sin perder el centro menor.' },
      { degree: 'IV', function: 'Característico', type: 'Brillo característico', explanation: 'Acorde mayor con la sexta mayor característica del modo. Aporta la brillantez mística del Dórico.' },
      { degree: 'v', function: 'Movimiento', type: 'Tensión moderada', explanation: 'Acorde menor de quinta que conduce de vuelta al centro de forma muy suave y modal.' },
      { degree: 'vi°', function: 'Tensión', type: 'Máxima tensión', explanation: 'Acorde disminuido inestable. Posee la sexta característica y tensiones de tritono.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Resolución', explanation: 'Acorde de paso mayor que resuelve por tono descendente en el bajo hacia el centro modal.' }
    ],

    functional_relationships: {
      'i': [
        { from: 'IV', desc: 'Resolución dórica característica por excelencia, gran sonoridad de brillo místico' },
        { from: '♭VII', desc: 'Resolución modal suave por tono descendente directo' },
        { from: 'ii', desc: 'Resolución menor por paso conjunto de transición fluida' },
        { from: 'v', desc: 'Resolución modal de dominante menor sin sensible' }
      ],
      'IV': [
        { from: 'i', desc: 'Movimiento característico que establece la sonoridad dórica' },
        { from: '♭III', desc: 'Paso conjunto ascendente de brillo tonal' },
        { from: 'v', desc: 'Paso conjunto descendente' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_IV',
        category: 'secondary_dominant',
        target_degree: 'IV',
        function: 'V/IV',
        explanation: 'Dominante secundario que resuelve al cuarto grado mayor (IV).',
        variants: ['7', '9', 'sus4'],
        styles: ['pop', 'jazz', 'fusion'],
        example: 'D7 ➔ G'
      },
      {
        id: 'V_bIII',
        category: 'secondary_dominant',
        target_degree: '♭III',
        function: 'V/♭III',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol mayor (♭III), que es la relativa mayor.',
        variants: ['7', '9', 'sus4'],
        styles: ['pop', 'jazz', 'fusion'],
        example: 'B7 ➔ C'
      },
      {
        id: 'V_bVII',
        category: 'secondary_dominant',
        target_degree: '♭VII',
        function: 'V/♭VII',
        explanation: 'Dominante secundario que resuelve al séptimo grado bemol mayor (♭VII).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz', 'rock'],
        example: 'F#7 ➔ G'
      },
      {
        id: 'V_i',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i (modal expandido)',
        explanation: 'Dominante principal funcional prestado de la escala menor armónica para reforzar la resolución hacia la tónica menor.',
        variants: ['7', 'b9', '#9', 'alt'],
        styles: ['jazz', 'gospel', 'fusion'],
        example: 'A7 ➔ Dm'
      }
    ],

    modal_interchange: [
      {
        id: 'bVI_natural',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: '♭VI',
        function: 'Color menor natural',
        explanation: 'Préstamo de la escala menor natural paralela, agregando el sexto grado bemol que rompe temporalmente la sonoridad dórica.',
        styles: ['jazz', 'fusion', 'pop'],
        example: 'Bbmaj7 en D Dórico'
      },
      {
        id: 'ii_dim_natural',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'ii°',
        function: 'ii semidisminuido',
        explanation: 'Segundo grado semidisminuido diatónico de la menor natural en lugar del segundo menor dórico, ideal para ii-V.',
        styles: ['jazz', 'fusion'],
        example: 'Em7b5 en D Dórico'
      },
      {
        id: 'V_major_parallel',
        category: 'modal_interchange',
        source_scale: 'parallel_major',
        degree: 'V',
        function: 'Dominante funcional mayor',
        explanation: 'Préstamo del modo mayor o menor armónico para lograr un acorde de séptima dominante real.',
        styles: ['jazz', 'gospel', 'fusion'],
        example: 'A7 en D Dórico'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf',
        category: 'chromatic_approach',
        name: 'Disminuido de Aproximación',
        explanation: 'Acorde disminuido sensible que resuelve desde medio tono abajo.',
        example: 'C#dim7 ➔ Dm'
      },
      {
        id: 'approach_chrom_sup',
        category: 'chromatic_approach',
        name: 'Cromática Superior',
        explanation: 'Aproximación cromática por semitono descendente hacia la tónica.',
        example: 'Ebm7 ➔ Dm'
      },
      {
        id: 'approach_chrom_inf',
        category: 'chromatic_approach',
        name: 'Cromática Inferior',
        explanation: 'Aproximación cromática por semitono ascendente hacia la tónica.',
        example: 'C#m7 ➔ Dm'
      },
      {
        id: 'approach_enclosure',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Rodear el acorde de destino desde arriba y abajo sucesivamente (X+1 ➔ X-1 ➔ Destino).',
        example: 'Ebm7 ➔ C#m7 ➔ Dm'
      }
    ],

    cadences: [
      {
        id: 'cad_dorian_main',
        category: 'cadence',
        name: 'Cadencia Dórica Principal',
        degrees: ['i', 'IV'],
        explanation: 'El movimiento característico del dórico. Cambia el iv menor de la menor natural por el IV mayor de color brillante.',
        tension: 'Baja-Media'
      },
      {
        id: 'cad_dorian_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['i', '♭VII', 'IV'],
        explanation: 'Progresión muy popular en el rock y pop modal, que alterna entre grados mayores estables de paso.',
        tension: 'Baja'
      },
      {
        id: 'cad_dorian_desc',
        category: 'cadence',
        name: 'Descenso Modal Dórico',
        degrees: ['♭III', 'ii', 'i'],
        explanation: 'Línea de caída armónica descendente sumamente fluida y melódica.',
        tension: 'Baja'
      },
      {
        id: 'cad_dorian_jazz',
        category: 'cadence',
        name: 'Jazz Dórico ii–V–i',
        degrees: ['ii', 'V', 'i'],
        explanation: 'Estructura clásica de jazz adaptada mediante dominantes prestados o modalizada.',
        tension: 'Media-Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_dorian',
        category: 'reharmonization',
        name: 'Dominante hacia i',
        explanation: 'Uso del acorde de dominante mayor prestado de la menor armónica para forzar una resolución fuerte.',
        example: 'A7 ➔ Dm'
      },
      {
        id: 'reharm_tritone_dorian',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Sustituto tritonal dominante cromático resolviendo por semitono descendente.',
        example: 'Eb7 ➔ Dm'
      },
      {
        id: 'reharm_dim_dorian',
        category: 'reharmonization',
        name: 'Acorde Disminuido',
        explanation: 'Acorde disminuido de paso o aproximación sensible hacia el acorde menor modal.',
        example: 'C#dim7 ➔ Dm'
      },
      {
        id: 'reharm_ii_v_modal',
        category: 'reharmonization',
        name: 'ii-V Modal Completo',
        explanation: 'ii semidisminuido y V dominante resolviendo al i menor.',
        example: 'Em7b5 ➔ A7 ➔ Dm'
      },
      {
        id: 'reharm_gospel_dorian',
        category: 'reharmonization',
        name: 'Gospel Walk-Up Dórico',
        explanation: 'Movimiento ascendente adaptado al centro modal.',
        example: 'Dm ➔ G ➔ C ➔ F'
      }
    ]
  },

  // ==================== 🔵 MODO FRIGIO ====================
  phrygian: {
    name: 'Modo Frigio',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Centro modal', type: 'Estabilidad', explanation: 'Estabilidad de reposo menor modal. Genera una atmósfera introspectiva y oscura.' },
      { degree: '♭II', function: 'Acorde característico', type: 'Tensión modal / Color', explanation: 'Acorde mayor construido sobre la segunda menor (♭2). Es la firma e identidad cromática del modo frigio.' },
      { degree: '♭III', function: 'Color modal', type: 'Color', explanation: 'Acorde mayor de paso que brinda contraste y un color brillante de transición.' },
      { degree: 'iv', function: 'Movimiento', type: 'Subdominante modal', explanation: 'Acorde menor de cuarto grado. Brinda preparación de movimiento suave hacia la tónica.' },
      { degree: 'v°', function: 'Tensión', type: 'Inestabilidad disminuida', explanation: 'Acorde de quinta disminuida. Inestable por carecer de quinta justa, genera atracción hacia la tónica.' },
      { degree: '♭VI', function: 'Color oscuro', type: 'Descanso modal', explanation: 'Acorde mayor de sexto grado. Conserva la atmósfera menor y oscura característica.' },
      { degree: '♭VII', function: 'Movimiento modal', type: 'Resolución modal', explanation: 'Acorde menor de séptimo grado que resuelve de manera suave hacia la tónica.' }
    ],

    functional_relationships: {
      'i': [
        { from: '♭II', desc: 'Cadencia frigia principal, resolución por semitono descendente de máxima fuerza modal' },
        { from: 'iv', desc: 'Conducción suave menor hacia el centro modal' },
        { from: '♭VII', desc: 'Resolución de paso por tono ascendente en el bajo' },
        { from: '♭VI', desc: 'Transición majestuosa descendente' }
      ],
      '♭II': [
        { from: 'i', desc: 'Movimiento característico que establece la sonoridad frigia' },
        { from: '♭VII', desc: 'Paso conjunto' },
        { from: '♭III', desc: 'Paso conjunto descendente' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_iv',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado menor (iv).',
        variants: ['7', '9', 'sus4'],
        styles: ['jazz', 'fusion', 'flamenco'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_bIII',
        category: 'secondary_dominant',
        target_degree: '♭III',
        function: 'V/♭III',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol mayor (♭III).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz', 'fusion'],
        example: 'B7 ➔ G'
      },
      {
        id: 'V_i',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i (modal expandido)',
        explanation: 'Dominante principal funcional prestado de la escala menor armónica para lograr una resolución tonal fuerte.',
        variants: ['7', 'b9', '#9', 'alt'],
        styles: ['flamenco', 'metal', 'jazz', 'fusion'],
        example: 'B7 ➔ Em'
      }
    ],

    modal_interchange: [
      {
        id: 'v_minor_natural',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'v',
        function: 'Color menor natural',
        explanation: 'Préstamo de la escala menor natural paralela, sustituyendo el acorde disminuido v° por un acorde menor de quinta justa.',
        styles: ['jazz', 'fusion', 'metal'],
        example: 'Bm en E Frigio'
      },
      {
        id: 'ii_dim_natural',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'ii°',
        function: 'ii semidisminuido',
        explanation: 'Segundo grado semidisminuido prestado de la menor natural en lugar del característico ♭II mayor.',
        styles: ['jazz', 'fusion'],
        example: 'F#m7b5 en E Frigio'
      },
      {
        id: 'V_phrygian_dominant',
        category: 'modal_interchange',
        source_scale: 'phrygian_dominant',
        degree: 'V',
        function: 'Dominante Frigio mayor',
        explanation: 'Préstamo de la escala Frigia Dominante, convirtiendo la tónica menor o la dominante menor en un acorde de quinta mayor.',
        styles: ['flamenco', 'metal', 'fusion'],
        example: 'B o B7 en E Frigio'
      },
      {
        id: 'V_harmonic_minor',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'V',
        function: 'Dominante armónico',
        explanation: 'Préstamo directo de la menor armónica, forzando la sensible (#7) para una atracción tonal fuerte.',
        styles: ['flamenco', 'metal', 'gospel'],
        example: 'B7 en E Frigio'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf',
        category: 'chromatic_approach',
        name: 'Disminuido sensible',
        explanation: 'Acorde de séptima disminuida resolviendo a la tónica desde medio tono inferior.',
        example: 'D#dim7 ➔ Em'
      },
      {
        id: 'approach_chrom_sup',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Paso cromático por semitono descendente hacia la tónica (♭II ➔ i en tríada menor).',
        example: 'Fm ➔ Em'
      },
      {
        id: 'approach_chrom_inf',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Paso cromático por semitono ascendente hacia la tónica.',
        example: 'D#m ➔ Em'
      },
      {
        id: 'approach_enclosure',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Rodear el acorde de destino desde arriba y abajo en sucesión rápida.',
        example: 'Fm ➔ D#m ➔ Em'
      }
    ],

    cadences: [
      {
        id: 'cad_phrygian_main',
        category: 'cadence',
        name: 'Cadencia Frigia Principal',
        degrees: ['♭II', 'i'],
        explanation: 'La resolución emblemática del modo frigio. El acorde característico mayor ♭II resuelve por semitono descendente en la tónica menor i.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_phrygian_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['♭VII', '♭II', 'i'],
        explanation: 'Progresión que combina el paso del séptimo bemol al segundo bemol para un reposo definitivo.',
        tension: 'Media'
      },
      {
        id: 'cad_andalusian_flamenco',
        category: 'cadence',
        name: 'Cadencia Flamenca (Andaluza)',
        degrees: ['iv', '♭III', '♭II', 'i'],
        explanation: 'La progresión más tradicional de la música flamenca y española, con un descenso de grados conjuntos hasta el reposo menor.',
        tension: 'Alta'
      },
      {
        id: 'cad_phrygian_desc',
        category: 'cadence',
        name: 'Descenso Frigio',
        degrees: ['♭VI', '♭II', 'i'],
        explanation: 'Movimiento que acentúa la sonoridad misteriosa y la tensión del intervalo ♭2.',
        tension: 'Media'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_borrowed',
        category: 'reharmonization',
        name: 'Dominante prestado',
        explanation: 'Sustituye la dominante menor diatónica por un acorde dominante mayor prestado de la menor armónica para añadir tensión tonal.',
        example: 'B7 ➔ Em'
      },
      {
        id: 'reharm_tritone_phrygian',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde de séptima dominante a medio tono por encima de la tónica (equivalente al ♭II7 cromático).',
        example: 'F7 ➔ Em'
      },
      {
        id: 'reharm_dim_phrygian',
        category: 'reharmonization',
        name: 'Disminuido de Aproximación',
        explanation: 'Acorde disminuido sensible resolviendo desde medio tono abajo.',
        example: 'D#dim7 ➔ Em'
      },
      {
        id: 'reharm_flamenco_exp',
        category: 'reharmonization',
        name: 'Cadencia Flamenca Expandida',
        explanation: 'Progresión tradicional expandida que explota la bajada de grados conjuntos.',
        example: 'Am ➔ G ➔ F ➔ Em'
      }
    ]
  },

  // ==================== 🔵 MODO LIDIO ====================
  lydian: {
    name: 'Modo Lidio',
    version: 1,

    diatonic_functions: [
      { degree: 'I', function: 'Centro modal', type: 'Estabilidad', explanation: 'Estabilidad de reposo mayor modal. Aporta una sensación espacial, luminosa y abierta.' },
      { degree: 'II', function: 'Movimiento', type: 'Color característico', explanation: 'Acorde mayor construido sobre el segundo grado. Contiene la nota característica (#4) del modo, definiendo su firma armónica.' },
      { degree: 'iii', function: 'Color', type: 'Mediante modal', explanation: 'Acorde menor de tercer grado que suaviza el brillo del modo con una textura cálida.' },
      { degree: '#iv°', function: 'Acorde característico', type: 'Inestabilidad disminuida', explanation: 'Acorde disminuido construido sobre la cuarta aumentada (#4). Aporta una tensión misteriosa de paso.' },
      { degree: 'V', function: 'Expansión', type: 'Subdominante modal', explanation: 'Acorde mayor de quinto grado. Acentúa la atmósfera de flotación y amplitud del modo.' },
      { degree: 'vi', function: 'Relativo', type: 'Tónica menor relativa', explanation: 'Acorde menor de sexto grado. Funciona como punto de descanso temporal.' },
      { degree: 'vii', function: 'Movimiento', type: 'Movimiento modal', explanation: 'Acorde menor de séptimo grado que conduce con suavidad de vuelta al centro modal.' }
    ],

    functional_relationships: {
      'I': [
        { from: 'II', desc: 'Cadencia lidia principal, resolución por grado conjunto de gran carácter flotante' },
        { from: 'V', desc: 'Conducción brillante y expansiva hacia el centro modal' },
        { from: 'vii', desc: 'Transición de paso por tono descendente en el bajo' }
      ],
      'II': [
        { from: 'I', desc: 'Movimiento característico de ida que inyecta la nota #4 y establece el color lidio' },
        { from: 'V', desc: 'Paso conjunto descendente' },
        { from: 'iii', desc: 'Paso conjunto descendente' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_II',
        category: 'secondary_dominant',
        target_degree: 'II',
        function: 'V/II',
        explanation: 'Dominante secundario que resuelve al segundo grado mayor (II).',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion', 'rock_progressive'],
        example: 'A7 ➔ D'
      },
      {
        id: 'V_V',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Dominante secundario que resuelve al quinto grado mayor (V).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz', 'fusion'],
        example: 'D7 ➔ G'
      },
      {
        id: 'V_vi',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario que conduce a la tónica menor relativa (vi).',
        variants: ['7', 'b9', '#9'],
        styles: ['jazz', 'fusion', 'pop'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_I',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V/I (modal expandido)',
        explanation: 'Dominante principal tradicional usado para una resolución tonal más marcada.',
        variants: ['7', 'sus4'],
        styles: ['pop', 'jazz'],
        example: 'G7 ➔ C'
      }
    ],

    modal_interchange: [
      {
        id: 'IV_major_natural',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'IV',
        function: 'Subdominante mayor natural',
        explanation: 'Préstamo del modo mayor paralelo, reemplazando la cuarta aumentada característica por la cuarta justa natural para relajar la tensión modal.',
        styles: ['pop', 'rock', 'jazz'],
        example: 'F en C Lidio'
      },
      {
        id: 'ii_minor_natural',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'ii',
        function: 'Segundo grado menor',
        explanation: 'Préstamo de la escala mayor paralela que sustituye el segundo grado mayor diatónico por uno menor.',
        styles: ['jazz', 'pop', 'fusion'],
        example: 'Dm en C Lidio'
      },
      {
        id: 'I_lydian_augmented',
        category: 'modal_interchange',
        source_scale: 'lydian_augmented',
        degree: 'I+',
        function: 'Tónica lidia aumentada',
        explanation: 'Préstamo de la escala Lidia Aumentada (maj7#5) que añade tensión moderna y misterio a la tónica.',
        styles: ['jazz', 'fusion', 'rock_progressive'],
        example: 'Cmaj7#5 en C Lidio'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf_lyd',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Acorde de séptima disminuida resolviendo a la tónica desde medio tono inferior.',
        example: 'Bdim7 ➔ Cmaj7'
      },
      {
        id: 'approach_chrom_sup_lyd',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Paso cromático por semitono descendente hacia la tónica.',
        example: 'Dbmaj7 ➔ Cmaj7'
      },
      {
        id: 'approach_chrom_inf_lyd',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Paso cromático por semitono ascendente hacia la tónica.',
        example: 'Bmaj7 ➔ Cmaj7'
      },
      {
        id: 'approach_enclosure_lyd',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Aproximación sucesiva desde arriba y abajo hacia el acorde de tónica.',
        example: 'Dbmaj7 ➔ Bmaj7 ➔ Cmaj7'
      }
    ],

    cadences: [
      {
        id: 'cad_lydian_main',
        category: 'cadence',
        name: 'Cadencia Lidia Principal',
        degrees: ['II', 'I'],
        explanation: 'La resolución insignia del modo Lidio. El segundo grado mayor (II) se desplaza al primer grado mayor (I), inyectando el color modal.',
        tension: 'Media-Baja'
      },
      {
        id: 'cad_lydian_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['II', 'V', 'I'],
        explanation: 'Progresión que expande la cadencia principal pasando por el quinto grado antes de reposar en la tónica.',
        tension: 'Media'
      },
      {
        id: 'cad_lydian_floating',
        category: 'cadence',
        name: 'Cadencia Flotante',
        degrees: ['I', 'II', 'I'],
        explanation: 'Movimiento circular oscilante entre tónica y segundo grado, maximizando el efecto de flotación lidia.',
        tension: 'Baja'
      },
      {
        id: 'cad_lydian_cinema',
        category: 'cadence',
        name: 'Cadencia Cinemática Lidia',
        degrees: ['I', 'II', 'V', 'I'],
        explanation: 'Estructura clásica en bandas sonoras que genera un arco de gran luminosidad, asombro y amplitud espacial.',
        tension: 'Media-Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_sec_dom_lyd',
        category: 'reharmonization',
        name: 'Dominante Secundario en Movimiento',
        explanation: 'Antepone un acorde dominante secundario para dar dirección al segundo grado mayor.',
        example: 'A7 ➔ D'
      },
      {
        id: 'reharm_tritone_lyd',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un dominante sustituto a distancia de tritono para resolver de forma cromática.',
        example: 'Eb7 ➔ D'
      },
      {
        id: 'reharm_sharp_iv_dim_lyd',
        category: 'reharmonization',
        name: 'Uso del #iv°',
        explanation: 'Uso del cuarto grado aumentado disminuido (#iv°) como acorde disminuido de paso hacia el quinto grado.',
        example: 'F#dim ➔ G'
      },
      {
        id: 'reharm_modal_sub_lyd',
        category: 'reharmonization',
        name: 'Sustitución Modal Circular',
        explanation: 'Sustitución temporal del centro tonal por el acorde característico II para romper el estatismo.',
        example: 'Cmaj7 ➔ D ➔ Cmaj7'
      },
      {
        id: 'reharm_pedal_lydian',
        category: 'reharmonization',
        name: 'Pedal de Bajo Lidio',
        explanation: 'Mantener la nota tónica en el bajo (pedal) mientras se alternan los acordes de I, II y V en las voces superiores.',
        example: 'Cmaj7 ➔ D/C ➔ G/C'
      }
    ]
  },

  // ==================== 🔵 MODO MIXOLIDIO ====================
  mixolydian: {
    name: 'Modo Mixolidio',
    version: 1,

    diatonic_functions: [
      { degree: 'I', function: 'Centro modal', type: 'Estabilidad', explanation: 'Estabilidad de reposo mayor modal. Genera una sonoridad abierta, enérgica y menos conclusiva.' },
      { degree: 'ii', function: 'Movimiento', type: 'Subdominante modal', explanation: 'Acorde menor de segundo grado que provee conducción hacia la dominante o la tónica.' },
      { degree: 'iii°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Acorde disminuido construido sobre el tercer grado. Genera inestabilidad diatónica.' },
      { degree: 'IV', function: 'Subdominante', type: 'Subdominante clásica', explanation: 'Acorde mayor de cuarto grado. Soporte armónico fundamental para resoluciones modales.' },
      { degree: 'v', function: 'Movimiento', type: 'Dominante menor (sin sensible)', explanation: 'Acorde menor de quinto grado. Aporta un carácter antiguo y modal al carecer de la sensible mayor.' },
      { degree: 'vi', function: 'Relativo', type: 'Tónica menor relativa', explanation: 'Acorde menor de sexto grado. Conserva estabilidad y descanso.' },
      { degree: '♭VII', function: 'Acorde característico', type: 'Color característico / Cadencia', explanation: 'Acorde mayor de séptima bemol. Contiene la nota característica (♭7), siendo el eje e identidad del modo.' }
    ],

    functional_relationships: {
      'I': [
        { from: '♭VII', desc: 'Cadencia mixolidia principal, resolución abierta por tono entero descendente en el bajo' },
        { from: 'IV', desc: 'Resolución plagal brillante típica del rock' },
        { from: 'ii', desc: 'Conducción menor suave hacia el reposo' },
        { from: 'vi', desc: 'Transición por grado conjunto ascendente' }
      ],
      '♭VII': [
        { from: 'I', desc: 'Movimiento de salida característico hacia la séptima bemol' },
        { from: 'IV', desc: 'Movimiento subdominante complementario' },
        { from: 'vi', desc: 'Transición suave' }
      ],
      'IV': [
        { from: 'I', desc: 'Establece el movimiento plagal básico' },
        { from: '♭VII', desc: 'Conexión subdominante característica' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_ii',
        category: 'secondary_dominant',
        target_degree: 'ii',
        function: 'V/ii',
        explanation: 'Dominante secundario que resuelve al segundo grado menor (ii).',
        variants: ['7', '9'],
        styles: ['rock', 'jazz', 'gospel'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_IV',
        category: 'secondary_dominant',
        target_degree: 'IV',
        function: 'V/IV',
        explanation: 'Dominante secundario que resuelve al cuarto grado mayor (IV).',
        variants: ['7', '9'],
        styles: ['pop', 'blues', 'gospel'],
        example: 'G7 ➔ C'
      },
      {
        id: 'V_v',
        category: 'secondary_dominant',
        target_degree: 'v',
        function: 'V/v',
        explanation: 'Dominante secundario que resuelve al quinto grado menor modal (v).',
        variants: ['7', '9'],
        styles: ['jazz', 'gospel'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_vi',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario que resuelve al sexto grado menor (vi).',
        variants: ['7', 'b9', '#9'],
        styles: ['jazz', 'fusion', 'gospel'],
        example: 'B7 ➔ Em'
      },
      {
        id: 'V_i_mixo',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V/I (Dominante del centro modal)',
        explanation: 'Dominante principal tonal clásico (V7 con tercera mayor sensible) para forzar una resolución fuerte.',
        variants: ['7', '9', 'sus4'],
        styles: ['pop', 'rock', 'country'],
        example: 'D7 ➔ G'
      }
    ],

    modal_interchange: [
      {
        id: 'vii_dim_major',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'vii°',
        function: 'Séptimo disminuido diatónico',
        explanation: 'Préstamo del modo mayor paralelo que introduce el acorde disminuido sobre la sensible en lugar del característico ♭VII mayor.',
        styles: ['pop', 'jazz'],
        example: 'F#m7b5 en G Mixolidio'
      },
      {
        id: 'bIII_natural_minor',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: '♭III',
        function: 'Tercer grado bemol mayor',
        explanation: 'Préstamo de la escala menor natural paralela, aportando un color más oscuro y rockero.',
        styles: ['rock', 'metal'],
        example: 'Bb en G Mixolidio'
      },
      {
        id: 'iv_minor_natural',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'iv',
        function: 'Cuarto grado menor',
        explanation: 'Préstamo menor natural que reemplaza el cuarto grado mayor diatónico para una resolución plagal menor de gran emotividad.',
        styles: ['pop', 'ballad', 'cinema'],
        example: 'Cm en G Mixolidio'
      },
      {
        id: 'bVI_natural_minor',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: '♭VI',
        function: 'Sexto grado bemol mayor',
        explanation: 'Préstamo de la escala menor natural paralela para ampliar el espectro modal con un acorde mayor épico.',
        styles: ['rock', 'cinema', 'metal'],
        example: 'Eb en G Mixolidio'
      },
      {
        id: 'I7_blues_extended',
        category: 'modal_interchange',
        source_scale: 'blues',
        degree: 'I7',
        function: 'Tónica dominante extendida',
        explanation: 'Préstamo de la escala de blues que convierte la tónica en un acorde de séptima de dominante permanente.',
        styles: ['blues', 'funk', 'jazz'],
        example: 'G7, G9, G13 en G Mixolidio'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf_mixo',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Séptima disminuida resolviendo a la tónica desde medio tono inferior.',
        example: 'F#dim7 ➔ G7'
      },
      {
        id: 'approach_chrom_sup_mixo',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Séptima dominante un semitono por encima del destino resolviendo en paralelo.',
        example: 'Ab7 ➔ G7'
      },
      {
        id: 'approach_chrom_inf_mixo',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Séptima dominante un semitono por debajo del destino resolviendo en paralelo.',
        example: 'F#7 ➔ G7'
      },
      {
        id: 'approach_enclosure_mixo',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Rodear el acorde de destino desde arriba y abajo en sucesión rápida.',
        example: 'Ab7 ➔ F#7 ➔ G7'
      },
      {
        id: 'approach_tritone_mixo',
        category: 'chromatic_approach',
        name: 'Sustitución Tritonal',
        explanation: 'Dominante sustituta a distancia de tritono para una resolución cromática descendente.',
        example: 'Db7 ➔ G7'
      }
    ],

    cadences: [
      {
        id: 'cad_mixolydian_main',
        category: 'cadence',
        name: 'Cadencia Mixolidia Principal',
        degrees: ['♭VII', 'I'],
        explanation: 'La resolución insignia del modo Mixolidio. El acorde característico mayor ♭VII resuelve por tono entero descendente en el bajo hacia el acorde de tónica I.',
        tension: 'Baja'
      },
      {
        id: 'cad_mixolydian_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['IV', '♭VII', 'I'],
        explanation: 'Cadencia que antecede el subdominante antes de pasar al séptimo bemol y resolver en la tónica.',
        tension: 'Media'
      },
      {
        id: 'cad_mixolydian_rock',
        category: 'cadence',
        name: 'Progresión de Rock Modal',
        degrees: ['I', '♭VII', 'IV'],
        explanation: 'La progresión cíclica de tres acordes por excelencia de la música rock, alternando tónica, séptima bemol y subdominante.',
        tension: 'Baja'
      },
      {
        id: 'cad_mixolydian_blues_modal',
        category: 'cadence',
        name: 'Cadencia de Blues Modal',
        degrees: ['I7', '♭VII', 'IV'],
        explanation: 'Estructura mixolidia con la tónica mayorizada con séptima, conduciendo suavemente hacia el subdominante.',
        tension: 'Media'
      },
      {
        id: 'cad_mixolydian_desc',
        category: 'cadence',
        name: 'Descenso Mixolidio',
        degrees: ['I', '♭VII', 'vi'],
        explanation: 'Movimiento que desciende desde la tónica hacia el sexto grado pasando por la séptima bemol.',
        tension: 'Baja'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_blues_dom_mixo',
        category: 'reharmonization',
        name: 'Dominante Blues Prolongado',
        explanation: 'Conversión del acorde de tónica I en dominante7 o con extensiones de novena o treceava (9/13) para dar color de blues.',
        example: 'G7, G9, G13 en G Mixolidio'
      },
      {
        id: 'reharm_tritone_mixo',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Sustitución del acorde de paso por un acorde de séptima dominante a distancia de tritono.',
        example: 'Db7 ➔ G7'
      },
      {
        id: 'reharm_passing_dim_mixo',
        category: 'reharmonization',
        name: 'Disminuido de Paso',
        explanation: 'Inserción de un acorde disminuido de paso cromático ascendente para conectar grados conjuntos.',
        example: 'G ➔ G#dim ➔ Am'
      },
      {
        id: 'reharm_backdoor_mixo',
        category: 'reharmonization',
        name: 'Resolución Backdoor',
        explanation: 'Uso de la resolución ♭VII ➔ I como puerta trasera armónica sustituyendo al dominante clásico.',
        example: 'F ➔ G'
      },
      {
        id: 'reharm_gospel_walkup',
        category: 'reharmonization',
        name: 'Gospel Walk-Up',
        explanation: 'Línea de bajo diatónica ascendente paso a paso que conduce con energía hacia el cuarto grado.',
        example: 'G ➔ Am ➔ Bm ➔ C'
      },
      {
        id: 'reharm_dom_chain',
        category: 'reharmonization',
        name: 'Cadena de Dominantes',
        explanation: 'Encadenamiento de acordes de séptima dominante por círculo de quintas descendente hasta la resolución final.',
        example: 'E7 ➔ A7 ➔ D7 ➔ G7'
      }
    ]
  },

  // ==================== 🔵 MODO LOCRIO ====================
  locrian: {
    name: 'Modo Locrio',
    version: 1,

    diatonic_functions: [
      { degree: 'i°', function: 'Centro modal', type: 'Inestabilidad disminuida', explanation: 'Estabilidad de reposo disminuida. Único modo gregoriano con tónica inestable (m7b5/dim), lo que genera una atmósfera de tensión y misterio.' },
      { degree: '♭II', function: 'Acorde característico', type: 'Color característico', explanation: 'Acorde mayor construido sobre la segunda menor (♭2). Ayuda a resolver y establecer la tónica Locria.' },
      { degree: '♭iii', function: 'Color modal', type: 'Color', explanation: 'Acorde menor de tercer grado que brinda suavidad y transición modal.' },
      { degree: 'iv', function: 'Movimiento', type: 'Subdominante modal', explanation: 'Acorde menor de cuarto grado que aporta preparación de movimiento suave hacia la tónica.' },
      { degree: '♭V', function: 'Color característico', type: 'Tensión modal / Brillo', explanation: 'Acorde mayor construido sobre la quinta disminuida (♭5). Aporta la firma intervalar de tensión del modo.' },
      { degree: '♭VI', function: 'Expansión', type: 'Descanso modal', explanation: 'Acorde mayor de sexto grado. Amplía el espectro armónico y proporciona estabilidad temporal.' },
      { degree: '♭vii', function: 'Movimiento', type: 'Resolución modal', explanation: 'Acorde menor de séptimo grado que conduce con suavidad al centro modal disminuido.' }
    ],

    functional_relationships: {
      'i°': [
        { from: '♭II', desc: 'Cadencia locria principal, resolución por semitono descendente de gran fuerza modal' },
        { from: 'iv', desc: 'Conducción suave menor hacia el reposo inestable' },
        { from: '♭vii', desc: 'Resolución de paso por tono ascendente en el bajo' },
        { from: '♭iii', desc: 'Transición suave descendente' }
      ],
      '♭II': [
        { from: 'i°', desc: 'Movimiento característico que establece la tensión locria' },
        { from: '♭vii', desc: 'Paso conjunto' },
        { from: '♭iii', desc: 'Paso conjunto descendente' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_dim',
        category: 'secondary_dominant',
        target_degree: 'i°',
        function: 'V/i°',
        explanation: 'Dominante principal funcional prestado de la menor armónica para forzar una resolución fuerte sobre el acorde disminuido.',
        variants: ['7', 'b9'],
        styles: ['jazz', 'fusion', 'metal_progressive'],
        example: 'F#7 ➔ Bm7b5'
      },
      {
        id: 'V_iv_loc',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado menor (iv).',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ Em'
      },
      {
        id: 'V_bIII_loc',
        category: 'secondary_dominant',
        target_degree: '♭iii',
        function: 'V/♭iii',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol menor (♭iii).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz'],
        example: 'B7 ➔ D'
      }
    ],

    modal_interchange: [
      {
        id: 'ii_locrian_sharp2',
        category: 'modal_interchange',
        source_scale: 'locrian_sharp2',
        degree: 'ii',
        function: 'ii natural disminuido',
        explanation: 'Préstamo del modo Locrio #2, sustituyendo el característico ♭II mayor por el ii semidisminuido con novena natural para estabilizar tensiones.',
        styles: ['jazz_moderno', 'fusion'],
        example: 'C#m7b5 en B Locrio'
      },
      {
        id: 'v_minor_natural_loc',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'v',
        function: 'Quinto grado menor',
        explanation: 'Préstamo de la escala menor natural paralela, sustituyendo la inestable quinta disminuida por un acorde de quinta justa.',
        styles: ['jazz', 'metal', 'soundtrack'],
        example: 'Fm en B Locrio'
      },
      {
        id: 'i_minor_natural_loc',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'i',
        function: 'Tónica menor estable',
        explanation: 'Préstamo de la menor natural paralela para estabilizar y resolver la tónica inestable disminuida en un acorde menor tradicional.',
        styles: ['pop', 'jazz', 'cinema'],
        example: 'Bm en B Locrio'
      },
      {
        id: 'bII_frigio_reforzado',
        category: 'modal_interchange',
        source_scale: 'phrygian',
        degree: '♭II_maj7',
        function: '♭II reforzado',
        explanation: 'Préstamo de la escala Frigia paralela, convirtiendo el acorde ♭II mayor en ♭II maj7 para enriquecer la cadencia.',
        styles: ['jazz', 'fusion'],
        example: 'Cmaj7 en B Locrio'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf_loc',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Séptima disminuida resolviendo a la tónica disminuida desde medio tono inferior.',
        example: 'A#dim7 ➔ Bm7b5'
      },
      {
        id: 'approach_chrom_sup_loc',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Acorde semidisminuido un semitono por encima del destino resolviendo en paralelo.',
        example: 'Cm7b5 ➔ Bm7b5'
      },
      {
        id: 'approach_chrom_inf_loc',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Acorde semidisminuido un semitono por debajo del destino resolviendo en paralelo.',
        example: 'A#m7b5 ➔ Bm7b5'
      },
      {
        id: 'approach_enclosure_loc',
        category: 'chromatic_approach',
        name: 'Encierro Cromático semidisminuido',
        explanation: 'Aproximación sucesiva por semitono desde arriba y abajo hacia la tónica semidisminuida.',
        example: 'Cm7b5 ➔ A#m7b5 ➔ Bm7b5'
      }
    ],

    cadences: [
      {
        id: 'cad_locrian_main',
        category: 'cadence',
        name: 'Cadencia Locria Principal',
        degrees: ['♭II', 'i°'],
        explanation: 'La resolución insignia del modo Locrio. El acorde característico mayor ♭II resuelve por semitono descendente en la tónica disminuida i°.',
        tension: 'Alta'
      },
      {
        id: 'cad_locrian_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['♭vii', '♭II', 'i°'],
        explanation: 'Progresión que combina el paso del séptimo grado bemol al segundo bemol para un reposo modal definitivo.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_locrian_dark',
        category: 'cadence',
        name: 'Cadencia Oscura',
        degrees: ['♭iii', '♭II', 'i°'],
        explanation: 'Movimiento que acentúa la sonoridad misteriosa y la tensión del intervalo ♭2.',
        tension: 'Media'
      },
      {
        id: 'cad_locrian_cinema',
        category: 'cadence',
        name: 'Cadencia Cinemática Locria',
        degrees: ['♭VI', '♭II', 'i°'],
        explanation: 'Estructura utilizada en música de suspenso y cine de terror para crear tensión y misterio extremos.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_borrowed_loc',
        category: 'reharmonization',
        name: 'Dominante Prestado',
        explanation: 'Sustituye la dominante menor diatónica por un acorde dominante mayor prestado de la menor armónica para añadir tensión tonal.',
        example: 'F#7 ➔ Bm7b5'
      },
      {
        id: 'reharm_tritone_loc',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde de séptima dominante a medio tono por encima de la tónica (equivalente al ♭II7 cromático).',
        example: 'C7 ➔ Bm7b5'
      },
      {
        id: 'reharm_dim_expanded_loc',
        category: 'reharmonization',
        name: 'Disminuido sensible de aproximación',
        explanation: 'Acorde disminuido sensible resolviendo desde medio tono abajo.',
        example: 'A#dim7 ➔ Bm7b5'
      },
    ]
  },

  // ==================== 🔵 ESCALA MENOR ARMÓNICA ====================
  harmonic_minor: {
    name: 'Escala Menor Armónica',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Tónica', type: 'Estabilidad menor', explanation: 'Estabilidad tonal en menor. Es el acorde de reposo de la tonalidad menor.' },
      { degree: 'ii°', function: 'Predominante', type: 'Movimiento inestable', explanation: 'Acorde disminuido sobre el segundo grado. Prepara el paso hacia el dominante con fuerte dirección.' },
      { degree: '♭III+', function: 'Color característico', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado. Introduce la sensible tonal y aporta un brillo tenso muy inusual.' },
      { degree: 'iv', function: 'Subdominante', type: 'Preparación', explanation: 'Acorde menor sobre el cuarto grado. Aporta preparación clásica de movimiento suave hacia el dominante o tónica.' },
      { degree: 'V', function: 'Dominante principal', type: 'Tensión de dominante', explanation: 'Acorde mayor o de séptima sobre el quinto grado. Genera la tensión principal que busca resolver con fuerza en la tónica menor (i).' },
      { degree: '♭VI', function: 'Color', type: 'Descanso modal', explanation: 'Acorde mayor construido sobre el sexto grado bemol. Amplía el espectro armónico y da una sensación majestuosa.' },
      { degree: 'vii°', function: 'Dominante de máxima tensión', type: 'Tensión tritononal máxima', explanation: 'Acorde disminuido sobre el séptimo grado. Posee máxima inestabilidad y resuelve directamente a la tónica (i).' }
    ],

    functional_relationships: {
      'i': [
        { from: 'V', desc: 'Resolución de dominante clásica hacia la tónica menor, de máxima resolución tonal' },
        { from: 'vii°', desc: 'Resolución por semitono (sensible) desde el séptimo grado disminuido' },
        { from: 'iv', desc: 'Cadencia plagal menor tradicional, proporciona un reposo melancólico' },
        { from: 'ii°', desc: 'Paso predominante que conduce suavemente hacia la tónica o al dominante' }
      ],
      'V': [
        { from: 'iv', desc: 'Paso conjunto ascendente de preparación clásica' },
        { from: 'ii°', desc: 'Resolución de preparación por salto de cuarta justa o quinta descendente' },
        { from: '♭VI', desc: 'Medio tono descendente directo del bajo hacia el acorde de tensión dominante' }
      ],
      '♭VI': [
        { from: 'i', desc: 'Paso por tercera descendente de carácter épico' },
        { from: 'iv', desc: 'Tercera ascendente hacia la subdominante' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_hm',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i',
        explanation: 'Dominante principal funcional que resuelve a la tónica menor.',
        variants: ['7', '9', '13', 'b9', '#9', 'b13', 'alt', 'sus4'],
        styles: ['clásico', 'jazz', 'gospel', 'flamenco', 'cine'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_iv_hm',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que prepara la llegada al acorde subdominante menor (iv).',
        variants: ['7', '9', 'b9', '#9', 'b13', 'alt'],
        styles: ['jazz', 'gospel', 'cine'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_bIII_hm',
        category: 'secondary_dominant',
        target_degree: '♭III+',
        function: 'V/♭III',
        explanation: 'Dominante secundario que resuelve al tercer grado aumentado.',
        variants: ['7', '9', 'alt'],
        styles: ['jazz', 'cine'],
        example: 'B7 ➔ C+'
      },
      {
        id: 'V_bVI_hm',
        category: 'secondary_dominant',
        target_degree: '♭VI',
        function: 'V/♭VI',
        explanation: 'Dominante secundario que resuelve al sexto grado bemol mayor.',
        variants: ['7', '9', '13', 'b9', '#9'],
        styles: ['pop', 'jazz', 'gospel'],
        example: 'E7 ➔ F'
      },
      {
        id: 'V_V_hm',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Dominante secundario que prepara la dominante principal (doble dominante).',
        variants: ['7', '9', '13', 'b9', '#9', 'alt'],
        styles: ['clásico', 'jazz', 'gospel'],
        example: 'B7 ➔ E7'
      }
    ],

    modal_interchange: [
      {
        id: 'v_minor_natural_hm',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'v',
        function: 'Quinto menor',
        explanation: 'Préstamo de la escala menor natural, sustituyendo el dominante fuerte mayor V por un acorde menor v para un sonido modal más suave y medieval.',
        styles: ['folk', 'pop', 'cine'],
        example: 'Em en A Menor Armónica'
      },
      {
        id: 'bVII_natural_minor_hm',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: '♭VII',
        function: 'Subtónica mayor',
        explanation: 'Préstamo de la escala menor natural paralela, usando el grado ♭VII en lugar del disminuido diatónico vii° para abrir el color melódico.',
        styles: ['pop', 'rock', 'metal'],
        example: 'G en A Menor Armónica'
      },
      {
        id: 'IV_major_hm',
        category: 'modal_interchange',
        source_scale: 'parallel_major',
        degree: 'IV',
        function: 'Cuarto grado mayor',
        explanation: 'Préstamo de la escala mayor paralela, aportando un tinte brillante de sonoridad Dórica/Lidia.',
        styles: ['jazz', 'rock', 'fusion'],
        example: 'D en A Menor Armónica'
      },
      {
        id: 'I_picardy_third',
        category: 'modal_interchange',
        source_scale: 'parallel_major',
        degree: 'I',
        function: 'Tónica Mayor (Tercera de Picardía)',
        explanation: 'Resolución clásica donde la frase menor termina inesperadamente en un acorde de tónica Mayor, aportando un brillo glorioso al final.',
        styles: ['clásico', 'gospel', 'metal'],
        example: 'A en A Menor Armónica'
      },
      {
        id: 'ii_minor_hm',
        category: 'modal_interchange',
        source_scale: 'melodic_minor',
        degree: 'ii',
        function: 'Segundo menor diatónico',
        explanation: 'Préstamo de la menor melódica paralela, reemplazando el disminuido ii° por un acorde menor ii para suavizar tensiones.',
        styles: ['jazz', 'fusion'],
        example: 'Bm en A Menor Armónica'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_sensible_hm',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Aproximación cromática por semitono inferior mediante un acorde disminuido directo hacia la tónica.',
        example: 'G#dim7 ➔ Am'
      },
      {
        id: 'approach_chrom_sup_hm',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Acorde un semitono por encima del destino resolviendo cromáticamente hacia abajo.',
        example: 'Bbm ➔ Am'
      },
      {
        id: 'approach_chrom_inf_hm',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Acorde un semitono por debajo de la tónica resolviendo cromáticamente hacia arriba.',
        example: 'G#m ➔ Am'
      },
      {
        id: 'approach_enclosure_hm',
        category: 'chromatic_approach',
        name: 'Encierro Cromático menor',
        explanation: 'Aproximación sucesiva por semitono desde arriba y desde abajo hacia la tónica menor.',
        example: 'Bbm ➔ G#m ➔ Am'
      },
      {
        id: 'approach_dom_chrom_hm',
        category: 'chromatic_approach',
        name: 'Dominante Cromático (Sustitución Tritonal)',
        explanation: 'Acorde dominante construido sobre la segunda menor (♭II7) resolviendo por semitono descendente.',
        example: 'Bb7 ➔ Am'
      }
    ],

    cadences: [
      {
        id: 'cad_hm_main',
        category: 'cadence',
        name: 'Cadencia Menor Armónica Principal',
        degrees: ['V', 'i'],
        explanation: 'La resolución clásica insigne de las escalas menores. El acorde de dominante V mayor resuelve con fuerza sobre la tónica i gracias al impulso de la séptima mayor sensible.',
        tension: 'Alta'
      },
      {
        id: 'cad_hm_classical_iv',
        category: 'cadence',
        name: 'Cadencia Clásica Plagal-Dominante',
        degrees: ['iv', 'V', 'i'],
        explanation: 'Cadencia menor fundamental en la música clásica que enlaza la subdominante menor iv, la tensión de V y la resolución final en i.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_hm_classical_ii',
        category: 'cadence',
        name: 'Cadencia Clásica Predominante',
        degrees: ['ii°', 'V', 'i'],
        explanation: 'La cadencia ii-V-i clásica menor. El grado disminuido ii° actúa de predominante para resolver con ímpetu sobre el V y luego en i.',
        tension: 'Alta'
      },
      {
        id: 'cad_hm_sensible_i',
        category: 'cadence',
        name: 'Cadencia de Sensible Disminuida',
        degrees: ['vii°', 'i'],
        explanation: 'Resolución de máxima tensión donde la sensible de séptima disminuida del grado vii° resuelve directamente en la tónica i.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_alt_hm',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Sustitución del acorde de dominante por uno que añada tensiones alteradas (♭9, ♯9) para potenciar la atracción de retorno a la tónica menor.',
        example: 'E7(b9) ➔ Am'
      },
      {
        id: 'reharm_dom_aug_hm',
        category: 'reharmonization',
        name: 'Dominante Aumentado',
        explanation: 'Uso de la quinta aumentada sobre el acorde dominante, acentuando la tensión intervalar.',
        example: 'E7(#5) ➔ Am'
      },
      {
        id: 'reharm_tritone_sub_hm',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde dominante a distancia de tritono (♭II7) para resolver de forma descendente por semitono.',
        example: 'Bb7 ➔ Am'
      },
      {
        id: 'reharm_ii_v_i_jazz_hm',
        category: 'reharmonization',
        name: 'Cadencia ii-V-i con extensiones',
        explanation: 'Resolución por excelencia del jazz y la música popular moderna en tono menor.',
        example: 'Bm7b5 ➔ E7 ➔ Am'
      },
      {
        id: 'reharm_dom_chain_hm',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Preparación cromática mediante el encadenamiento de dominantes secundarios por quintas descendentes hacia el dominante y tónica final.',
        example: 'B7 ➔ E7 ➔ Am'
      },
      {
        id: 'reharm_dim_passing_hm',
        category: 'reharmonization',
        name: 'Disminuido sensible de paso',
        explanation: 'Uso del acorde de séptima disminuida del séptimo grado como transición cromática directa.',
        example: 'G#dim7 ➔ Am'
      }
    ]
  },

  // ==================== 🔵 MODO LOCRIO ♮6 ====================
  locrian_sharp6: {
    name: 'Modo Locrio ♮6',
    version: 1,

    diatonic_functions: [
      { degree: 'iø', function: 'Centro modal', type: 'Inestabilidad', explanation: 'Estabilidad de reposo semidisminuida. Centro tonal inestable pero de sonoridad jazzy y misteriosa.' },
      { degree: '♭II+', function: 'Acorde característico', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado construido sobre la segunda menor (♭2). Ayuda a establecer la identidad del modo.' },
      { degree: '♭iii', function: 'Color', type: 'Color modal', explanation: 'Acorde menor sobre el tercer grado bemol. Ofrece una sonoridad suave y de paso.' },
      { degree: 'iv', function: 'Movimiento', type: 'Preparación modal', explanation: 'Acorde menor sobre el cuarto grado. Aporta preparación melódica de movimiento hacia la tónica o dominante.' },
      { degree: '♭V', function: 'Tensión', type: 'Tensión de dominante', explanation: 'Acorde mayor de quinto grado bemol. Aporta el color de la quinta disminuida característica.' },
      { degree: 'VI°', function: 'Acorde característico', type: 'Tensión disminuida', explanation: 'Acorde disminuido sobre el sexto grado natural. Enfatiza la novena natural / sexta mayor que define el modo.' },
      { degree: '♭vii', function: 'Movimiento', type: 'Resolución modal', explanation: 'Acorde menor sobre el séptimo grado bemol, que conduce suavemente de retorno al centro modal.' }
    ],

    functional_relationships: {
      'iø': [
        { from: '♭II+', desc: 'Cadencia locria ♮6 principal, resolución aumentada a semidisminuida de gran fuerza modal' },
        { from: 'iv', desc: 'Conducción suave menor hacia el reposo inestable' },
        { from: '♭vii', desc: 'Resolución de paso por tono entero descendente' },
        { from: '♭iii', desc: 'Transición por terceras descendentes muy fluida' }
      ],
      'iv': [
        { from: 'iø', desc: 'Movimiento modal que establece la inestabilidad locria' },
        { from: '♭iii', desc: 'Paso conjunto' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_dim_l6',
        category: 'secondary_dominant',
        target_degree: 'iø',
        function: 'V/iø',
        explanation: 'Dominante principal funcional prestado de la menor armónica para resolver en el acorde semidisminuido.',
        variants: ['7', 'b9'],
        styles: ['jazz', 'fusion', 'metal_progressive'],
        example: 'F#7 ➔ Bm7b5'
      },
      {
        id: 'V_iv_l6',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado menor (iv).',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ Em'
      },
      {
        id: 'V_bIII_l6',
        category: 'secondary_dominant',
        target_degree: '♭iii',
        function: 'V/♭iii',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol menor (♭iii).',
        variants: ['7', '9'],
        styles: ['pop', 'jazz'],
        example: 'B7 ➔ D'
      }
    ],

    modal_interchange: [
      {
        id: 'bVI_locrian_l6',
        category: 'modal_interchange',
        source_scale: 'locrian',
        degree: '♭VI',
        function: 'Sexto grado bemol',
        explanation: 'Préstamo del modo Locrio tradicional paralela, introduciendo el acorde ♭VI mayor en lugar de la tensión disminuida VI°.',
        styles: ['jazz', 'metal'],
        example: 'G en B Locrio ♮6'
      },
      {
        id: 'i_minor_natural_l6',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'i',
        function: 'Tónica menor estable',
        explanation: 'Préstamo de la menor natural paralela para resolver la inestabilidad del centro semidisminuido en un acorde menor tradicional.',
        styles: ['pop', 'jazz', 'cinema'],
        example: 'Bm en B Locrio ♮6'
      },
      {
        id: 'vii_dim_armonica_l6',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'vii°',
        function: 'Séptimo disminuido',
        explanation: 'Préstamo de la menor armónica paralela para añadir tensión disminuida cromática.',
        styles: ['jazz', 'fusion'],
        example: 'A#dim7 en B Locrio ♮6'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_dim_inf_l6',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Séptima disminuida resolviendo a la tónica semidisminuida desde medio tono inferior.',
        example: 'A#dim7 ➔ Bm7b5'
      },
      {
        id: 'approach_chrom_sup_l6',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Acorde semidisminuido un semitono por encima del destino resolviendo en paralelo.',
        example: 'Cm7b5 ➔ Bm7b5'
      },
      {
        id: 'approach_chrom_inf_l6',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Acorde semidisminuido un semitono por debajo del destino resolviendo en paralelo.',
        example: 'A#m7b5 ➔ Bm7b5'
      },
      {
        id: 'approach_enclosure_l6',
        category: 'chromatic_approach',
        name: 'Encierro Cromático semidisminuido',
        explanation: 'Aproximación sucesiva por semitono desde arriba y abajo hacia la tónica semidisminuida.',
        example: 'Cm7b5 ➔ A#m7b5 ➔ Bm7b5'
      }
    ],

    cadences: [
      {
        id: 'cad_l6_main',
        category: 'cadence',
        name: 'Cadencia Locria ♮6 Principal',
        degrees: ['♭II+', 'iø'],
        explanation: 'La resolución de firma del modo Locrio ♮6. El acorde característico aumentado ♭II+ resuelve sobre el reposo semidisminuido iø.',
        tension: 'Alta'
      },
      {
        id: 'cad_l6_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['♭vii', '♭II+', 'iø'],
        explanation: 'Progresión que combina el paso del séptimo grado bemol al segundo bemol aumentado para un reposo modal definitivo.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_l6_dark',
        category: 'cadence',
        name: 'Cadencia Oscura Locria ♮6',
        degrees: ['♭iii', '♭II+', 'iø'],
        explanation: 'Movimiento que acentúa la sonoridad misteriosa y la tensión del intervalo ♭2 aumentado.',
        tension: 'Media'
      },
      {
        id: 'cad_l6_cinema',
        category: 'cadence',
        name: 'Cadencia Cinemática',
        degrees: ['VI°', '♭II+', 'iø'],
        explanation: 'Estructura utilizada en bandas sonoras de suspenso y misterio extremo que conecta el acorde disminuido característico de sexto grado con el reposo.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_borrowed_l6',
        category: 'reharmonization',
        name: 'Dominante Funcional Prestado',
        explanation: 'Sustituye la dominante menor diatónica por un acorde dominante mayor prestado de la menor armónica.',
        example: 'F#7 ➔ Bm7b5'
      },
      {
        id: 'reharm_tritone_l6',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde de séptima dominante a medio tono por encima de la tónica.',
        example: 'C7 ➔ Bm7b5'
      },
      {
        id: 'reharm_dim_expanded_l6',
        category: 'reharmonization',
        name: 'Disminuido sensible de aproximación',
        explanation: 'Acorde disminuido sensible resolviendo desde medio tono abajo.',
        example: 'A#dim7 ➔ Bm7b5'
      },
      {
        id: 'reharm_ii_v_borrowed_l6',
        category: 'reharmonization',
        name: 'ii-V funcional prestado',
        explanation: 'Introduce la cadencia ii-V prestada del Modo Locrio #2 para preparar la resolución.',
        example: 'C#m7b5 ➔ F#7 ➔ Bm7b5'
      }
    ]
  },

  // ==================== 🔵 MODO JÓNICO #5 ====================
  ionian_sharp5: {
    name: 'Modo Jónico ♯5',
    version: 1,

    diatonic_functions: [
      { degree: 'I+', function: 'Centro modal', type: 'Estabilidad inestable', explanation: 'Estabilidad aumentada. Centro tonal mayor pero con la tensión de la quinta aumentada que le otorga flotabilidad.' },
      { degree: 'ii', function: 'Movimiento', type: 'Subdominante menor', explanation: 'Acorde menor sobre el segundo grado. Genera un movimiento suave que conduce a la dominante.' },
      { degree: 'iii', function: 'Expansión', type: 'Tónica extendida', explanation: 'Acorde menor de tercer grado. Comparte notas con la tónica, ofreciendo un reposo menor flotante.' },
      { degree: 'IV', function: 'Preparación', type: 'Subdominante mayor', explanation: 'Acorde mayor de cuarto grado. Proporciona un color de apertura e intercambio modal luminoso.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión', explanation: 'Acorde de dominante mayor diatónico. Genera tensión clásica que busca resolver de vuelta a la tónica (I+).' },
      { degree: 'vi°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Acorde disminuido sobre el sexto grado. Introduce fricción y dirección resolutiva.' },
      { degree: 'vii°', function: 'Sensible', type: 'Tensión de dominante máxima', explanation: 'Acorde disminuido construido sobre el séptimo grado. Posee fuerte dirección resolutiva por semitono hacia la tónica.' }
    ],

    functional_relationships: {
      'I+': [
        { from: 'V', desc: 'Cadencia principal de Jónico #5, de tensión a reposo flotante aumentado' },
        { from: 'ii', desc: 'Conducción suave menor hacia el centro modal' },
        { from: 'IV', desc: 'Intercambio de color característico flotante entre I+ e IV' }
      ],
      'V': [
        { from: 'IV', desc: 'Paso conjunto ascendente clásico' },
        { from: 'ii', desc: 'Salto de quinta de preparación dominante' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_V_j5',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Dominante secundario que prepara el acorde de dominante (doble dominante).',
        variants: ['7', '9', '13', 'b9', '#9'],
        styles: ['jazz', 'fusion', 'clásico'],
        example: 'D7 ➔ G'
      },
      {
        id: 'V_ii_j5',
        category: 'secondary_dominant',
        target_degree: 'ii',
        function: 'V/ii',
        explanation: 'Dominante secundario que resuelve al segundo grado menor (ii).',
        variants: ['7', '9', 'b9'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_iii_j5',
        category: 'secondary_dominant',
        target_degree: 'iii',
        function: 'V/iii',
        explanation: 'Dominante secundario que resuelve al tercer grado menor (iii).',
        variants: ['7', '9', 'alt'],
        styles: ['jazz', 'gospel'],
        example: 'B7 ➔ Em'
      },
      {
        id: 'V_I_j5',
        category: 'secondary_dominant',
        target_degree: 'I+',
        function: 'V/I+',
        explanation: 'Dominante secundario que resuelve a la tónica aumentada.',
        variants: ['7', '9', 'alt'],
        styles: ['jazz', 'cinema'],
        example: 'G7 ➔ Cmaj7#5'
      }
    ],

    modal_interchange: [
      {
        id: 'I_major_jonic_j5',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'I',
        function: 'Tónica mayor estable',
        explanation: 'Préstamo de la escala mayor diatónica (Jónica), sustituyendo el inestable acorde aumentado I+ por el Imaj7 tradicional para resolver y estabilizar la quinta.',
        styles: ['pop', 'jazz', 'cinema'],
        example: 'Cmaj7 en C Jónico ♯5'
      },
      {
        id: 'II_major_lydian_j5',
        category: 'modal_interchange',
        source_scale: 'lydian',
        degree: 'II',
        function: 'Segundo grado mayor',
        explanation: 'Préstamo de la escala Lidia paralela, que añade un color brillante de cuarta aumentada al contexto.',
        styles: ['fusion', 'jazz'],
        example: 'D en C Jónico ♯5'
      },
      {
        id: 'I_maj7_11_5_j5',
        category: 'modal_interchange',
        source_scale: 'lydian_augmented',
        degree: 'I_maj7_11_5',
        function: 'Maj7#11#5',
        explanation: 'Préstamo de la escala Lidia Aumentada paralela, enriqueciendo la tónica con una cuarta aumentada adicional.',
        styles: ['jazz_moderno', 'fusion'],
        example: 'Cmaj7#11#5 en C Jónico ♯5'
      },
      {
        id: 'V7_harmonic_minor_j5',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'V7',
        function: 'Dominante de menor armónica',
        explanation: 'Préstamo de la escala menor armónica paralela para añadir una resolución de dominante fuerte.',
        styles: ['jazz', 'clásico'],
        example: 'G7 en C Jónico ♯5'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_chrom_sup_j5',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Acorde mayor un semitono por encima del destino resolviendo cromáticamente hacia abajo.',
        example: 'Dbmaj7#5 ➔ Cmaj7#5'
      },
      {
        id: 'approach_chrom_inf_j5',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Acorde mayor un semitono por debajo del destino resolviendo cromáticamente hacia arriba.',
        example: 'Bmaj7#5 ➔ Cmaj7#5'
      },
      {
        id: 'approach_dim_inf_j5',
        category: 'chromatic_approach',
        name: 'Disminuido sensible inferior',
        explanation: 'Acorde disminuido un semitono por debajo resolviendo hacia la tónica aumentada.',
        example: 'Bdim7 ➔ Cmaj7#5'
      },
      {
        id: 'approach_enclosure_j5',
        category: 'chromatic_approach',
        name: 'Encierro Cromático aumentado',
        explanation: 'Aproximación sucesiva por semitono desde arriba y desde abajo hacia la tónica aumentada.',
        example: 'Dbmaj7#5 ➔ Bmaj7#5 ➔ Cmaj7#5'
      }
    ],

    cadences: [
      {
        id: 'cad_j5_main',
        category: 'cadence',
        name: 'Cadencia Jónica ♯5 Principal',
        degrees: ['V', 'I+'],
        explanation: 'La resolución de firma del modo Jónico #5. El acorde mayor de dominante V resuelve sobre la tónica aumentada I+ aportando tensión flotante.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_j5_extended',
        category: 'cadence',
        name: 'Cadencia Extendida Jónica ♯5',
        degrees: ['ii', 'V', 'I+'],
        explanation: 'La progresión clásica de jazz ii-V-I adaptada al modo Jónico #5 con su tónica aumentada.',
        tension: 'Alta'
      },
      {
        id: 'cad_j5_cinema',
        category: 'cadence',
        name: 'Cadencia Cinemática Jónica ♯5',
        degrees: ['IV', 'V', 'I+'],
        explanation: 'Cadencia de apertura y gran brillo utilizada en bandas sonoras para crear sensaciones de fantasía o misterio luminoso.',
        tension: 'Media-Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_alt_j5',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Sustituye la dominante diatónica por una alterada para incrementar el misterio y la tensión resolutiva hacia el acorde aumentado.',
        example: 'G7(b9) ➔ Cmaj7#5'
      },
      {
        id: 'reharm_tritone_j5',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde dominante a distancia de tritono (♭II7) para resolver de forma descendente por semitono.',
        example: 'Db7 ➔ Cmaj7#5'
      },
      {
        id: 'reharm_dom_chain_j5',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Encadenamiento por círculo de quintas descendente de dominantes secundarios hacia la tónica aumentada.',
        example: 'A7 ➔ D7 ➔ G7 ➔ Cmaj7#5'
      }
    ]
  },

  // ==================== 🔵 MODO DÓRICO #4 ====================
  dorian_sharp4: {
    name: 'Modo Dórico ♯4',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Centro modal', type: 'Estabilidad menor', explanation: 'Estabilidad de reposo menor. Su sonido se enriquece por la tensión de la cuarta aumentada y la sexta mayor.' },
      { degree: 'ii', function: 'Movimiento', type: 'Subdominante menor', explanation: 'Acorde menor sobre el segundo grado. Proporciona paso de predominante para ir al V o resolver en la tónica.' },
      { degree: '♭III+', function: 'Color característico', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado construido sobre el tercer grado. Genera una sonoridad flotante característica.' },
      { degree: '#iv°', function: 'Tensión característica', type: 'Tensión disminuida / Tritono', explanation: 'Acorde disminuido construido sobre la cuarta aumentada (#4). Aporta la firma intervalar de tensión del modo.' },
      { degree: 'v', function: 'Movimiento', type: 'Subdominante modal', explanation: 'Acorde menor sobre el quinto grado. Aporta preparación de movimiento suave hacia la tónica.' },
      { degree: 'vi°', function: 'Tensión', type: 'Tensión semidisminuida', explanation: 'Acorde semidisminuido sobre el sexto grado natural. Enfatiza la sexta mayor que define el sonido dórico.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Resolución abierta', explanation: 'Acorde mayor de séptimo grado bemol. Conduce con suavidad hacia el reposo final de tónica menor.' }
    ],

    functional_relationships: {
      'i': [
        { from: '♭VII', desc: 'Cadencia principal de Dórico #4, resolución abierta por tono entero descendente en el bajo' },
        { from: '#iv°', desc: 'Resolución de tensión característica modal, con el tritono resolviendo directamente' },
        { from: '♭III+', desc: 'Movimiento característico que introduce el brillo del acorde aumentado' },
        { from: 'ii', desc: 'Conducción suave predominante menor hacia el reposo' }
      ],
      '#iv°': [
        { from: 'i', desc: 'Movimiento característico que establece la tensión modal dórica-lidia' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_d4',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i',
        explanation: 'Dominante principal funcional que resuelve a la tónica menor.',
        variants: ['7', '9', 'b9', '#9', 'alt'],
        styles: ['clásico', 'jazz', 'gospel', 'cine'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_v_d4',
        category: 'secondary_dominant',
        target_degree: 'v',
        function: 'V/v',
        explanation: 'Dominante secundario que resuelve al quinto grado menor.',
        variants: ['7', '9', 'b9'],
        styles: ['jazz', 'fusion'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_bIII_d4',
        category: 'secondary_dominant',
        target_degree: '♭III+',
        function: 'V/♭III+',
        explanation: 'Dominante secundario que resuelve al tercer grado bemol aumentado.',
        variants: ['7', '9', 'alt'],
        styles: ['jazz', 'cine'],
        example: 'C7 ➔ F+'
      }
    ],

    modal_interchange: [
      {
        id: 'IV_dorian_natural_d4',
        category: 'modal_interchange',
        source_scale: 'dorian',
        degree: 'IV',
        function: 'Cuarto grado mayor natural',
        explanation: 'Préstamo de la escala Dórica natural paralela, sustituyendo la inestable cuarta aumentada #iv° por la cuarta justa mayor IV para comparar el color 4 vs #4.',
        styles: ['jazz', 'fusion', 'rock'],
        example: 'G en D Dórico ♯4'
      },
      {
        id: 'bVI_natural_minor_d4',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: '♭VI',
        function: 'Sexto grado bemol',
        explanation: 'Préstamo de la menor natural paralela, introduciendo el acorde ♭VI mayor en lugar de la tensión disminuida vi°.',
        styles: ['pop', 'rock', 'cine'],
        example: 'Bb en D Dórico ♯4'
      },
      {
        id: 'ii_dim_natural_minor_d4',
        category: 'modal_interchange',
        source_scale: 'natural_minor',
        degree: 'ii°',
        function: 'ii semidisminuido',
        explanation: 'Préstamo de la menor natural paralela, convirtiendo el acorde ii menor diatónico en un acorde semidisminuido ii°.',
        styles: ['jazz', 'fusion'],
        example: 'Em7b5 en D Dórico ♯4'
      },
      {
        id: 'II_lydian_d4',
        category: 'modal_interchange',
        source_scale: 'lydian',
        degree: 'II',
        function: 'Segundo grado mayor',
        explanation: 'Préstamo de la escala Lidia paralela, aportando un brillo mayor al bajo.',
        styles: ['fusion', 'jazz'],
        example: 'E en D Dórico ♯4'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_chrom_sup_d4',
        category: 'chromatic_approach',
        name: 'Aproximación cromática superior',
        explanation: 'Acorde menor un semitono por encima del destino resolviendo cromáticamente hacia abajo.',
        example: 'Ebm ➔ Dm'
      },
      {
        id: 'approach_chrom_inf_d4',
        category: 'chromatic_approach',
        name: 'Aproximación cromática inferior',
        explanation: 'Acorde menor un semitono por debajo del destino resolviendo cromáticamente hacia arriba.',
        example: 'C#m ➔ Dm'
      },
      {
        id: 'approach_dim_inf_d4',
        category: 'chromatic_approach',
        name: 'Disminuido de aproximación inferior',
        explanation: 'Acorde de séptima disminuida del grado sensible resolviendo desde medio tono inferior.',
        example: 'C#dim7 ➔ Dm'
      },
      {
        id: 'approach_enclosure_d4',
        category: 'chromatic_approach',
        name: 'Encierro Cromático menor',
        explanation: 'Aproximación sucesiva por semitono desde arriba y desde abajo hacia la tónica menor.',
        example: 'Ebm ➔ C#m ➔ Dm'
      }
    ],

    cadences: [
      {
        id: 'cad_d4_main',
        category: 'cadence',
        name: 'Cadencia Dórica ♯4 Principal',
        degrees: ['♭VII', 'i'],
        explanation: 'La resolución de firma del modo Dórico #4, resolviendo el grado mayor ♭VII sobre la tónica menor i.',
        tension: 'Media'
      },
      {
        id: 'cad_d4_modal_char',
        category: 'cadence',
        name: 'Cadencia Modal Característica',
        degrees: ['#iv°', 'i'],
        explanation: 'Enlace de alta tensión que conecta el grado disminuido característico #iv° con la tónica i.',
        tension: 'Alta'
      },
      {
        id: 'cad_d4_extended',
        category: 'cadence',
        name: 'Cadencia Predominante ii-V-i',
        degrees: ['ii', 'V', 'i'],
        explanation: 'Conducción que conecta el segundo grado, la dominante y la tónica menor.',
        tension: 'Alta'
      },
      {
        id: 'cad_d4_cinema',
        category: 'cadence',
        name: 'Cadencia Cinemática Aumentada',
        degrees: ['♭III+', 'i'],
        explanation: 'Resolución de paso que utiliza el acorde aumentado característico para una resolución flotante.',
        tension: 'Media-Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_dom_alt_d4',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Sustituye la dominante diatónica por una alterada para potenciar la atracción hacia la tónica menor.',
        example: 'A7(b9) ➔ Dm'
      },
      {
        id: 'reharm_tritone_d4',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso de un acorde de séptima dominante a medio tono por encima de la tónica.',
        example: 'Eb7 ➔ Dm'
      },
      {
        id: 'reharm_dim_expanded_d4',
        category: 'reharmonization',
        name: 'Disminuido Expandido',
        explanation: 'Acorde disminuido sensible resolviendo desde medio tono abajo.',
        example: 'C#dim7 ➔ Dm'
      },
      {
        id: 'reharm_ii_v_i_d4',
        category: 'reharmonization',
        name: 'ii-V-i con intercambio modal',
        explanation: 'Uso de la cadencia ii-V-i en menor con el ii semidisminuido prestado de la menor natural.',
        example: 'Em7b5 ➔ A7 ➔ Dm'
      },
      {
        id: 'reharm_dom_chain_d4',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Preparación cromática mediante el encadenamiento de dominantes secundarios por quintas descendentes.',
        example: 'E7 ➔ A7 ➔ Dm'
      }
    ]
  },

  // ==================== 🔵 MODO FRIGIO DOMINANTE ====================
  phrygian_dominant: {
    name: 'Modo Frigio Dominante',
    version: 1,
    popularity: 'muy_alta',
    educational_priority: 'alta',

    diatonic_functions: [
      { degree: 'I', function: 'Centro modal dominante', type: 'Estabilidad dominante', explanation: 'Acorde mayor o de séptima sobre el primer grado. Aporta estabilidad con gran color y tensión de dominante.' },
      { degree: '♭II', function: 'Acorde característico', type: 'Color característico / Tensión', explanation: 'Acorde mayor sobre la segunda menor. Define la identidad y el contraste frigio fundamental del modo.' },
      { degree: 'iii°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Acorde disminuido sobre la tercera mayor. Funciona como sensible secundaria o tensión modal.' },
      { degree: 'iv', function: 'Movimiento', type: 'Subdominante menor', explanation: 'Acorde menor de cuarto grado. Proporciona paso de preparación melancólica y fluidez melódica.' },
      { degree: 'v°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Acorde disminuido sobre el quinto grado. Aporta fricción armónica y tensión de paso.' },
      { degree: '♭VI+', function: 'Color característico', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado sobre el sexto grado bemol. Genera una sonoridad majestuosa y expansiva.' },
      { degree: '♭vii', function: 'Movimiento', type: 'Movimiento modal', explanation: 'Acorde menor sobre la séptima menor. Conduce con suavidad hacia la tónica dominante o el segundo grado.' }
    ],

    functional_relationships: {
      'I': [
        { from: '♭II', desc: 'Resolución frigia dominante característica estrella por semitono descendente en el bajo, de gran color exótico' },
        { from: '♭VI+', desc: 'Movimiento secundario de gran tensión que resuelve el acorde aumentado sobre la tónica dominante' },
        { from: 'iv', desc: 'Cadencia plagal menor que proporciona un reposo suave y melancólico' },
        { from: '♭vii', desc: 'Resolución modal suave por paso conjunto de tono entero descendente' }
      ],
      '♭II': [
        { from: 'I', desc: 'Movimiento de tensión característico que establece la sonoridad frigia' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_iv_pd',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado menor (iv).',
        variants: ['7', '9', 'b9', '#9', 'alt'],
        styles: ['flamenco', 'jazz', 'gospel'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_bVI_pd',
        category: 'secondary_dominant',
        target_degree: '♭VI+',
        function: 'V/♭VI+',
        explanation: 'Dominante secundario que resuelve al sexto grado bemol aumentado.',
        variants: ['7', '9'],
        styles: ['cine', 'fusion'],
        example: 'G7 ➔ C+'
      },
      {
        id: 'V_bvii_pd',
        category: 'secondary_dominant',
        target_degree: '♭vii',
        function: 'V/♭vii',
        explanation: 'Dominante secundario que resuelve al séptimo grado bemol menor.',
        variants: ['7', '9', 'sus4'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ D'
      }
    ],

    modal_interchange: [
      {
        id: 'i_frigio_pd',
        category: 'modal_interchange',
        source_scale: 'phrygian',
        degree: 'i',
        function: 'Color frigio menor',
        explanation: 'Préstamo del modo Frigio paralelo, convirtiendo la tónica dominante en menor para comparar la tercera menor frente a la tercera mayor.',
        styles: ['flamenco', 'jazz', 'fusion'],
        example: 'Em en E Frigio Dominante'
      },
      {
        id: 'vii_harmonic_minor_pd',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'vii°7',
        function: 'Tensión disminuida',
        explanation: 'Préstamo de la menor armónica paralela, introduciendo el acorde de séptima disminuida sensible para máxima tensión.',
        styles: ['clásico', 'metal', 'cine'],
        example: 'D#dim7 en E Frigio Dominante'
      },
      {
        id: 'IV_mixolydian_pd',
        category: 'modal_interchange',
        source_scale: 'mixolydian',
        degree: 'IV',
        function: 'Brillo mayor',
        explanation: 'Préstamo del modo Mixolidio paralelo, sustituyendo la subdominante menor por el cuarto grado mayor para suavizar la atmósfera.',
        styles: ['fusion', 'rock', 'jazz'],
        example: 'A en E Frigio Dominante'
      },
      {
        id: 'ii_minor_pd',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'ii',
        function: 'Suavidad diatónica',
        explanation: 'Préstamo del modo mayor paralelo, utilizando el segundo grado menor para variar según el contexto armónico.',
        styles: ['fusion', 'jazz'],
        example: 'Fm en E Frigio Dominante'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_sup_pd',
        category: 'chromatic_approach',
        name: 'Aproximación Superior',
        explanation: 'Aproximarse a la tónica desde un semitono arriba con un acorde menor.',
        example: 'Fm ➔ E'
      },
      {
        id: 'approach_inf_pd',
        category: 'chromatic_approach',
        name: 'Aproximación Inferior',
        explanation: 'Aproximarse a la tónica desde un semitono abajo con un acorde menor.',
        example: 'D#m ➔ E'
      },
      {
        id: 'approach_dim_pd',
        category: 'chromatic_approach',
        name: 'Disminuido de Aproximación',
        explanation: 'Acorde de séptima disminuida resolviendo desde medio tono inferior.',
        example: 'D#dim7 ➔ E'
      },
      {
        id: 'approach_enclosure_pd',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Combinación sucesiva de aproximación cromática superior e inferior antes de resolver.',
        example: 'Fm ➔ D#m ➔ E'
      },
      {
        id: 'approach_tritone_pd',
        category: 'chromatic_approach',
        name: 'Aproximación Tritonal',
        explanation: 'Aproximación cromática por semitono descendente desde un acorde de séptima dominante.',
        example: 'Bb7 ➔ E'
      }
    ],

    cadences: [
      {
        id: 'cad_pd_main',
        category: 'cadence',
        name: 'Cadencia Frigia Dominante Principal',
        degrees: ['♭II', 'I'],
        explanation: 'La resolución de firma del modo Frigio Dominante, resolviendo el grado mayor característico ♭II sobre la tónica dominante I.',
        tension: 'Alta'
      },
      {
        id: 'cad_pd_flamenco',
        category: 'cadence',
        name: 'Cadencia Flamenca (Andaluza)',
        degrees: ['iv', 'iii°', '♭II', 'I'],
        explanation: 'La célebre cadencia flamenca descendente que define el sonido tradicional andaluz.',
        tension: 'Media-Alta'
      },
      {
        id: 'cad_pd_extended',
        category: 'cadence',
        name: 'Cadencia Modal Extendida',
        degrees: ['♭vii', '♭II', 'I'],
        explanation: 'Extensión de la cadencia principal usando el acorde de séptima menor para suavizar la resolución.',
        tension: 'Media'
      },
      {
        id: 'cad_pd_epic',
        category: 'cadence',
        name: 'Cadencia Épica',
        degrees: ['♭VI+', '♭II', 'I'],
        explanation: 'Progresión majestuosa que combina el color aumentado del sexto grado bemol con la segunda bemol característica.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_pd',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Uso de la tónica dominante con novena bemol para enriquecer la tensión.',
        example: 'E7(b9)'
      },
      {
        id: 'reharm_tritone_pd',
        category: 'reharmonization',
        name: 'Sustituto Tritonal',
        explanation: 'Reemplazo del dominante por un acorde dominante a distancia de tritono.',
        example: 'Bb7 ➔ E'
      },
      {
        id: 'reharm_dim_pd',
        category: 'reharmonization',
        name: 'Sustitución Disminuida',
        explanation: 'Resolución de tensión disminuida desde la sensible secundaria.',
        example: 'D#dim7 ➔ E'
      },
      {
        id: 'reharm_chain_pd',
        category: 'reharmonization',
        name: 'Cadena de Dominantes',
        explanation: 'Resolución encadenada de dominantes secundarios.',
        example: 'B7 ➔ E7'
      },
      {
        id: 'reharm_flamenco_exp',
        category: 'reharmonization',
        name: 'Flamenca Expandida',
        explanation: 'Progresión flamenca expandida utilizando acordes de paso mayores.',
        example: 'Am ➔ G ➔ F ➔ E'
      }
    ]
  },

  // ==================== 🔵 MODO LIDIO #2 ====================
  lydian_sharp2: {
    name: 'Modo Lidio ♯2',
    version: 1,
    popularity: 'media_alta',
    educational_priority: 'alta',

    diatonic_functions: [
      { degree: 'I', function: 'Centro modal', type: 'Estabilidad brillante', explanation: 'Acorde mayor con séptima mayor y cuarta aumentada. Representa el color estrella de ensueño y misticismo flotante.' },
      { degree: '♯ii°', function: 'Tensión característica', type: 'Tensión disminuida', explanation: 'Acorde disminuido sobre la segunda aumentada. Aporta una fuerte fricción armónica y el color intervalar característico.' },
      { degree: 'iii+', function: 'Color', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado sobre el tercer grado. Genera inestabilidad con una sonoridad flotante poco común.' },
      { degree: '♯iv°', function: 'Color característico', type: 'Tensión semidisminuida / Tritono', explanation: 'Acorde semidisminuido sobre la cuarta aumentada. Enfatiza el carácter Lidio del modo.' },
      { degree: 'V', function: 'Expansión', type: 'Estabilidad alternativa', explanation: 'Acorde mayor de quinto grado. Proporciona expansión y contraste brillante frente a la tónica.' },
      { degree: 'vi', function: 'Relativo', type: 'Movimiento menor', explanation: 'Acorde menor de sexto grado. Funciona como descanso de color relativo menor.' },
      { degree: 'vii', function: 'Sensible', type: 'Tensión / Movimiento', explanation: 'Acorde menor de séptimo grado. Aporta dirección y conducción hacia la tónica.' }
    ],

    functional_relationships: {
      'I': [
        { from: 'V', desc: 'Resolución de expansión a tónica brillante, de carácter expansivo y muy resolutivo' },
        { from: '♯ii°', desc: 'Movimiento característico que introduce tensión disminuida por semitono descendente hacia la tónica' }
      ],
      'V': [
        { from: 'I', desc: 'Movimiento característico de expansión tonal' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_V_l2',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Dominante secundario que resuelve al quinto grado.',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'D7 ➔ G'
      },
      {
        id: 'V_vi_l2',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario que resuelve al sexto grado relativo menor.',
        variants: ['7', '9'],
        styles: ['jazz', 'gospel'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_I_l2',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V/I',
        explanation: 'Dominante principal funcional que resuelve al centro modal.',
        variants: ['7', '9', 'alt'],
        styles: ['clásico', 'jazz', 'cine'],
        example: 'C7 ➔ Fmaj7(#11)'
      }
    ],

    modal_interchange: [
      {
        id: 'II_lidia_l2',
        category: 'modal_interchange',
        source_scale: 'lydian',
        degree: 'II',
        function: 'Segundo grado mayor',
        explanation: 'Préstamo del modo Lidio natural paralelo, sustituyendo el acorde de segunda aumentada disminuido por un segundo grado mayor para comparar el color de la segunda mayor frente a la segunda aumentada (#2 vs 2).',
        styles: ['jazz', 'fusion'],
        example: 'G en F Lidio ♯2'
      },
      {
        id: 'IV_jónica_l2',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'IV',
        function: 'Cuarto grado mayor natural',
        explanation: 'Préstamo de la escala mayor/jónica paralela, introduciendo el acorde de cuarto grado justo para relajar la tensión de la cuarta aumentada.',
        styles: ['pop', 'rock', 'gospel'],
        example: 'Bb en F Lidio ♯2'
      },
      {
        id: 'Imaj7#5_ionian_sharp5_l2',
        category: 'modal_interchange',
        source_scale: 'ionian_sharp5',
        degree: 'I+',
        function: 'Tónica aumentada',
        explanation: 'Préstamo de la escala Jónica #5 paralela, introduciendo una tónica aumentada para variar la repetición con una tensión misteriosa.',
        styles: ['cine', 'jazz', 'fusion'],
        example: 'Fmaj7#5 en F Lidio ♯2'
      },
      {
        id: 'ii_minor_l2',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'ii',
        function: 'Segundo grado menor',
        explanation: 'Préstamo de la escala mayor paralela, introduciendo el segundo grado menor para variar según el contexto armónico.',
        styles: ['jazz', 'fusion'],
        example: 'Gm en F Lidio ♯2'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_sup_l2',
        category: 'chromatic_approach',
        name: 'Aproximación Superior',
        explanation: 'Aproximarse a la tónica mediante un acorde mayor un semitono por encima.',
        example: 'Gbmaj7 ➔ Fmaj7'
      },
      {
        id: 'approach_inf_l2',
        category: 'chromatic_approach',
        name: 'Aproximación Inferior',
        explanation: 'Aproximarse a la tónica mediante un acorde mayor un semitono por debajo.',
        example: 'Emaj7 ➔ Fmaj7'
      },
      {
        id: 'approach_dim_l2',
        category: 'chromatic_approach',
        name: 'Disminuido de Aproximación',
        explanation: 'Acorde de séptima disminuida resolviendo desde medio tono inferior.',
        example: 'Edim7 ➔ Fmaj7'
      },
      {
        id: 'approach_enclosure_l2',
        category: 'chromatic_approach',
        name: 'Encierro Cromático',
        explanation: 'Aproximación sucesiva por semitono desde arriba y desde abajo hacia la tónica.',
        example: 'Gbmaj7 ➔ Emaj7 ➔ Fmaj7'
      },
      {
        id: 'approach_tritone_l2',
        category: 'chromatic_approach',
        name: 'Sustituto Tritonal',
        explanation: 'Aproximación cromática descendente utilizando un acorde de séptima dominante a distancia de tritono.',
        example: 'B7 ➔ Fmaj7'
      }
    ],

    cadences: [
      {
        id: 'cad_l2_main',
        category: 'cadence',
        name: 'Cadencia Lidia ♯2 Principal',
        degrees: ['V', 'I'],
        explanation: 'Resolución de expansión de dominante al centro modal Lidio #2.',
        tension: 'Media'
      },
      {
        id: 'cad_l2_modal',
        category: 'cadence',
        name: 'Cadencia Lidia ♯2 Modal Característica',
        degrees: ['♯ii°', 'I'],
        explanation: 'Resolución directa de la segunda aumentada disminuida sobre la tónica, de carácter muy tenso y misterioso.',
        tension: 'Alta'
      },
      {
        id: 'cad_l2_cinematic',
        category: 'cadence',
        name: 'Cadencia Lidia ♯2 Cinemática',
        degrees: ['I', 'V', 'I'],
        explanation: 'Progresión típica de bandas sonoras que navega entre la tónica y el quinto grado para generar amplitud.',
        tension: 'Media'
      },
      {
        id: 'cad_l2_expansive',
        category: 'cadence',
        name: 'Cadencia Lidia ♯2 Expansiva',
        degrees: ['I', '♯ii°', 'V', 'I'],
        explanation: 'Cadencia completa que pasa por la tensión característica antes de resolver a través de la expansión de V.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_l2',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Uso del acorde de dominante principal con novena bemol para enriquecer la resolución.',
        example: 'C7(b9) ➔ Fmaj7(#11)'
      },
      {
        id: 'reharm_tritone_l2',
        category: 'reharmonization',
        name: 'Sustituto Tritonal',
        explanation: 'Reemplazo del dominante por un acorde dominante a distancia de tritono.',
        example: 'Gb7 ➔ Fmaj7'
      },
      {
        id: 'reharm_dim_l2',
        category: 'reharmonization',
        name: 'Sustitución Disminuida',
        explanation: 'Uso de un acorde de séptima disminuida resolviendo desde un semitono por debajo.',
        example: 'Edim7 ➔ Fmaj7'
      },
      {
        id: 'reharm_chain_l2',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Progresión cíclica de acordes dominantes que resuelven cíclicamente hacia la tónica.',
        example: 'A7 ➔ D7 ➔ G7 ➔ C7 ➔ F'
      },
      {
        id: 'reharm_modal_sub_l2',
        category: 'reharmonization',
        name: 'Sustitución Modal de Tónica',
        explanation: 'Sustitución del acorde de tónica mayor convencional por la versión extendida de tónica con cuarta aumentada.',
        example: 'Fmaj7 ↔ Fmaj7(#11)'
      }
    ]
  },

  // ==================== 🔵 MODO SUPERLOCRIO DISMINUIDO ====================
  ultralocrian: {
    name: 'Modo Superlocrio Disminuido',
    version: 1,
    popularity: 'media_alta',
    educational_priority: 'alta',

    diatonic_functions: [
      { degree: 'i°', function: 'Centro inestable de tensión', type: 'Tensión máxima', explanation: 'Acorde disminuido sobre el primer grado. No funciona como centro estable de reposo sino como foco de máxima tensión o dominante alterado extremo.' },
      { degree: '♭ii', function: 'Movimiento menor', type: 'Transición', explanation: 'Acorde menor de segunda bemol. Aporta una sonoridad inusual de paso.' },
      { degree: '♭iii°', function: 'Tensión disminuida', type: 'Tensión / Movimiento', explanation: 'Acorde semidisminuido sobre el tercer grado bemol.' },
      { degree: '♭iv+', function: 'Color aumentado', type: 'Color aumentado', explanation: 'Acorde aumentado sobre el cuarto grado bemol.' },
      { degree: '♭v', function: 'Movimiento', type: 'Transición menor', explanation: 'Acorde menor de quinto grado bemol.' },
      { degree: '♭VI', function: 'Tensión dominante', type: 'Tensión dominante', explanation: 'Acorde mayor de sexta bemol. Funciona como el dominante funcional de paso.' },
      { degree: '♭♭VII', function: 'Expansión', type: 'Estabilidad de expansión', explanation: 'Acorde mayor sobre la séptima disminuida, actuando como el respiro brillante en el modo.' }
    ],

    functional_relationships: {
      'i°': [
        { from: '♭VI', desc: 'Resolución de tensión dominante al centro inestable de la escala' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_iv_ul',
        category: 'secondary_dominant',
        target_degree: '♭iv+',
        function: 'V/iv',
        explanation: 'Dominante secundario que resuelve al cuarto grado.',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'V_bVII_ul',
        category: 'secondary_dominant',
        target_degree: '♭♭VII',
        function: 'V/♭♭VII',
        explanation: 'Dominante secundario que resuelve al séptimo grado bemol disminuido.',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'G7 ➔ C'
      }
    ],

    modal_interchange: [
      {
        id: 'locrian_rel_ul',
        category: 'modal_interchange',
        source_scale: 'locrian',
        degree: 'i°',
        function: 'Tensión Locria',
        explanation: 'Relación con el modo Locrio natural para suavizar la inestabilidad de la tónica mediante una resolución por tono entero.',
        styles: ['jazz', 'fusion'],
        example: 'Adim7 ➔ G#dim7'
      },
      {
        id: 'locrian_sharp6_rel_ul',
        category: 'modal_interchange',
        source_scale: 'locrian_sharp6',
        degree: 'iø',
        function: 'Tensión modal expandida',
        explanation: 'Relación con el modo Locrio ♯6 para modular a una sonoridad semidisminuida menos tensa.',
        styles: ['jazz', 'fusion'],
        example: 'Am7b5 en G#'
      }
    ],

    chromatic_approaches: [
      {
        id: 'approach_sup_ul',
        category: 'chromatic_approach',
        name: 'Aproximación Superior (Encierro)',
        explanation: 'Aproximación cromática descendente utilizando un acorde de séptima dominante.',
        example: 'Bb7 ➔ A'
      },
      {
        id: 'approach_inf_ul',
        category: 'chromatic_approach',
        name: 'Aproximación Inferior (Encierro)',
        explanation: 'Aproximarse al destino desde un semitono por debajo.',
        example: 'Ab7 ➔ A'
      },
      {
        id: 'approach_dim_ul',
        category: 'chromatic_approach',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde de séptima disminuida sensible resolviendo desde medio tono inferior.',
        example: 'G#dim7 ➔ A'
      },
      {
        id: 'approach_enclosure_ul',
        category: 'chromatic_approach',
        name: 'Encierro Completo',
        explanation: 'Aproximación rodeando el destino desde arriba y abajo sucesivamente.',
        example: 'Bb7 ➔ Ab7 ➔ A'
      },
      {
        id: 'approach_chrom_ext_ul',
        category: 'chromatic_approach',
        name: 'Aproximación Cromática Extendida',
        explanation: 'Encadenamiento de acordes dominantes que resuelven por semitono descendente.',
        example: 'Bb7 ➔ A7 ➔ A'
      }
    ],

    cadences: [
      {
        id: 'cad_ul_main',
        category: 'cadence',
        name: 'Cadencia Principal Alterada',
        degrees: ['♭VI', 'i°'],
        explanation: 'Resolución de dominante alterado extremo sobre la tónica disminuida.',
        tension: 'Alta'
      },
      {
        id: 'cad_ul_jazz',
        category: 'cadence',
        name: 'Cadencia Jazz Alterada',
        degrees: ['♭iii°', '♭VI', 'i°'],
        explanation: 'La clásica progresión ii-V-i en un contexto de dominante extremadamente alterado.',
        tension: 'Alta'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_ul',
        category: 'reharmonization',
        name: 'Dominante Alterado Máximo',
        explanation: 'Uso de la tónica con alteraciones extremas como b9, #9, #11 y b13.',
        example: 'E7alt ➔ Am'
      },
      {
        id: 'reharm_tritone_ul',
        category: 'reharmonization',
        name: 'Sustituto Tritonal Alterado',
        explanation: 'Reemplazo de un dominante por su sustituto de tritono con tensiones alteradas.',
        example: 'Bb7alt ➔ Am'
      },
      {
        id: 'reharm_dim_sym_ul',
        category: 'reharmonization',
        name: 'Disminuido Simétrico',
        explanation: 'Uso de un acorde disminuido de séptima simétrico para resolver.',
        example: 'G#dim7 ➔ Am'
      },
      {
        id: 'reharm_dom_chain_ul',
        category: 'reharmonization',
        name: 'Dominantes Encadenados Alterados',
        explanation: 'Resolución encadenada de dominantes secundarios alterados.',
        example: 'B7alt ➔ E7alt ➔ Am'
      },
      {
        id: 'reharm_susp_ul',
        category: 'reharmonization',
        name: 'Resolución Suspendida',
        explanation: 'Resolución suave de dominante alterado a un acorde de tónica mayor.',
        example: 'E7alt ➔ Amaj7'
      }
    ]
  },

  // ==================== 🔵 FAMILIA MENOR MELÓDICA (NIVEL 3) ====================
  melodic_minor: {
    name: 'Menor Melódica',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Centro tonal', type: 'Estabilidad menor', explanation: 'Centro de reposo menor con color melódico sofisticado.' },
      { degree: 'ii', function: 'Movimiento', type: 'Paso menor', explanation: 'Segundo grado menor que aporta una fluidez excepcional.' },
      { degree: '♭III+', function: 'Color característico', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado que proporciona gran tensión flotante.' },
      { degree: 'IV', function: 'Subdominante', type: 'Apertura mayor', explanation: 'Cuarto grado mayor que rompe el carácter menor clásico.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión dominante', explanation: 'Dominante mayor diatónico que ejerce fuerte atracción hacia i.' },
      { degree: 'vi°', function: 'Tensión', type: 'Paso semidisminuido', explanation: 'Grado semidisminuido característico del sistema.' },
      { degree: 'vii°', function: 'Sensible', type: 'Tensión resolutiva', explanation: 'Séptimo grado semidisminuido que busca resolver en la tónica menor.' }
    ],

    functional_relationships: {
      'i': [
        { from: 'V', desc: 'Resolución de dominante clásica hacia la tónica menor melódica' },
        { from: 'vii°', desc: 'Resolución por semitono sensible' },
        { from: 'IV', desc: 'Cadencia plagal mayor brillante y moderna' },
        { from: 'ii', desc: 'Paso menor suave hacia la tónica' }
      ],
      'V': [
        { from: 'ii', desc: 'Salto de cuarta de preparación' },
        { from: 'IV', desc: 'Paso conjunto descendente' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_mm',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i',
        explanation: 'Dominante principal funcional que resuelve a la tónica menor.',
        variants: ['7', 'b9', '#9', 'alt'],
        styles: ['jazz', 'fusion', 'gospel'],
        example: 'E7 ➔ Am(maj7)'
      },
      {
        id: 'V_IV_mm',
        category: 'secondary_dominant',
        target_degree: 'IV',
        function: 'V/IV',
        explanation: 'Dominante secundario al cuarto grado mayor.',
        variants: ['7', '9'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ D'
      },
      {
        id: 'V_V_mm',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V',
        explanation: 'Doble dominante hacia el acorde V.',
        variants: ['7', 'alt'],
        styles: ['jazz', 'gospel'],
        example: 'B7 ➔ E7'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_flat_vi_mm',
        category: 'modal_interchange',
        name: 'Acorde ♭VI (Menor Natural)',
        explanation: 'Préstamo del sexto grado mayor de la escala menor natural.',
        example: 'F'
      },
      {
        id: 'mi_flat_vii_mm',
        category: 'modal_interchange',
        name: 'Acorde ♭VII (Menor Natural)',
        explanation: 'Préstamo del séptimo grado mayor de la escala menor natural.',
        example: 'G'
      },
      {
        id: 'mi_iv_min_mm',
        category: 'modal_interchange',
        name: 'Grado iv menor (Menor Armónica)',
        explanation: 'Préstamo del cuarto grado menor de la menor armónica.',
        example: 'Dm'
      },
      {
        id: 'mi_v_alt_mm',
        category: 'modal_interchange',
        name: 'Dominante V7(♭9) (Menor Armónica)',
        explanation: 'Préstamo del dominante alterado de la menor armónica.',
        example: 'E7(b9)'
      },
      {
        id: 'mi_i_maj_mm',
        category: 'modal_interchange',
        name: 'Tónica I Mayor (Mayor Paralela)',
        explanation: 'Préstamo de tónica mayor paralela para dar un reposo brillante.',
        example: 'Amaj7'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_mm',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación por semitono superior.',
        example: 'Bbm ➔ Am(maj7)'
      },
      {
        id: 'chrom_inf_mm',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación por semitono inferior.',
        example: 'G#m ➔ Am(maj7)'
      },
      {
        id: 'chrom_dim_mm',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible que resuelve a la tónica.',
        example: 'G#dim7 ➔ Am(maj7)'
      },
      {
        id: 'chrom_enc_mm',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro por arriba y abajo hacia la tónica.',
        example: 'Bbm ➔ G#m ➔ Am(maj7)'
      },
      {
        id: 'chrom_tri_mm',
        category: 'chromatic',
        name: 'Aproximación Tritonal',
        explanation: 'Acorde dominante un semitono superior (sustituto tritonal).',
        example: 'Bb7 ➔ Am(maj7)'
      }
    ],

    cadences: [
      {
        id: 'cad_ii_v_i_mm',
        category: 'cadence',
        name: 'ii - V - i',
        explanation: 'Cadencia menor melódica principal.',
        example: 'Bm7b5 ➔ E7 ➔ Am(maj7)'
      },
      {
        id: 'cad_iv_v_i_mm',
        category: 'cadence',
        name: 'IV - V - i',
        explanation: 'Cadencia moderna con subdominante mayor.',
        example: 'D ➔ E7 ➔ Am(maj7)'
      },
      {
        id: 'cad_ii_v_i_iv_mm',
        category: 'cadence',
        name: 'ii - V - i - IV',
        explanation: 'Cadencia extendida en estilo jazz.',
        example: 'Bm7b5 ➔ E7 ➔ Am(maj7) ➔ D'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_mm',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Reharmonizar el V7 como un dominante alterado.',
        example: 'E7alt ➔ Am(maj7)'
      },
      {
        id: 'reharm_tritone_mm',
        category: 'reharmonization',
        name: 'Sustituto Tritonal',
        explanation: 'Reemplazo del dominante por su sustituto de tritono.',
        example: 'Bb7alt ➔ Am(maj7)'
      },
      {
        id: 'reharm_ii_v_i_exp_mm',
        category: 'reharmonization',
        name: 'ii-V-i Expandido',
        explanation: 'Incorporación de tensiones complejas sobre la cadencia.',
        example: 'Bm7b5 ➔ E7alt ➔ Am(maj7)'
      },
      {
        id: 'reharm_dom_chain_mm',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Resolución encadenada de dominantes secundarios.',
        example: 'F#7 ➔ B7 ➔ E7 ➔ Am(maj7)'
      },
      {
        id: 'reharm_backdoor_mm',
        category: 'reharmonization',
        name: 'Backdoor',
        explanation: 'Resolución backdoor desde el grado ♭VII.',
        example: 'G7 ➔ Am(maj7)'
      }
    ],

    styles: ['Jazz Moderno', 'Fusion', 'Gospel', 'Cine', 'Música Contemporánea'],

    notes: {
      characteristic: '6 y 7',
      identity: 'Menor Natural = ♭6 + ♭7 | Menor Armónica = ♭6 + 7 | Menor Melódica = 6 + 7'
    },

    recommendation: {
      title: 'ii ➔ V ➔ i',
      example: 'Bm7b5 ➔ E7 ➔ Am(maj7)',
      explanation: 'La Menor Melódica combina la sonoridad menor con una sensible fuerte y una sexta mayor, permitiendo generar progresiones extremadamente fluidas y modernas. Es una de las escalas más utilizadas en jazz contemporáneo, fusión y cine.'
    }
  },

  dorian_flat2: {
    name: 'Modo Dórico ♭2',
    version: 1,

    diatonic_functions: [
      { degree: 'i', function: 'Centro modal', type: 'Estabilidad menor', explanation: 'Estabilidad menor con tensión del frigio (♭2).' },
      { degree: '♭II', function: 'Color principal', type: 'Color aumentado / Tensión', explanation: 'Acorde aumentado que introduce el color principal del modo.' },
      { degree: '♭III+', function: 'Expansión', type: 'Movimiento mayor', explanation: 'Tercer grado mayor que amplía la sonoridad diatónica.' },
      { degree: 'iv', function: 'Movimiento', type: 'Apertura', explanation: 'Cuarto grado mayor que aporta el verdadero carácter dórico.' },
      { degree: 'v°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Grado semidisminuido con tensión de dominante.' },
      { degree: 'VIø', function: 'Característico', type: 'Paso semidisminuido', explanation: 'Sexto grado semidisminuido característico.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Reposición menor', explanation: 'Séptimo grado que resuelve suavemente por semitono hacia la tónica.' }
    ],

    functional_relationships: {
      'i': [
        { from: '♭II', desc: 'Cadencia modal por paso de semitono descendente' },
        { from: '♭VII', desc: 'Paso menor suave de resolución modal' },
        { from: 'VIø', desc: 'Movimiento característico desde el sexto grado' }
      ],
      'iv': [
        { from: 'i', desc: 'Conducción suave del primer al cuarto grado' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_df2',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i',
        explanation: 'Dominante secundario funcional.',
        variants: ['7', 'b9'],
        styles: ['jazz', 'fusion'],
        example: 'F#7 ➔ Bm'
      },
      {
        id: 'V_iv_df2',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante que conduce al acorde subdominante.',
        variants: ['7'],
        styles: ['jazz'],
        example: 'B7 ➔ Em'
      },
      {
        id: 'V_flatIII_df2',
        category: 'secondary_dominant',
        target_degree: '♭III+',
        function: 'V/♭III',
        explanation: 'Dominante hacia el tercer grado.',
        variants: ['7'],
        styles: ['jazz', 'fusion'],
        example: 'C#7 ➔ D+'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_ii_nat_df2',
        category: 'modal_interchange',
        name: 'Grado II natural (Dórica)',
        explanation: 'Comparación de la segunda menor contra la segunda mayor de Dórica.',
        example: 'C#m'
      },
      {
        id: 'mi_flat_vi_df2',
        category: 'modal_interchange',
        name: 'Acorde ♭VI (Frigio)',
        explanation: 'Préstamo del sexto grado bemol mayor del Frigio.',
        example: 'G'
      },
      {
        id: 'mi_flat_vi_nat_df2',
        category: 'modal_interchange',
        name: 'Acorde ♭VI (Menor Natural)',
        explanation: 'Préstamo del sexto grado de la escala menor natural.',
        example: 'G'
      },
      {
        id: 'mi_ii_dim_df2',
        category: 'modal_interchange',
        name: 'Grado ii° disminuido (Menor Natural)',
        explanation: 'Préstamo del segundo grado disminuido.',
        example: 'Cm7b5'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_df2',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación por semitono superior.',
        example: 'Cm ➔ Bm'
      },
      {
        id: 'chrom_inf_df2',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación por semitono inferior.',
        example: 'A#m ➔ Bm'
      },
      {
        id: 'chrom_dim_df2',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'A#dim7 ➔ Bm'
      },
      {
        id: 'chrom_enc_df2',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro superior e inferior hacia la tónica.',
        example: 'Cm ➔ A#m ➔ Bm'
      }
    ],

    cadences: [
      {
        id: 'cad_flat_ii_i_df2',
        category: 'cadence',
        name: '♭II ➔ i',
        explanation: 'Cadencia principal modal.',
        example: 'C ➔ Bm'
      },
      {
        id: 'cad_flat_vii_flat_ii_i_df2',
        category: 'cadence',
        name: '♭VII ➔ ♭II ➔ i',
        explanation: 'Cadencia modal extendida.',
        example: 'A ➔ C ➔ Bm'
      },
      {
        id: 'cad_cinematic_df2',
        category: 'cadence',
        name: '♭III+ ➔ ♭II ➔ i',
        explanation: 'Cadencia de carácter cinematográfico.',
        example: 'D+ ➔ C ➔ Bm'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_df2',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Uso de un dominante alterado para resolver.',
        example: 'F#7alt ➔ Bm'
      },
      {
        id: 'reharm_tritone_df2',
        category: 'reharmonization',
        name: 'Tritonal',
        explanation: 'Uso de acorde sustituto de tritono.',
        example: 'C7 ➔ Bm'
      },
      {
        id: 'reharm_dim_df2',
        category: 'reharmonization',
        name: 'Disminuido',
        explanation: 'Aproximación disminuida hacia el reposo.',
        example: 'A#dim7 ➔ Bm'
      },
      {
        id: 'reharm_ii_v_i_df2',
        category: 'reharmonization',
        name: 'ii - V - i',
        explanation: 'Cadencia ii-V-i adaptada al contexto.',
        example: 'C#m7b5 ➔ F#7 ➔ Bm'
      }
    ],

    styles: ['Jazz Moderno', 'Fusion', 'Cine (Misterio)', 'Contemporáneo'],

    notes: {
      characteristic: '♭2 y 6',
      identity: 'Frigio = ♭2 | Dórico = 6 | Dórica ♭2 = ♭2 + 6'
    },

    recommendation: {
      title: '♭II ➔ i',
      example: 'C ➔ Bm',
      explanation: 'La Dórica ♭2 combina la tensión oscura del Frigio con la apertura característica de la sexta mayor Dórica, logrando sonoridades sofisticadas y muy utilizadas en el cine.'
    }
  },

  lydian_augmented: {
    name: 'Modo Lidio Aumentado',
    version: 1,

    diatonic_functions: [
      { degree: 'I+maj7', function: 'Centro modal', type: 'Estabilidad inestable', explanation: 'Estabilidad aumentada. Centro tonal mayor pero con tensión de quinta aumentada.' },
      { degree: 'II', function: 'Movimiento', type: 'Subdominante mayor', explanation: 'Segundo grado mayor que aporta el brillo lidio.' },
      { degree: 'iii', function: 'Expansión', type: 'Tónica extendida', explanation: 'Tercer grado que comparte notas con el centro tonal.' },
      { degree: '#iv°', function: 'Color característico', type: 'Color disminuido', explanation: 'Cuarta aumentada disminuida que proporciona máxima tensión.' },
      { degree: '#V°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Quinta aumentada disminuida que define el modo.' },
      { degree: 'vi', function: 'Relativo', type: 'Paso menor', explanation: 'Acorde de paso menor melódico.' },
      { degree: 'vii', function: 'Sensible', type: 'Movimiento', explanation: 'Séptimo grado menor que asienta la sensible.' }
    ],

    functional_relationships: {
      'I+maj7': [
        { from: 'II', desc: 'Cadencia principal de Lidio Aumentado' },
        { from: '#iv°', desc: 'Color principal de intercambio flotante' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_II_la',
        category: 'secondary_dominant',
        target_degree: 'II',
        function: 'V/II',
        explanation: 'Dominante secundario al segundo grado mayor.',
        variants: ['7'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ D'
      },
      {
        id: 'V_vi_la',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario al relativo menor.',
        variants: ['7'],
        styles: ['jazz', 'gospel'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_I_la',
        category: 'secondary_dominant',
        target_degree: 'I+maj7',
        function: 'V/I',
        explanation: 'Dominante principal hacia el centro tonal.',
        variants: ['7'],
        styles: ['jazz', 'gospel', 'cine'],
        example: 'G7 ➔ Cmaj7#5'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_i_maj7_la',
        category: 'modal_interchange',
        name: 'Tónica Imaj7 (Lidia)',
        explanation: 'Comparación de la quinta justa de Lidio frente a la quinta aumentada.',
        example: 'Cmaj7'
      },
      {
        id: 'mi_iv_nat_la',
        category: 'modal_interchange',
        name: 'Grado IV natural (Jónica)',
        explanation: 'Préstamo de subdominante mayor de la escala mayor.',
        example: 'F'
      },
      {
        id: 'mi_i_j5_la',
        category: 'modal_interchange',
        name: 'Tónica Imaj7#5 (Jónica #5)',
        explanation: 'Préstamo de Jónica #5 sin cuarta aumentada.',
        example: 'Cmaj7#5'
      },
      {
        id: 'mi_ii_min_la',
        category: 'modal_interchange',
        name: 'Grado ii menor (Mayor)',
        explanation: 'Préstamo del segundo grado menor diatónico.',
        example: 'Dm'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_la',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación de semitono superior.',
        example: 'Dbmaj7#5 ➔ Cmaj7#5'
      },
      {
        id: 'chrom_inf_la',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación de semitono inferior.',
        example: 'Bmaj7#5 ➔ Cmaj7#5'
      },
      {
        id: 'chrom_dim_la',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'Bdim7 ➔ Cmaj7#5'
      },
      {
        id: 'chrom_enc_la',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro superior e inferior hacia la tónica.',
        example: 'Dbmaj7#5 ➔ Bmaj7#5 ➔ Cmaj7#5'
      }
    ],

    cadences: [
      {
        id: 'cad_ii_i_la',
        category: 'cadence',
        name: 'II ➔ I+maj7',
        explanation: 'Cadencia principal modal.',
        example: 'D ➔ Cmaj7#5'
      },
      {
        id: 'cad_ii_v_i_la',
        category: 'cadence',
        name: 'II ➔ V ➔ I+maj7',
        explanation: 'Cadencia modal expandida.',
        example: 'D ➔ G ➔ Cmaj7#5'
      },
      {
        id: 'cad_cinematic_la',
        category: 'cadence',
        name: 'I+maj7 ➔ II ➔ I+maj7',
        explanation: 'Cadencia cinematográfica flotante.',
        example: 'Cmaj7#5 ➔ D ➔ Cmaj7#5'
      },
      {
        id: 'cad_floating_la',
        category: 'cadence',
        name: 'I+maj7 ➔ #iv° ➔ I+maj7',
        explanation: 'Cadencia etérea de tensión simétrica.',
        example: 'Cmaj7#5 ➔ F#dim ➔ Cmaj7#5'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_la',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Resolución de dominante alterado.',
        example: 'G7alt ➔ Cmaj7#5'
      },
      {
        id: 'reharm_tritone_la',
        category: 'reharmonization',
        name: 'Tritonal',
        explanation: 'Sustituto de tritono.',
        example: 'Db7 ➔ Cmaj7#5'
      },
      {
        id: 'reharm_dim_la',
        category: 'reharmonization',
        name: 'Disminuido',
        explanation: 'Resolución de acorde disminuido.',
        example: 'Bdim7 ➔ Cmaj7#5'
      },
      {
        id: 'reharm_chain_la',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Cadena de dominantes hacia el reposo.',
        example: 'A7 ➔ D7 ➔ G7 ➔ Cmaj7#5'
      },
      {
        id: 'reharm_sub_la',
        category: 'reharmonization',
        name: 'Sustitución Modal',
        explanation: 'Sustituir tónica estable por aumentada.',
        example: 'Cmaj7 ➔ Cmaj7#5'
      }
    ],

    styles: ['Cine (Fantasía/Aventura/Ciencia Ficción)', 'Jazz Moderno', 'Fusion', 'Videojuegos'],

    notes: {
      characteristic: '#4 y #5',
      identity: 'Lidia = #4 | Jónica #5 = #5 | Lidia Aumentada = #4 + #5'
    },

    recommendation: {
      title: 'Imaj7#5(#11)',
      example: 'Cmaj7#5(#11)',
      explanation: 'La combinación simultánea de #4 y #5 genera uno de los colores más brillantes, abiertos y expansivos de toda la armonía moderna, muy empleado en el cine de ciencia ficción y fantasía.'
    }
  },

  lydian_dominant: {
    name: 'Modo Lidio Dominante',
    version: 1,

    diatonic_functions: [
      { degree: 'I7(#11)', function: 'Centro modal', type: 'Tensión dominante estable', explanation: 'ADN del modo. Acorde dominante con extensión de cuarta aumentada.' },
      { degree: 'II', function: 'Movimiento', type: 'Apertura', explanation: 'Segundo grado mayor que asienta el brillo lidio.' },
      { degree: 'iii°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Tercer grado semidisminuido diatónico.' },
      { degree: '#iv°', function: 'Color característico', type: 'Color disminuido', explanation: 'Cuarto grado semidisminuido que introduce el tritono.' },
      { degree: 'v', function: 'Movimiento', type: 'Paso menor', explanation: 'Quinto grado menor de reposición.' },
      { degree: 'vi', function: 'Expansión', type: 'Reposición menor', explanation: 'Relativo menor que expande la sonoridad.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Apertura aumentada', explanation: 'Séptimo grado aumentado que resuelve por tono entero hacia I.' }
    ],

    functional_relationships: {
      'I7(#11)': [
        { from: '♭VII', desc: 'Cadencia principal por paso de tono entero descendente' },
        { from: 'II', desc: 'Conducción brillante hacia el centro modal' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_II_ld',
        category: 'secondary_dominant',
        target_degree: 'II',
        function: 'V/II',
        explanation: 'Dominante secundario al segundo grado.',
        variants: ['7'],
        styles: ['jazz', 'fusion'],
        example: 'A7 ➔ D'
      },
      {
        id: 'V_V_ld',
        category: 'secondary_dominant',
        target_degree: 'v',
        function: 'V/V',
        explanation: 'Doble dominante.',
        variants: ['7'],
        styles: ['jazz'],
        example: 'E7 ➔ A'
      },
      {
        id: 'V_vi_ld',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi',
        explanation: 'Dominante secundario al relativo menor.',
        variants: ['7'],
        styles: ['jazz', 'gospel'],
        example: 'B7 ➔ Em'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_i_maj7_ld',
        category: 'modal_interchange',
        name: 'Tónica Imaj7(#11) (Lidia)',
        explanation: 'Comparación de la séptima mayor de Lidio frente a la séptima menor.',
        example: 'Dmaj7(#11)'
      },
      {
        id: 'mi_iv_nat_ld',
        category: 'modal_interchange',
        name: 'Grado IV natural (Mixolidia)',
        explanation: 'Préstamo de subdominante mayor de la escala mixolidia.',
        example: 'G'
      },
      {
        id: 'mi_ii_min_ld',
        category: 'modal_interchange',
        name: 'Grado ii menor (Mayor)',
        explanation: 'Préstamo del segundo grado menor.',
        example: 'Em'
      },
      {
        id: 'mi_i_blues_ld',
        category: 'modal_interchange',
        name: 'Dominantes extendidos (Blues)',
        explanation: 'Comparación con los acordes de extensión blues.',
        example: 'D9, D13'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_ld',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación de semitono superior.',
        example: 'Eb7(#11) ➔ D7(#11)'
      },
      {
        id: 'chrom_inf_ld',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación de semitono inferior.',
        example: 'Db7(#11) ➔ D7(#11)'
      },
      {
        id: 'chrom_dim_ld',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'C#dim7 ➔ D7(#11)'
      },
      {
        id: 'chrom_enc_ld',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro por arriba y abajo.',
        example: 'Eb7(#11) ➔ Db7(#11) ➔ D7(#11)'
      },
      {
        id: 'chrom_tri_ld',
        category: 'chromatic',
        name: 'Aproximación Tritonal',
        explanation: 'Sustituto de tritono.',
        example: 'Ab7 ➔ D7(#11)'
      }
    ],

    cadences: [
      {
        id: 'cad_flat_vii_i_ld',
        category: 'cadence',
        name: '♭VII ➔ I7(#11)',
        explanation: 'Cadencia principal modal.',
        example: 'C ➔ D7(#11)'
      },
      {
        id: 'cad_dom_modal_ld',
        category: 'cadence',
        name: 'I7(#11) ➔ IV',
        explanation: 'Resolución de dominante modal a cuarto grado.',
        example: 'D7(#11) ➔ G'
      },
      {
        id: 'cad_ii_v_i_ld',
        category: 'cadence',
        name: 'ii ➔ V ➔ I7(#11)',
        explanation: 'Cadencia jazz tradicional.',
        example: 'Em7 ➔ A7 ➔ D7(#11)'
      },
      {
        id: 'cad_fusion_ld',
        category: 'cadence',
        name: 'I7(#11) ↔ ♭VII',
        explanation: 'Cadencia alternante de fusión.',
        example: 'D7(#11) ↔ C'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_tritone_ld',
        category: 'reharmonization',
        name: 'Sustituto Tritonal',
        explanation: 'Uso de sustituto tritonal.',
        example: 'Ab7 ➔ D7(#11)'
      },
      {
        id: 'reharm_alt_ld',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Comparar con dominante alterado en resolución.',
        example: 'D7alt'
      },
      {
        id: 'reharm_sub_ld',
        category: 'reharmonization',
        name: 'Sustitución Modal',
        explanation: 'Sustitución de dominante básico por lidio dominante.',
        example: 'D7 ➔ D7(#11)'
      },
      {
        id: 'reharm_chain_ld',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Cadena de dominantes hacia el reposo.',
        example: 'E7 ➔ A7 ➔ D7(#11)'
      },
      {
        id: 'reharm_backdoor_ld',
        category: 'reharmonization',
        name: 'Backdoor',
        explanation: 'Resolución backdoor.',
        example: 'C7 ➔ D7(#11)'
      }
    ],

    styles: ['Jazz Moderno', 'Fusion', 'Gospel', 'Blues Moderno', 'Cine (Tensión Luminosa)'],

    notes: {
      characteristic: '#4 y ♭7',
      identity: 'Lidia = #4 | Mixolidia = ♭7 | Lidia Dominante = #4 + ♭7'
    },

    recommendation: {
      title: 'I7(#11)',
      example: 'D7(#11)',
      explanation: 'El Lidio Dominante combina la apertura del Lidio con la tensión funcional de un acorde dominante. Es uno de los sonidos más importantes del jazz moderno, fusión y reharmonización avanzada.'
    }
  },

  mixolydian_flat6: {
    name: 'Modo Mixolidio ♭6',
    version: 1,

    diatonic_functions: [
      { degree: 'I7', function: 'Centro modal', type: 'Estabilidad dominante', explanation: 'Tónica del modo con carácter mayor.' },
      { degree: 'ii°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Segundo grado disminuido de movimiento.' },
      { degree: 'iii°', function: 'Movimiento', type: 'Paso disminuido', explanation: 'Tercer grado disminuido.' },
      { degree: 'IVm', function: 'Color característico', type: 'Color menor / Subdominante', explanation: 'Cuarto grado menor que aporta el verdadero color mixolidio ♭6.' },
      { degree: 'v°', function: 'Tensión', type: 'Tensión disminuida', explanation: 'Quinto grado disminuido con tensión.' },
      { degree: '♭VI+', function: 'Color', type: 'Tensión aumentada', explanation: 'Sexto grado bemol aumentado.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Apertura mayor', explanation: 'Séptimo grado bemol mayor que resuelve por tono entero.' }
    ],

    functional_relationships: {
      'I7': [
        { from: '♭VII', desc: 'Resolución por paso de tono entero descendente' },
        { from: 'IVm', desc: 'Cadencia característico de paso menor hacia el dominante' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_IV_mf6',
        category: 'secondary_dominant',
        target_degree: 'IVm',
        function: 'V/IVm',
        explanation: 'Dominante secundario al cuarto grado menor.',
        variants: ['7', 'b9'],
        styles: ['jazz', 'fusion'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'V_VI_mf6',
        category: 'secondary_dominant',
        target_degree: '♭VI+',
        function: 'V/♭VI',
        explanation: 'Dominante al sexto grado.',
        variants: ['7'],
        styles: ['jazz'],
        example: 'G7 ➔ C+'
      },
      {
        id: 'V_VII_mf6',
        category: 'secondary_dominant',
        target_degree: '♭VII',
        function: 'V/♭VII',
        explanation: 'Dominante al séptimo grado.',
        variants: ['7'],
        styles: ['jazz', 'gospel'],
        example: 'A7 ➔ D'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_vi_nat_mf6',
        category: 'modal_interchange',
        name: 'Grado VI natural (Mixolidio)',
        explanation: 'Préstamo del sexto grado mayor de la escala mixolidia natural.',
        example: 'C#'
      },
      {
        id: 'mi_iv_min_mf6',
        category: 'modal_interchange',
        name: 'Grado iv menor (Menor Natural)',
        explanation: 'Préstamo de subdominante menor.',
        example: 'Am'
      },
      {
        id: 'mi_flat_vi_mf6',
        category: 'modal_interchange',
        name: 'Acorde ♭VI (Menor Natural)',
        explanation: 'Préstamo del sexto grado mayor.',
        example: 'C'
      },
      {
        id: 'mi_ii_flat_mf6',
        category: 'modal_interchange',
        name: 'Grado ♭2 (Frigio Dominante)',
        explanation: 'Préstamo del segundo grado bemol de Frigio Dominante.',
        example: 'F'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_mf6',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación por semitono superior.',
        example: 'F7 ➔ E7'
      },
      {
        id: 'chrom_inf_mf6',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación por semitono inferior.',
        example: 'D#7 ➔ E7'
      },
      {
        id: 'chrom_dim_mf6',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'D#dim7 ➔ E7'
      },
      {
        id: 'chrom_enc_mf6',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro por arriba y abajo.',
        example: 'F7 ➔ D#7 ➔ E7'
      },
      {
        id: 'chrom_tri_mf6',
        category: 'chromatic',
        name: 'Aproximación Tritonal',
        explanation: 'Sustituto de tritono.',
        example: 'Bb7 ➔ E7'
      }
    ],

    cadences: [
      {
        id: 'cad_flat_vii_i_mf6',
        category: 'cadence',
        name: '♭VII ➔ I7',
        explanation: 'Cadencia principal modal.',
        example: 'D ➔ E7'
      },
      {
        id: 'cad_char_mf6',
        category: 'cadence',
        name: 'I7 ➔ IVm',
        explanation: 'Movimiento característico mixolidio ♭6.',
        example: 'E7 ➔ Am'
      },
      {
        id: 'cad_modal_ext_mf6',
        category: 'cadence',
        name: '♭VI+ ➔ ♭VII ➔ I7',
        explanation: 'Cadencia modal extendida.',
        example: 'C+ ➔ D ➔ E7'
      },
      {
        id: 'cad_ii_v_i_mf6',
        category: 'cadence',
        name: 'ii - V - I7',
        explanation: 'Cadencia jazz tradicional.',
        example: 'F#m7b5 ➔ B7 ➔ E7'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_mf6',
        category: 'reharmonization',
        name: 'Dominante Alterado Ligero',
        explanation: 'Reharmonizar como un acorde dominante con tensión ♭13.',
        example: 'E7(b13)'
      },
      {
        id: 'reharm_tri_mf6',
        category: 'reharmonization',
        name: 'Tritonal',
        explanation: 'Sustituto de tritono.',
        example: 'Bb7 ➔ E7'
      },
      {
        id: 'reharm_dim_mf6',
        category: 'reharmonization',
        name: 'Disminuido',
        explanation: 'Resolución de acorde disminuido.',
        example: 'D#dim7 ➔ E7'
      },
      {
        id: 'reharm_chain_mf6',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Cadena de dominantes hacia el reposo.',
        example: 'B7 ➔ E7'
      },
      {
        id: 'reharm_backdoor_mf6',
        category: 'reharmonization',
        name: 'Backdoor',
        explanation: 'Resolución backdoor.',
        example: 'D7 ➔ E7'
      }
    ],

    styles: ['Jazz', 'Fusion', 'Gospel', 'Latin Jazz', 'Cine (Oscuridad Elegante)'],

    notes: {
      characteristic: '♭6 y ♭7',
      identity: 'Mixolidia = 6 + ♭7 | Menor Natural = ♭6 + ♭7 | Mixolidia ♭6 = 3 + ♭6 + ♭7'
    },

    recommendation: {
      title: 'I7 ➔ IVm',
      example: 'E7 ➔ Am',
      explanation: 'La presencia simultánea de la tercera mayor y la sexta menor genera un dominante con un color oscuro y sofisticado, ideal para progresiones de jazz moderno y latin jazz.'
    }
  },

  locrian_sharp2: {
    name: 'Modo Locrio ♮2',
    version: 1,

    diatonic_functions: [
      { degree: 'iø', function: 'Centro modal', type: 'Estabilidad disminuida inestable', explanation: 'Primer grado semidisminuido inestable de reposo.' },
      { degree: 'ii', function: 'Movimiento', type: 'Paso disminuido', explanation: 'Segundo grado disminuido con tensión.' },
      { degree: '♭III', function: 'Color', type: 'Apertura menor', explanation: 'Tercer grado menor que suaviza el reposo.' },
      { degree: 'iv', function: 'Movimiento', type: 'Apertura menor', explanation: 'Cuarto grado menor diatónico.' },
      { degree: '♭V', function: 'Tensión', type: 'Tensión aumentada', explanation: 'Quinto grado bemol aumentado.' },
      { degree: '♭VI', function: 'Expansión', type: 'Subdominante mayor', explanation: 'Sexto grado mayor que aporta equilibrio.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Apertura mayor', explanation: 'Séptimo grado mayor que resuelve por tono entero.' }
    ],

    functional_relationships: {
      'iø': [
        { from: 'ii', desc: 'Movimiento característico desde el segundo grado disminuido' },
        { from: '♭VII', desc: 'Resolución modal por paso de tono entero' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_ls2',
        category: 'secondary_dominant',
        target_degree: 'iø',
        function: 'V/iø',
        explanation: 'Dominante secundario al primer grado semidisminuido.',
        variants: ['7', 'alt'],
        styles: ['jazz', 'fusion'],
        example: 'C#7 ➔ F#m7b5'
      },
      {
        id: 'V_iv_ls2',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv',
        explanation: 'Dominante secundario al cuarto grado.',
        variants: ['7'],
        styles: ['jazz'],
        example: 'F#7 ➔ Bm'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_flat_ii_ls2',
        category: 'modal_interchange',
        name: 'Grado ♭2 (Locrio Tradicional)',
        explanation: 'Comparar la segunda menor de Locrio frente a la segunda mayor.',
        example: 'G'
      },
      {
        id: 'mi_v_min_ls2',
        category: 'modal_interchange',
        name: 'Grado v menor (Menor Natural)',
        explanation: 'Préstamo de dominante menor de la escala menor natural.',
        example: 'Cm'
      },
      {
        id: 'mi_vi_nat_ls2',
        category: 'modal_interchange',
        name: 'Grado 6 natural (Dórico)',
        explanation: 'Préstamo del sexto grado mayor de la escala dórica.',
        example: 'D#'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_ls2',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación por semitono superior.',
        example: 'Gm7b5 ➔ F#m7b5'
      },
      {
        id: 'chrom_inf_ls2',
        category: 'chromatic',
        name: 'Aproximación Inferior',
        explanation: 'Aproximación por semitono inferior.',
        example: 'Fm7b5 ➔ F#m7b5'
      },
      {
        id: 'chrom_dim_ls2',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'Fdim7 ➔ F#m7b5'
      },
      {
        id: 'chrom_enc_ls2',
        category: 'chromatic',
        name: 'Encierro Cromático',
        explanation: 'Encierro por arriba y abajo.',
        example: 'Gm7b5 ➔ Fm7b5 ➔ F#m7b5'
      }
    ],

    cadences: [
      {
        id: 'cad_ii_v_i_ls2',
        category: 'cadence',
        name: 'iiø - V7 - i',
        explanation: 'Cadencia menor principal.',
        example: 'Bm7b5 ➔ E7 ➔ Am'
      },
      {
        id: 'cad_modal_ls2',
        category: 'cadence',
        name: 'ii ➔ iø',
        explanation: 'Movimiento modal característico.',
        example: 'G#m ➔ F#m7b5'
      },
      {
        id: 'cad_ii_v_i_alt_ls2',
        category: 'cadence',
        name: 'iiø - V7alt - i',
        explanation: 'Cadencia menor con tensión alterada.',
        example: 'Bm7b5 ➔ E7alt ➔ Am'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_ls2',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Resolución de dominante alterado.',
        example: 'C#7alt ➔ F#m7b5'
      },
      {
        id: 'reharm_tritone_ls2',
        category: 'reharmonization',
        name: 'Tritonal',
        explanation: 'Sustituto de tritono.',
        example: 'G7 ➔ F#m7b5'
      },
      {
        id: 'reharm_dim_ls2',
        category: 'reharmonization',
        name: 'Disminuido',
        explanation: 'Aproximación disminuida.',
        example: 'Fdim7 ➔ F#m7b5'
      },
      {
        id: 'reharm_ii_v_i_comp_ls2',
        category: 'reharmonization',
        name: 'ii-V-i Completo',
        explanation: 'Cadencia completa en menor.',
        example: 'Bm7b5 ➔ E7alt ➔ Am'
      }
    ],

    styles: ['Jazz Moderno', 'Bebop', 'Fusion', 'Gospel', 'Cine (Suspenso)'],

    notes: {
      characteristic: '2 y ♭5',
      identity: 'Locrio = ♭2 + ♭5 | Locrio ♮2 = 2 + ♭5'
    },

    recommendation: {
      title: 'iiø ➔ V7 ➔ i',
      example: 'Bm7b5 ➔ E7 ➔ Am',
      explanation: 'La Locria ♮2 es la escala de referencia para acordes m7♭5 en el jazz moderno. La segunda natural suaviza la tensión del Locrio tradicional y permite una resolución fluida.'
    }
  },

  altered: {
    name: 'Modo Alterado',
    version: 1,

    diatonic_functions: [
      { degree: 'i°', function: 'Tensión máxima', type: 'Dominante alterado', explanation: 'Dominante alterado con todas las tensiones posibles (b9, #9, b5, #5).' },
      { degree: '♭ii', function: 'Movimiento', type: 'Paso menor', explanation: 'Segundo grado menor que aporta el color ♭9.' },
      { degree: '♭iii', function: 'Tensión', type: 'Paso menor', explanation: 'Tercer grado menor que aporta el color ♯9.' },
      { degree: 'III+', function: 'Color característico', type: 'Color aumentado', explanation: 'Tercera mayor con tensión de quinta aumentada.' },
      { degree: 'IV', function: 'Tensión', type: 'Dominante', explanation: 'Cuarto grado con tensión ♭5.' },
      { degree: 'V', function: 'Tensión', type: 'Dominante', explanation: 'Quinto grado con tensión ♯5.' },
      { degree: 'vi°', function: 'Sensible', type: 'Tensión disminuida', explanation: 'Séptimo grado bemol con resolución directa.' }
    ],

    functional_relationships: {
      'i°': [
        { from: 'vi°', desc: 'Resolución de dominante por semitono sensible' }
      ]
    },

    secondary_dominants: [
      {
        id: 'V_i_alt',
        category: 'secondary_dominant',
        target_degree: 'i°',
        function: 'V/i',
        explanation: 'Dominante secundario alterado completo.',
        variants: ['7', 'b9', '#9', 'alt'],
        styles: ['jazz', 'fusion'],
        example: 'E7alt ➔ Am'
      },
      {
        id: 'V_V_alt',
        category: 'secondary_dominant',
        target_degree: 'IV',
        function: 'V/V',
        explanation: 'Dominante secundario al cuarto grado.',
        variants: ['7'],
        styles: ['jazz'],
        example: 'G7alt ➔ C'
      }
    ],

    modal_interchange: [
      {
        id: 'mi_mixo_alt',
        category: 'modal_interchange',
        name: 'Relación con Mixolidia',
        explanation: 'Comparar las tensiones de Mixolidio natural contra la escala alterada.',
        example: 'Mixolidia ➔ Lidia Dominante ➔ Mixolidia ♭6 ➔ Alterada'
      }
    ],

    chromatic_approximations: [
      {
        id: 'chrom_sup_alt',
        category: 'chromatic',
        name: 'Aproximación Superior',
        explanation: 'Aproximación de dominante cromático superior.',
        example: 'F7 ➔ E7alt'
      },
      {
        id: 'chrom_dim_alt',
        category: 'chromatic',
        name: 'Aproximación Disminuida',
        explanation: 'Acorde disminuido sensible.',
        example: 'D#dim7 ➔ E7alt'
      },
      {
        id: 'chrom_tri_alt',
        category: 'chromatic',
        name: 'Aproximación Tritonal',
        explanation: 'Sustituto de tritono alterado.',
        example: 'Bb7alt ➔ E7alt'
      }
    ],

    cadences: [
      {
        id: 'cad_v_i_maj_alt',
        category: 'cadence',
        name: 'V7alt ➔ I',
        explanation: 'Cadencia principal de resolución sobre tónica mayor.',
        example: 'G7alt ➔ Cmaj7'
      },
      {
        id: 'cad_v_i_min_alt',
        category: 'cadence',
        name: 'V7alt ➔ i',
        explanation: 'Cadencia principal de resolución sobre tónica menor.',
        example: 'E7alt ➔ Am'
      },
      {
        id: 'cad_ii_v_i_alt',
        category: 'cadence',
        name: 'ii - V7alt - I',
        explanation: 'Cadencia jazz tradicional con dominante alterado.',
        example: 'Dm7 ➔ G7alt ➔ Cmaj7'
      },
      {
        id: 'cad_ii_v_i_min_alt',
        category: 'cadence',
        name: 'iiø - V7alt - i',
        explanation: 'Cadencia menor de jazz tradicional.',
        example: 'Bm7b5 ➔ E7alt ➔ Am'
      }
    ],

    reharmonizations: [
      {
        id: 'reharm_alt_alt',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Tensión máxima del acorde de dominante.',
        example: 'G7alt'
      },
      {
        id: 'reharm_tritone_alt',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso del sustituto de tritono alterado.',
        example: 'Db7alt'
      },
      {
        id: 'reharm_backdoor_alt',
        category: 'reharmonization',
        name: 'Backdoor Alterado',
        explanation: 'Resolución backdoor alterada.',
        example: 'Bb7alt ➔ C'
      }
    ],

    styles: ['Jazz Moderno', 'Bebop', 'Fusion', 'Gospel', 'Cine (Suspenso/Caos)'],

    notes: {
      characteristic: '♭9, ♯9, ♭5, ♯5',
      identity: 'Mixolidia = Dominante | Lidia Dominante = Brillante | Mixolidia ♭6 = Oscura | Alterada = Dominante Máximo'
    },

    recommendation: {
      title: 'V7alt ➔ I',
      example: 'G7alt ➔ Cmaj7',
      explanation: 'La escala Alterada contiene todas las tensiones alteradas más utilizadas sobre un acorde dominante, maximizando la tensión antes de una resolución en jazz moderno, fusión y gospel.'
    }
  },

  // ==================== 🔵 ESCALAS SIMÉTRICAS ====================
  diminished_wh: {
    name: 'Escala Disminuida T-S',
    version: 1,
    diatonic_functions: [
      { degree: 'i°', function: 'Centro modal (dim7)', type: 'Estabilidad', explanation: 'Acorde disminuido fundamental del centro tonal. Representa la estabilidad disminuida.' },
      { degree: 'ii°', function: 'Movimiento (m7♭5)', type: 'Tensión suave', explanation: 'Establece movimiento preparatorio dentro de la red disminuida.' },
      { degree: '♭iii°', function: 'Color (dim7)', type: 'Tensión', explanation: 'Color simétrico equivalente de paso.' },
      { degree: 'iv°', function: 'Movimiento (m7♭5)', type: 'Tensión suave', explanation: 'Aporta una sonoridad suspendida de preparación.' },
      { degree: 'v°', function: 'Tensión (dim7)', type: 'Tensión', explanation: 'Tensión disminuida simétrica a distancia de tritono de la tónica.' },
      { degree: '♭vi°', function: 'Movimiento (m7♭5)', type: 'Tensión suave', explanation: 'Movimiento alternativo por semitono hacia la tónica.' },
      { degree: 'vi°', function: 'Característico (dim7)', type: 'Tensión', explanation: 'Grado disminuido característico que asienta el color simétrico.' },
      { degree: 'vii°', function: 'Movimiento (m7♭5)', type: 'Tensión suave', explanation: 'Grado disminuido que conduce a la sensible.' }
    ],
    functional_relationships: {
      'i°': [
        { from: 'v°', desc: 'Resolución simétrica a distancia de tritono dentro del ciclo' },
        { from: 'vi°', desc: 'Movimiento de tercera menor' },
        { from: '♭iii°', desc: 'Desplazamiento simétrico de tercera menor' }
      ],
      'ii°': [
        { from: 'i°', desc: 'Paso conjunto cromático ascendente suave' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_dim_implied',
        category: 'secondary_dominant',
        target_degree: 'i°',
        function: 'Dominantes Implícitos Múltiples',
        explanation: 'Un mismo acorde disminuido Cdim7 puede funcionar como varios dominantes alterados de resolución común.',
        variants: ['7(b9)'],
        styles: ['jazz', 'gospel'],
        example: 'Cdim7 ➔ Db / Dm / G7 (≈ A7(b9), C7(b9), Eb7(b9), Gb7(b9))'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_dim_alt',
        category: 'modal_interchange',
        source_scale: 'altered',
        degree: 'i°',
        function: 'Sustitución de Tensión Simétrica a Lineal',
        explanation: 'La escala disminuida se conecta directamente con la escala Alterada paralela, permitiendo transiciones suaves de máxima tensión.',
        styles: ['jazz', 'fusion'],
        example: 'Cdim7 ➔ C7alt'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_dim_passing',
        category: 'chromatic_approximation',
        name: 'Aproximación por Disminuido',
        explanation: 'Uso de un acorde disminuido de paso cromático ascendente.',
        example: 'C#dim7 ➔ Dm'
      },
      {
        id: 'chrom_dim_dom',
        category: 'chromatic_approximation',
        name: 'Aproximación Dominante',
        explanation: 'Resolución de paso disminuido hacia un acorde dominante.',
        example: 'C#dim7 ➔ G7'
      },
      {
        id: 'chrom_dim_double',
        category: 'chromatic_approximation',
        name: 'Doble Aproximación',
        explanation: 'Conexión disminuida doble a través de paso conjunto.',
        example: 'C#dim7 ➔ Dm ➔ G7'
      }
    ],
    cadences: [
      {
        id: 'cad_dim_dest',
        category: 'cadence',
        name: 'Resolución Disminuida Directa',
        explanation: 'Movimiento directo de un acorde disminuido a su destino.',
        example: 'dim7 ➔ destino'
      },
      {
        id: 'cad_dim_jazz',
        category: 'cadence',
        name: 'Cadencia Jazz con Paso Disminuido',
        explanation: 'Progresión tradicional que introduce un disminuido de paso entre el ii y el V.',
        example: 'Dm7 ➔ D#dim7 ➔ G7 ➔ Cmaj7'
      },
      {
        id: 'cad_dim_gospel',
        category: 'cadence',
        name: 'Cadencia Gospel Walk-up',
        explanation: 'Paso cromático característico muy usado en la música gospel.',
        example: 'I ➔ #Idim7 ➔ ii'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_passing_dim',
        category: 'reharmonization',
        name: 'Passing Diminished',
        explanation: 'Inserción de un acorde disminuido de paso entre dos diatónicos.',
        example: 'C ➔ C#dim7 ➔ Dm'
      },
      {
        id: 'reharm_dim_dom',
        category: 'reharmonization',
        name: 'Dominante Disminuido',
        explanation: 'Utilización de las tensiones disminuidas sobre un acorde dominante.',
        example: 'G7(b9)'
      },
      {
        id: 'reharm_dim_symmetry',
        category: 'reharmonization',
        name: 'Equivalencia Simétrica Disminuida',
        explanation: 'Desplazamiento simétrico del acorde disminuido por terceras menores manteniendo la misma función.',
        example: 'Cdim7 ➔ Ebdim7 ➔ Gbdim7 ➔ Adim7'
      }
    ],
    styles: ['Jazz', 'Bebop', 'Gospel', 'Swing', 'Cine (Suspenso)'],
    notes: {
      characteristic: 'Simetría Completa',
      identity: 'Disminuida T-S = Escala del acorde disminuido | Disminuida S-T = Escala del dominante disminuido'
    },
    recommendation: {
      title: 'C ➔ C#dim7 ➔ Dm',
      example: 'C ➔ C#dim7 ➔ Dm',
      explanation: 'La escala disminuida T-S permite generar acordes de paso, dominantes implícitos y conexiones cromáticas extremadamente suaves.'
    }
  },

  diminished_hw: {
    name: 'Escala Disminuida S-T',
    version: 1,
    diatonic_functions: [
      { degree: 'I', function: 'Centro modal dominante', type: 'Estabilidad dominante', explanation: 'Acorde dominante base enriquecido con tensiones simétricas.' },
      { degree: '♭II', function: 'Tensión característica', type: 'Tensión', explanation: 'Aporta la sonoridad de la novena bemol y de paso cromático.' },
      { degree: '♭III', function: 'Tensión', type: 'Movimiento', explanation: 'Acorde de paso con tensión de novena aumentada.' },
      { degree: 'III', function: 'Tensión dominante', type: 'Tensión dominante', explanation: 'Conserva la tercera mayor del acorde dominante.' },
      { degree: '#IV', function: 'Tensión característica', type: 'Tensión', explanation: 'Aporta la sonoridad de la cuarta aumentada u oncena aumentada.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión dominante', explanation: 'Mantiene la quinta justa del dominante.' },
      { degree: 'VI', function: 'Tensión dominante', type: 'Tensión dominante', explanation: 'Aporta la treceava mayor del acorde dominante.' },
      { degree: '♭VII', function: 'Tensión', type: 'Tensión', explanation: 'Conserva la séptima menor característica del dominante.' }
    ],
    functional_relationships: {
      'I': [
        { from: 'V', desc: 'Resolución de dominante clásica enriquecida' },
        { from: '♭II', desc: 'Resolución cromática muy fuerte hacia la tónica' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_dim_hw_v',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V7dim ➔ I',
        explanation: 'Dominante disminuido secundario resolviendo al primer grado.',
        variants: ['7(b9)'],
        styles: ['jazz', 'gospel'],
        example: 'G7dim ➔ C'
      },
      {
        id: 'sd_dim_hw_ii',
        category: 'secondary_dominant',
        target_degree: 'ii',
        function: 'V/ii (A7dim ➔ Dm)',
        explanation: 'Dominante disminuido secundario resolviendo al segundo grado menor.',
        variants: ['7(b9)'],
        styles: ['jazz'],
        example: 'A7dim ➔ Dm'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_dim_hw_alt',
        category: 'modal_interchange',
        source_scale: 'altered',
        degree: 'I',
        function: 'Dominante Simétrico vs Alterado',
        explanation: 'Contraste entre el dominante disminuido simétrico y el dominante extremo alterado lineal.',
        styles: ['jazz', 'fusion'],
        example: 'C7dim ➔ C7alt'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_dim_hw_dom',
        category: 'chromatic_approximation',
        name: 'Dominante Cromático',
        explanation: 'Resolución por semitono descendente de un acorde dominante.',
        example: 'Ab7 ➔ G7dim'
      },
      {
        id: 'chrom_dim_hw_enc',
        category: 'chromatic_approximation',
        name: 'Encierro Cromático',
        explanation: 'Dos dominantes cromáticos aproximando al acorde dominante disminuido.',
        example: 'Ab7 ➔ F#7 ➔ G7dim'
      }
    ],
    cadences: [
      {
        id: 'cad_dim_hw_maj',
        category: 'cadence',
        name: 'Cadencia Dominante Simétrica Mayor',
        explanation: 'Resolución de un dominante disminuido a la tónica mayor.',
        example: 'G7(b9) ➔ Cmaj7'
      },
      {
        id: 'cad_dim_hw_min',
        category: 'cadence',
        name: 'Cadencia Dominante Simétrica Menor',
        explanation: 'Resolución de un dominante disminuido a la tónica menor.',
        example: 'E7(b9) ➔ Am'
      },
      {
        id: 'cad_dim_hw_ii_v_i',
        category: 'cadence',
        name: 'ii-V7dim-I Jazz',
        explanation: 'Progresión ii-V-I clásica utilizando la escala disminuida S-T en el dominante.',
        example: 'Dm7 ➔ G7(b9) ➔ Cmaj7'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_dim_hw_b9',
        category: 'reharmonization',
        name: 'Dominante Disminuido 7(b9)',
        explanation: 'Enriquecimiento del acorde dominante con novena bemol.',
        example: 'G7(b9)'
      },
      {
        id: 'reharm_dim_hw_13b9',
        category: 'reharmonization',
        name: 'Dominante Expandido 13(b9)',
        explanation: 'Dominante con tensiones de 13 y novena bemol.',
        example: 'G13(b9)'
      },
      {
        id: 'reharm_dim_hw_tritone',
        category: 'reharmonization',
        name: 'Sustitución Tritonal Dominante',
        explanation: 'Sustituto de tritono utilizando tensiones disminuidas.',
        example: 'Db7(b9)'
      }
    ],
    styles: ['Bebop', 'Jazz Tradicional', 'Swing', 'Gospel', 'Big Band'],
    notes: {
      characteristic: '♭9, ♯9, ♯11, 13',
      identity: 'Disminuida T-S = Escala del acorde disminuido | Disminuida S-T = Escala del dominante disminuido'
    },
    recommendation: {
      title: 'G7(b9) ➔ Cmaj7',
      example: 'G7(b9) ➔ Cmaj7',
      explanation: 'La Disminuida S-T es una escala simétrica diseñada para enriquecer acordes dominantes, permitiendo utilizar simultáneamente b9, #9, #11 y 13 antes de la resolución.'
    }
  },

  whole_tone: {
    name: 'Escala de Tonos Enteros',
    version: 1,
    diatonic_functions: [
      { degree: 'I+', function: 'Centro modal dominante aumentado', type: 'Estabilidad dominante', explanation: 'Acorde dominante aumentado base de la escala simétrica.' },
      { degree: 'II+', function: 'Movimiento', type: 'Tensión aumentada', explanation: 'Acorde aumentado de paso y contraste.' },
      { degree: 'III+', function: 'Color', type: 'Tensión aumentada', explanation: 'Color armónico flotante.' },
      { degree: '#IV+', function: 'Preparación', type: 'Tensión aumentada', explanation: 'Acorde de preparación con cuarta aumentada.' },
      { degree: 'V+', function: 'Dominante aumentado', type: 'Tensión aumentada', explanation: 'Dominante aumentado principal de resolución fuerte.' },
      { degree: '♭VII+', function: 'Sensible de paso', type: 'Tensión aumentada', explanation: 'Grado aumentado que conduce cromáticamente de retorno.' }
    ],
    functional_relationships: {
        'I+': [
        { from: 'V+', desc: 'Resolución de dominante aumentado clásico' },
        { from: '♭VII+', desc: 'Conducción simétrica por tono entero' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_wt_v_i',
        category: 'secondary_dominant',
        target_degree: 'I+',
        function: 'V7#5 ➔ I',
        explanation: 'Dominante aumentado secundario resolviendo al primer grado.',
        variants: ['7#5'],
        styles: ['jazz', 'fusion'],
        example: 'G7#5 ➔ C'
      },
      {
        id: 'sd_wt_v_ii',
        category: 'secondary_dominant',
        target_degree: 'ii',
        function: 'V/ii (A7#5 ➔ Dm)',
        explanation: 'Dominante aumentado secundario resolviendo al segundo grado.',
        variants: ['7#5'],
        styles: ['jazz'],
        example: 'A7#5 ➔ Dm'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_wt_altered',
        category: 'modal_interchange',
        source_scale: 'altered',
        degree: 'I+',
        function: 'Dominante Aumentado vs Alterado',
        explanation: 'Contraste entre la tensión aumentada simétrica y la tensión alterada lineal extrema.',
        styles: ['jazz', 'fusion'],
        example: 'C7#5 ➔ C7alt'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_wt_direct',
        category: 'chromatic_approximation',
        name: 'Resolución Directa',
        explanation: 'Resolución por paso conjunto de dominante aumentado a mayor.',
        example: 'G7#5 ➔ C'
      },
      {
        id: 'chrom_wt_minor',
        category: 'chromatic_approximation',
        name: 'Resolución Menor',
        explanation: 'Resolución por paso conjunto de dominante aumentado a menor.',
        example: 'E7#5 ➔ Am'
      }
    ],
    cadences: [
      {
        id: 'cad_wt_maj',
        category: 'cadence',
        name: 'Cadencia Dominante Aumentada Mayor',
        explanation: 'Resolución clásica de dominante aumentado a tónica mayor.',
        example: 'G7#5 ➔ Cmaj7'
      },
      {
        id: 'cad_wt_min',
        category: 'cadence',
        name: 'Cadencia Dominante Aumentada Menor',
        explanation: 'Resolución clásica de dominante aumentado a tónica menor.',
        example: 'E7#5 ➔ Am'
      },
      {
        id: 'cad_wt_ii_v_i',
        category: 'cadence',
        name: 'ii-V7#5-I Jazz',
        explanation: 'Cadencia ii-V-I jazz utilizando el dominante aumentado de Tonos Enteros.',
        example: 'Dm7 ➔ G7#5 ➔ Cmaj7'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_wt_aug',
        category: 'reharmonization',
        name: 'Dominante Aumentado 7#5',
        explanation: 'Enriquecimiento del dominante con quinta aumentada.',
        example: 'G7#5'
      },
      {
        id: 'reharm_wt_tritone',
        category: 'reharmonization',
        name: 'Sustitución Whole Tone',
        explanation: 'Sustituto tritonal de tonos enteros.',
        example: 'Db7#5'
      },
      {
        id: 'reharm_wt_chain',
        category: 'reharmonization',
        name: 'Cadena de Dominantes Whole Tone',
        explanation: 'Encadenamiento de dominantes aumentados que modulan por tonos enteros.',
        example: 'A7#5 ➔ D7#5 ➔ G7#5 ➔ C'
      }
    ],
    styles: ['Jazz', 'Fusion', 'Impresionismo (Debussy/Ravel)', 'Cine (Sueño/Flotación)', 'Música Contemporánea'],
    notes: {
      characteristic: '♯4, ♯5',
      identity: 'Alterada = b9 #9 b5 #5 | Tonos Enteros = #11 #5'
    },
    recommendation: {
      title: 'G7#5 ➔ Cmaj7',
      example: 'G7#5 ➔ Cmaj7',
      explanation: 'La escala de Tonos Enteros genera una sensación flotante y abierta debido a su construcción completamente simétrica. Es la herramienta clásica para dominantes aumentados.'
    }
  },

  // ==================== 🔵 ESCALAS UNIVERSALES ====================
  pentatonic_major: {
    name: 'Escala Pentatónica Mayor',
    version: 1,
    diatonic_functions: [
      { degree: 'I', function: 'Estabilidad tónica', type: 'Reposo', explanation: 'Estabilidad y reposo tonal absoluto, libre de tensiones disonantes.' },
      { degree: 'ii', function: 'Movimiento menor', type: 'Movimiento', explanation: 'Movimiento suave melódico hacia el quinto o sexto grado.' },
      { degree: 'iii', function: 'Color tónico extendido', type: 'Transición', explanation: 'Aporta una sonoridad pasiva que comparte notas con el primer grado.' },
      { degree: 'V', function: 'Dominante suave', type: 'Tensión baja', explanation: 'Tensión de dominante sumamente relajada al no contener la sensible de semitono (7).' },
      { degree: 'vi', function: 'Tónica menor relativa', type: 'Reposo relativo', explanation: 'Reposo menor melancólico muy conectado con el primer grado.' }
    ],
    functional_relationships: {
      'I': [
        { from: 'vi', desc: 'Relación relativa directa de gran consonancia' },
        { from: 'V', desc: 'Resolución de dominante suave sin sensible' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_pm_v_i',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V/I (G7 ➔ C)',
        explanation: 'Dominante secundario introducido de la armonía tonal (externo a la pentatónica).',
        variants: ['7'],
        styles: ['pop', 'folk', 'gospel'],
        example: 'G7 ➔ C'
      },
      {
        id: 'sd_pm_v_vi',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi (E7 ➔ Am)',
        explanation: 'Dominante secundario que resuelve a la tónica relativa menor.',
        variants: ['7'],
        styles: ['pop', 'folk', 'gospel'],
        example: 'E7 ➔ Am'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_pm_major',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'I',
        function: 'Extensión a Escala Mayor',
        explanation: 'Incorporación de los grados 4 y 7 para completar la sonoridad de la escala mayor natural.',
        styles: ['pop', 'folk'],
        example: 'C Pentatónica ➔ C Mayor Completa (añade F y B)'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_pm_sup',
        category: 'chromatic_approximation',
        name: 'Aproximación Superior',
        explanation: 'Movimiento cromático descendente hacia la tónica.',
        example: 'Db ➔ C'
      }
    ],
    cadences: [
      {
        id: 'cad_pm_v_i',
        category: 'cadence',
        name: 'Cadencia Dominante Pentatónica',
        explanation: 'Resolución básica del quinto grado mayor a la tónica.',
        example: 'G ➔ C'
      },
      {
        id: 'cad_pm_pop_star',
        category: 'cadence',
        name: 'Cadencia Popular Insignia',
        explanation: 'Estructura de cuatro compases base de innumerables himnos de pop y rock.',
        example: 'I ➔ V ➔ vi ➔ IV (C ➔ G ➔ Am ➔ F)'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_pm_relative',
        category: 'reharmonization',
        name: 'Sustitución por Relativa Menor',
        explanation: 'Alternancia de tónica mayor y relativa menor manteniendo la melodía.',
        example: 'C ↔ Am'
      }
    ],
    styles: ['Pop', 'Folk', 'Country', 'Gospel Tradicional', 'Rock Clásico', 'Música Infantil'],
    notes: {
      characteristic: '1, 2, 3, 5, 6 (Sin 4 ni 7)',
      identity: 'Mayor = Completa | Pentatónica Mayor = Mayor Simplificada (estabilidad absoluta)'
    },
    recommendation: {
      title: 'I ➔ V ➔ vi ➔ IV',
      example: 'C ➔ G ➔ Am ➔ F',
      explanation: 'La Pentatónica Mayor elimina los intervalos más tensos (4 y 7). Su sencillez permite construir melodías universales, accesibles y memorables.'
    }
  },

  pentatonic_minor: {
    name: 'Escala Pentatónica Menor',
    version: 1,
    diatonic_functions: [
      { degree: 'i', function: 'Estabilidad menor', type: 'Reposo menor', explanation: 'Centro armónico de reposo menor, directo y expresivo.' },
      { degree: '♭III', function: 'Tónica relativa mayor', type: 'Color mayor', explanation: 'Aporta luminosidad y reposo relativo mayor.' },
      { degree: 'iv', function: 'Subdominante menor', type: 'Movimiento', explanation: 'Dirección armónica menor que conduce hacia el dominante o la tónica.' },
      { degree: 'v', function: 'Dominante menor', type: 'Movimiento', explanation: 'Tensión menor que resuelve de forma suave.' },
      { degree: '♭VII', function: 'Subdominante / Cadencia modal', type: 'Tensión baja', explanation: 'Acorde de paso muy característico de resolución modal.' }
    ],
    functional_relationships: {
      'i': [
        { from: '♭VII', desc: 'Resolución modal directa y característica del rock' },
        { from: '♭III', desc: 'Desplazamiento a la relativa mayor' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_pmin_v_i',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i (E7 ➔ Am)',
        explanation: 'Dominante secundario tonal mayor que introduce la sensible para resolver con fuerza.',
        variants: ['7'],
        styles: ['blues', 'rock', 'metal'],
        example: 'E7 ➔ Am'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_pmin_nat',
        category: 'modal_interchange',
        source_scale: 'minor',
        degree: 'i',
        function: 'Extensión a Menor Natural',
        explanation: 'Adición de los grados 2 y ♭6 para restaurar la escala menor natural completa.',
        styles: ['rock', 'metal'],
        example: 'A Pentatónica Menor ➔ A Menor Natural'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_pmin_blue',
        category: 'chromatic_approximation',
        name: 'Resolución de Blue Note',
        explanation: 'Paso cromático de la oncena aumentada / quinta bemol hacia la quinta justa.',
        example: 'Eb ➔ E'
      }
    ],
    cadences: [
      {
        id: 'cad_pmin_flat7_i',
        category: 'cadence',
        name: 'Resolución Modal ♭VII ➔ i',
        explanation: 'Resolución por paso de tono entero descendente en el bajo, insignia del rock moderno.',
        example: 'G ➔ Am'
      },
      {
        id: 'cad_pmin_rock_insignia',
        category: 'cadence',
        name: 'Cadencia de Rock Insignia',
        explanation: 'Progresión de gran fuerza que desciende por tonos enteros hacia la tónica.',
        example: 'i ➔ ♭VII ➔ ♭VI ➔ ♭VII (Am ➔ G ➔ F ➔ G)'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_pmin_power',
        category: 'reharmonization',
        name: 'Power Chords Riffs',
        explanation: 'Simplificación de acordes a intervalos de quinta justa (tónica y quinta) para una sonoridad dura y directa.',
        example: 'A5 ➔ G5 ➔ F5'
      }
    ],
    styles: ['Blues', 'Rock', 'Hard Rock', 'Metal', 'Gospel Tradicional', 'Folk'],
    notes: {
      characteristic: '♭3, ♭7',
      identity: 'Pentatónica Mayor = Luminosa | Pentatónica Menor = Expresiva (fuerza y riff)'
    },
    recommendation: {
      title: 'i ➔ ♭VII ➔ ♭VI ➔ ♭VII',
      example: 'Am ➔ G ➔ F ➔ G',
      explanation: 'La Pentatónica Menor elimina la 2.ª y 6.ª menor, suprimiendo las disonancias y creando una sonoridad sumamente directa, ideal para riffs de rock y solos expresivos.'
    }
  },

  blues: {
    name: 'Escala de Blues',
    version: 1,
    diatonic_functions: [
      { degree: 'i', function: 'Estabilidad de blues', type: 'Reposo menor', explanation: 'Tónica menor de blues que se toca sobre acordes dominantes mayores para crear el choque expresivo de tercera.' },
      { degree: '♭III', function: 'Tercera menor de blues', type: 'Tensión / Expresión', explanation: 'Genera la fricción característica del blues con la tercera mayor.' },
      { degree: 'IV', function: 'Subdominante de blues', type: 'Movimiento', explanation: 'Conducción armónica clásica.' },
      { degree: '#iv°', function: 'Tensión Blue Note (♭5)', type: 'Tensión máxima', explanation: 'Punto de tensión cromática máxima que resuelve melódicamente hacia la quinta justa o la cuarta.' },
      { degree: 'v', function: 'Dominante de blues', type: 'Tensión', explanation: 'Conexión hacia la resolución.' },
      { degree: '♭VII', function: 'Séptima de blues', type: 'Movimiento', explanation: 'Asienta la cualidad dominante y el fraseo.' }
    ],
    functional_relationships: {
      'i': [
        { from: '#iv°', desc: 'Resolución cromática directa descendente de la Blue Note hacia la quinta y tónica' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_blues_chain',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'Cadena de Dominantes Blues',
        explanation: 'Encadenamiento de acordes con estructura de séptima de dominante.',
        variants: ['7'],
        styles: ['blues', 'jazz'],
        example: 'A7 ➔ D7 ➔ E7'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_blues_mixolydian',
        category: 'modal_interchange',
        source_scale: 'mixolydian',
        degree: 'i',
        function: 'Hibridación Blues-Mixolidia',
        explanation: 'Combinación del fraseo cromático de la escala Blues con las notas mayores y séptima menor del Modo Mixolidio.',
        styles: ['blues', 'jazz', 'funk'],
        example: 'Añadir 2, 3 y 6 de Mixolidia a la escala Blues'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_blues_note',
        category: 'chromatic_approximation',
        name: 'Línea de Blue Note',
        explanation: 'Aproximación cromática característica a través de la quinta bemol.',
        example: '4 ➔ ♭5 ➔ 5 (D ➔ Eb ➔ E)'
      },
      {
        id: 'chrom_blues_third',
        category: 'chromatic_approximation',
        name: 'Desplazamiento de Tercera de Blues',
        explanation: 'Fricción melódica deslizando la tercera menor hacia la tercera mayor.',
        example: '♭3 ➔ 3 (C ➔ C#)'
      }
    ],
    cadences: [
      {
        id: 'cad_blues_turnaround',
        category: 'cadence',
        name: 'Turnaround Blues Clásico',
        explanation: 'Estructura armónica de dos compases al final de la progresión que reconduce el ciclo armónico.',
        example: 'I7 ➔ VI7 ➔ II7 ➔ V7 (A7 ➔ F#7 ➔ B7 ➔ E7)'
      },
      {
        id: 'cad_blues_trad',
        category: 'cadence',
        name: 'Cadencia de 12 Compases',
        explanation: 'La clásica estructura armónica de doce compases fundamental del blues tradicional.',
        example: 'I7 ➔ IV7 ➔ I7 ➔ V7 ➔ IV7 ➔ I7'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_blues_tensions',
        category: 'reharmonization',
        name: 'Dominantes Extendidos Blues',
        explanation: 'Reemplazo de acordes 7 por acordes con extensiones 9, 13 o la novena aumentada de blues (7#9).',
        example: 'A7 ➔ A7(#9) / A9 / A13'
      }
    ],
    styles: ['Blues', 'Rock', 'Hard Rock', 'Jazz', 'Gospel', 'Funk', 'Soul'],
    notes: {
      characteristic: '♭5 (Blue Note)',
      identity: 'Pentatónica Menor = Estable | Escala Blues = Pentatónica + Blue Note (tensión expresiva)'
    },
    recommendation: {
      title: '4 ➔ ♭5 ➔ 5',
      example: 'D ➔ Eb ➔ E',
      explanation: 'El movimiento cromático a través de la Blue Note (♭5) genera el sonido característico del blues y del rock, aportando un color sumamente vocal y melódico.'
    }
  },

  bebop_dominant: {
    name: 'Escala Bebop Dominante',
    version: 1,
    diatonic_functions: [
      { degree: 'I', function: 'Tónica del acorde dominante', type: 'Estructural', explanation: 'Fundamental del acorde de dominante principal.' },
      { degree: 'ii', function: 'Segundo grado de paso', type: 'Movimiento', explanation: 'Conecta melódicamente hacia la tercera.' },
      { degree: 'iii°', function: 'Tercera mayor del dominante', type: 'Estructural', explanation: 'Define el color mayor del acorde de séptima.' },
      { degree: 'IV', function: 'Cuarto grado de paso', type: 'Movimiento', explanation: 'Nota de paso que conecta con la quinta.' },
      { degree: 'v', function: 'Quinta justa estructural', type: 'Estructural', explanation: 'Aporta el reposo de la quinta justa.' },
      { degree: 'vi°', function: 'Sexta de paso', type: 'Movimiento', explanation: 'Nota de paso que conduce a la séptima menor.' },
      { degree: 'VII', function: 'Séptima menor del dominante', type: 'Estructural', explanation: 'Define la cualidad del acorde de dominante.' },
      { degree: 'viii°', function: 'Séptima mayor de paso (sensible)', type: 'Nota de paso cromática', explanation: 'Nota añadida que funciona como aproximación cromática de paso hacia la tónica.' }
    ],
    functional_relationships: {
      'I': [
        { from: 'VII', desc: 'Aproximación cromática ascendente desde la séptima mayor de paso' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_bebop_v_i',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V7 ➔ I',
        explanation: 'Uso de la escala bebop sobre el dominante principal para improvisación fluida.',
        variants: ['7'],
        styles: ['jazz', 'swing'],
        example: 'G7 ➔ Cmaj7'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_bebop_lyd_dom',
        category: 'modal_interchange',
        source_scale: 'lydian_dominant',
        degree: 'I',
        function: 'Bebop Brillante Lidio',
        explanation: 'Conversión del cuarto grado en cuarta aumentada (#4) para inyectar brillo lidio en la escala bebop.',
        styles: ['jazz', 'swing'],
        example: 'C7 Bebop con F# en vez de F'
      }
    ],
    chromatic_approximations: [
      {
        id: 'chrom_bebop_step',
        category: 'chromatic_approximation',
        name: 'Línea de Paso Bebop',
        explanation: 'Paso cromático descendente característico que resuelve en la tónica.',
        example: '♭7 ➔ 7 ➔ 1 (Bb ➔ B ➔ C)'
      },
      {
        id: 'chrom_bebop_five',
        category: 'chromatic_approximation',
        name: 'Aproximación Bebop de Quinta',
        explanation: 'Línea cromática desde la quinta hacia la sexta.',
        example: '5 ➔ #5 ➔ 6 (G ➔ G# ➔ A)'
      }
    ],
    cadences: [
      {
        id: 'cad_bebop_turnaround',
        category: 'cadence',
        name: 'Turnaround Bebop Standard',
        explanation: 'Progresión diatónica con dominantes secundarios típica de estándares de jazz y swing.',
        example: 'C ➔ A7 ➔ D7 ➔ G7'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_bebop_backdoor',
        category: 'reharmonization',
        name: 'Backdoor Resolution',
        explanation: 'Resolución de dominante no funcional por tono entero ascendente.',
        example: 'Bb7 ➔ C'
      }
    ],
    styles: ['Bebop', 'Swing', 'Jazz Tradicional', 'Big Band', 'Hard Bop'],
    notes: {
      characteristic: '♭7, 7',
      identity: 'Mixolidia = 7 notas | Bebop Dominante = Mixolidia + sensible de paso (8 notas)'
    },
    recommendation: {
      title: '♭7 ➔ 7 ➔ 1',
      example: 'Bb ➔ B ➔ C',
      explanation: 'La escala Bebop Dominante añade la séptima mayor a la Mixolidia. Esta nota extra de paso permite que los tonos del acorde caigan simétricamente en los tiempos fuertes en corcheas.'
    }
  },

  // ==================== 🎭 ESCALAS EXÓTICAS ====================
  hungarian_major: {
    name: 'Escala Mayor Húngara',
    version: 1,
    diatonic_functions: [
      { degree: 'I', function: 'Centro tonal', type: 'Reposo', explanation: 'Estabilidad y centro de la escala mayor con tensiones.' },
      { degree: '♯II', function: 'Color principal', type: 'Color', explanation: 'La segunda aumentada genera una tensión muy característica y exótica.' },
      { degree: 'III', function: 'Expansión', type: 'Estabilidad', explanation: 'Aporta una sonoridad pasiva y estabilidad modal.' },
      { degree: '♯iv', function: 'Tensión', type: 'Tensión', explanation: 'La cuarta aumentada aporta el clásico color lidio con inestabilidad.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión', explanation: 'Dominante diatónico que expande y resuelve.' },
      { degree: 'VI', function: 'Apertura', type: 'Transición', explanation: 'Aporta una sonoridad abierta para modulación.' },
      { degree: '♭VII', function: 'Resolución modal', type: 'Resolución', explanation: 'Séptima menor que conduce fluidamente al centro tonal.' }
    ],
    functional_relationships: {
      'I': [
        { from: '♯II', desc: 'Resolución exótica por segunda aumentada descendente hacia la tónica' },
        { from: '♭VII', desc: 'Resolución modal directa por tono entero ascendente' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_hm_v_i',
        category: 'secondary_dominant',
        target_degree: 'I',
        function: 'V/I (G7 ➔ C)',
        explanation: 'Dominante primario para estabilizar la tónica.',
        variants: ['7'],
        styles: ['cine', 'fusion'],
        example: 'G7 ➔ C'
      },
      {
        id: 'sd_hm_v_vi',
        category: 'secondary_dominant',
        target_degree: 'vi',
        function: 'V/vi (E7 ➔ Am)',
        explanation: 'Dominante que resuelve a la tónica menor relativa de la escala mayor.',
        variants: ['7'],
        styles: ['gipsy', 'cine'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'sd_hm_v_v',
        category: 'secondary_dominant',
        target_degree: 'V',
        function: 'V/V (D7 ➔ G)',
        explanation: 'Dominante secundario clásico.',
        variants: ['7'],
        styles: ['fusion', 'jazz'],
        example: 'D7 ➔ G'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_hm_major',
        category: 'modal_interchange',
        source_scale: 'major',
        degree: 'I',
        function: 'Préstamo de Mayor',
        explanation: 'Intercambio modal con la escala mayor para suavizar la segunda aumentada y la cuarta aumentada.',
        styles: ['fusion', 'gipsy'],
        example: 'Cambiar ♯2 a 2, y ♯4 a 4'
      },
      {
        id: 'mi_hm_lydian',
        category: 'modal_interchange',
        source_scale: 'lydian',
        degree: 'I',
        function: 'Préstamo Lidio',
        explanation: 'Comparte la cuarta aumentada (♯4) y permite una transición fluida al carácter lidio moderno.',
        styles: ['cine', 'fusion'],
        example: 'Compartir ♯4'
      },
      {
        id: 'mi_hm_phrygian_dom',
        category: 'modal_interchange',
        source_scale: 'phrygian_dominant',
        degree: 'I',
        function: 'Préstamo Frigio Dominante',
        explanation: 'Comparte el carácter exótico con una sonoridad flamenca/mediterránea.',
        styles: ['gipsy', 'cine'],
        example: 'Compartir el color de segunda aumentada'
      },
      {
        id: 'mi_hm_harmonic_major',
        category: 'modal_interchange',
        source_scale: 'harmonic_major',
        degree: 'I',
        function: 'Préstamo Mayor Armónica',
        explanation: 'Relación frecuente en la música gitana y de Europa del Este.',
        styles: ['gipsy'],
        example: 'Alternancia de colores armónicos'
      }
    ],
    chromatic_approximations: [
      {
        name: 'Aproximación Superior',
        explanation: 'Movimiento cromático descendente hacia la tónica.',
        example: 'Db ➔ C'
      },
      {
        name: 'Aproximación Inferior',
        explanation: 'Sensible cromática clásica ascendente hacia la tónica.',
        example: 'B ➔ C'
      },
      {
        name: 'Encierro Cromático',
        explanation: 'Aproximación por ambos lados de la tónica.',
        example: 'Db ➔ B ➔ C'
      },
      {
        name: 'Aproximación Exótica',
        explanation: 'Movimiento característico de segunda aumentada descendente.',
        example: 'D# ➔ C'
      }
    ],
    cadences: [
      {
        id: 'cad_hm_principal',
        category: 'cadence',
        name: 'Cadencia Principal',
        explanation: 'Resolución modal directa desde el séptimo grado rebajado.',
        example: '♭VII ➔ I (Bb ➔ C)'
      },
      {
        id: 'cad_hm_characteristic',
        category: 'cadence',
        name: 'Cadencia Característica',
        explanation: 'Tensión exótica resolviendo por segunda aumentada.',
        example: '♯II ➔ I (D# ➔ C)'
      },
      {
        id: 'cad_hm_cinematic',
        category: 'cadence',
        name: 'Cadencia Cinemática',
        explanation: 'Tensión máxima que conduce a través de la dominante.',
        example: '♯II ➔ V ➔ I (D# ➔ G7 ➔ C)'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_hm_dominant_alt',
        category: 'reharmonization',
        name: 'Dominante Alterado Ligero',
        explanation: 'Armonización con color de oncena aumentada (♯11).',
        example: 'G7(#11)'
      },
      {
        id: 'reharm_hm_tritonal',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Uso del acorde de dominante a distancia de tritono.',
        example: 'Db7 ➔ C'
      },
      {
        id: 'reharm_hm_pedal',
        category: 'reharmonization',
        name: 'Pedal Exótico',
        explanation: 'Pedal de tónica para mantener flotando los intervalos exóticos.',
        example: 'C ➔ D# ➔ C'
      },
      {
        id: 'reharm_hm_modal_chain',
        category: 'reharmonization',
        name: 'Cadena Modal',
        explanation: 'Encadenamiento de acordes característicos de la escala.',
        example: 'Bb ➔ D# ➔ C'
      }
    ],
    styles: ['Música Húngara', 'Música Gitana', 'Cine Épico', 'Aventura', 'Fantasía', 'Videojuegos', 'Fusion'],
    notes: {
      characteristic: '♯2, ♯4',
      identity: 'Mayor = 2 + 4 | Lidia = ♯4 | Mayor Húngara = ♯2 + ♯4'
    },
    recommendation: {
      title: '♯II ➔ I',
      example: 'D# ➔ C',
      explanation: 'La segunda aumentada genera una tensión muy característica que aporta un color exótico e inmediatamente reconocible. Es uno de los movimientos más representativos de la escala Mayor Húngara.'
    }
  },

  hungarian_gypsy_minor: {
    name: 'Escala Menor Húngara',
    version: 1,
    diatonic_functions: [
      { degree: 'i', function: 'Centro tonal', type: 'Reposo', explanation: 'Centro de gravedad menor exótico de la escala.' },
      { degree: 'ii', function: 'Predominante', type: 'Transición', explanation: 'Acorde semidisminuido clásico que conduce hacia la dominante.' },
      { degree: '♭III', function: 'Color tónico aumentado', type: 'Color', explanation: 'Aporta una sonoridad tensa y flotante por su quinta aumentada.' },
      { degree: '♯iv', function: 'Tensión principal', type: 'Tensión', explanation: 'La cuarta aumentada es la nota clave de tensión que define la sonoridad de la escala.' },
      { degree: 'V', function: 'Dominante', type: 'Tensión', explanation: 'Aporta la sensible para una resolución fuerte a la tónica.' },
      { degree: '♭VI', function: 'Color oscuro', type: 'Estabilidad', explanation: 'Sexta menor que confiere una sonoridad trágica y pesada.' },
      { degree: 'vii', function: 'Sensible disminuida', type: 'Tensión alta', explanation: 'Tensión máxima que conduce directamente al centro de reposo.' }
    ],
    functional_relationships: {
      'i': [
        { from: 'V', desc: 'Resolución de dominante clásica' },
        { from: '♯iv', desc: 'Resolución cromática de tensión característica hacia la quinta diatónica' }
      ]
    },
    secondary_dominants: [
      {
        id: 'sd_hgm_v_i',
        category: 'secondary_dominant',
        target_degree: 'i',
        function: 'V/i (E7 ➔ Am)',
        explanation: 'Dominante clásico para resolver a la tónica menor.',
        variants: ['7'],
        styles: ['cine', 'gipsy'],
        example: 'E7 ➔ Am'
      },
      {
        id: 'sd_hgm_v_iv',
        category: 'secondary_dominant',
        target_degree: 'iv',
        function: 'V/iv (A7 ➔ Dm)',
        explanation: 'Dominante secundario que resuelve en el cuarto grado.',
        variants: ['7'],
        styles: ['gipsy', 'metal'],
        example: 'A7 ➔ Dm'
      },
      {
        id: 'sd_hgm_v_biii',
        category: 'secondary_dominant',
        target_degree: '♭III',
        function: 'V/♭III (B7 ➔ C+)',
        explanation: 'Dominante secundario que resuelve sobre el grado relativo aumentado.',
        variants: ['7'],
        styles: ['gipsy', 'jazz'],
        example: 'B7 ➔ C+'
      }
    ],
    modal_interchange: [
      {
        id: 'mi_hgm_harmonic_minor',
        category: 'modal_interchange',
        source_scale: 'harmonic_minor',
        degree: 'i',
        function: 'Préstamo Menor Armónica',
        explanation: 'Comparte la mayoría de sus notas excepto la cuarta aumentada (♯4). Excelente para suavizar el carácter exótico.',
        styles: ['metal', 'gipsy'],
        example: 'Cambiar ♯4 por 4'
      },
      {
        id: 'mi_hgm_dorian_sharp4',
        category: 'modal_interchange',
        source_scale: 'dorian_sharp4',
        degree: 'i',
        function: 'Préstamo Dórico ♯4',
        explanation: 'Comparte la cuarta aumentada (♯4) pero con una base dórica más jazzística.',
        styles: ['jazz', 'cine'],
        example: 'Alternar con Dórico ♯4'
      },
      {
        id: 'mi_hgm_phrygian_dom',
        category: 'modal_interchange',
        source_scale: 'phrygian_dominant',
        degree: 'i',
        function: 'Préstamo Frigio Dominante',
        explanation: 'Comparte el carácter gitano/flamenco con una sonoridad oriental intensa.',
        styles: ['cine', 'gipsy'],
        example: 'Compartir el color de segunda aumentada'
      }
    ],
    chromatic_approximations: [
      {
        name: 'Aproximación Superior',
        explanation: 'Acorde de aproximación menor descendente.',
        example: 'B♭m ➔ Am'
      },
      {
        name: 'Aproximación Inferior',
        explanation: 'Sensible menor diatónica o cromática.',
        example: 'G#m ➔ Am'
      },
      {
        name: 'Aproximación Disminuida',
        explanation: 'Uso del acorde disminuido de paso.',
        example: 'G#dim7 ➔ Am'
      },
      {
        name: 'Aproximación Característica',
        explanation: 'Paso cromático de la cuarta aumentada hacia la quinta.',
        example: 'D# ➔ E'
      }
    ],
    cadences: [
      {
        id: 'cad_hgm_principal',
        category: 'cadence',
        name: 'Cadencia Principal',
        explanation: 'Resolución de dominante clásica y potente.',
        example: 'V7 ➔ i (E7 ➔ Am)'
      },
      {
        id: 'cad_hgm_characteristic',
        category: 'cadence',
        name: 'Cadencia Característica',
        explanation: 'Progresión de paso a través del grado de tensión principal.',
        example: '♯iv° ➔ V ➔ i (D#dim ➔ E7 ➔ Am)'
      },
      {
        id: 'cad_hgm_classical',
        category: 'cadence',
        name: 'Cadencia Clásica',
        explanation: 'Resolución tradicional menor usando el segundo grado disminuido.',
        example: 'ii° ➔ V ➔ i (Bdim ➔ E7 ➔ Am)'
      }
    ],
    reharmonizations: [
      {
        id: 'reharm_hgm_dominant_alt',
        category: 'reharmonization',
        name: 'Dominante Alterado',
        explanation: 'Uso de novena bemol sobre el dominante para acentuar el dramatismo.',
        example: 'E7(b9) ➔ Am'
      },
      {
        id: 'reharm_hgm_tritonal',
        category: 'reharmonization',
        name: 'Sustitución Tritonal',
        explanation: 'Dominante sustituto a distancia de tritono.',
        example: 'Bb7 ➔ Am'
      },
      {
        id: 'reharm_hgm_diminished',
        category: 'reharmonization',
        name: 'Resolución Disminuida',
        explanation: 'Uso del acorde de séptima disminuida de paso.',
        example: 'G#dim7 ➔ Am'
      },
      {
        id: 'reharm_hgm_chained_dom',
        category: 'reharmonization',
        name: 'Dominantes Encadenados',
        explanation: 'Ciclo de dominantes secundarios encadenados.',
        example: 'B7 ➔ E7 ➔ Am'
      }
    ],
    styles: ['Música Gitana', 'Metal Neoclásico', 'Cine', 'Música de Europa del Este', 'Fusion'],
    notes: {
      characteristic: '♯4, 7',
      identity: 'Menor Natural = ♭6 + ♭7 | Menor Armónica = ♭6 + 7 | Menor Húngara = ♭6 + 7 + ♯4'
    },
    recommendation: {
      title: '♯iv° ➔ V ➔ i',
      example: 'D#dim ➔ E7 ➔ Am',
      explanation: 'La cuarta aumentada añade una tensión exótica muy característica sobre la sonoridad de la Menor Armónica. Por eso la Menor Húngara es una de las escalas más utilizadas para crear ambientes dramáticos, cinematográficos y neoclásicos.'
    }
  }
}

/**
 * UTILS DE CONSULTA Y CÁLCULO DINÁMICO
 */

/**
 * Busca y retorna la ficha de función diatónica de un grado
 */
export function getDiatonicFunction(degree, scaleType = 'major') {
  const norm = degree.replace('7', '').replace('maj', '').replace('min', '').replace('°', '')
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  return HARMONIC_KNOWLEDGE[scaleKey].diatonic_functions.find(f => f.degree === norm) || null
}

/**
 * Busca la descripción de relación funcional entre dos grados
 */
export function getDiatonicRelationship(fromDegree, toDegree, scaleType = 'major') {
  const normFrom = fromDegree.replace('7', '').replace('maj', '').replace('min', '').replace('°', '')
  const normTo = toDegree.replace('7', '').replace('maj', '').replace('min', '').replace('°', '')
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  
  const rels = HARMONIC_KNOWLEDGE[scaleKey].functional_relationships[normTo]
  if (rels) {
    const matched = rels.find(r => r.from === normFrom)
    if (matched) return matched.desc
  }
  return ''
}

/**
 * Consulta un dominante secundario dado su grado destino
 */
export function getSecondaryDominant(targetDegree, scaleType = 'major') {
  const norm = targetDegree.replace('7', '').replace('maj', '').replace('min', '').replace('°', '')
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  return HARMONIC_KNOWLEDGE[scaleKey].secondary_dominants.find(sd => sd.target_degree === norm) || null
}

/**
 * Consulta un intercambio modal por su ID
 */
export function getModalInterchange(id, scaleType = 'major') {
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  return HARMONIC_KNOWLEDGE[scaleKey].modal_interchange.find(mi => mi.id === id) || null
}

/**
 * Consulta una cadencia por su ID
 */
export function getCadence(id, scaleType = 'major') {
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  return HARMONIC_KNOWLEDGE[scaleKey].cadences.find(c => c.id === id) || null
}

/**
 * Consulta una rearmonización por su ID
 */
export function getReharmonization(id, scaleType = 'major') {
  const scaleKey = HARMONIC_KNOWLEDGE[scaleType] ? scaleType : (scaleType === 'minor' ? 'minor' : 'major')
  return HARMONIC_KNOWLEDGE[scaleKey].reharmonizations.find(r => r.id === id) || null
}
