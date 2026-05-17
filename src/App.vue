<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDiatonicChords } from './core/scales.js'
import { formatChord } from './core/chords.js'
import { generatePDF } from './core/pdfExport.js'
import { getKeySignatureString } from './core/keySignatures.js'

// --- WIZARD / SETUP STATE ---
const isSetupMode = ref(true)

const configTitle = ref('Mi Canción')
const configMeasuresCount = ref(8)
const configKey = ref('C')
const configScale = ref('major')
const configTimeSignature = ref(4)

const keysNatural = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const keysSharp = ['C#', 'D#', 'F#', 'G#', 'A#']
const keysFlat = ['Db', 'Eb', 'Gb', 'Ab', 'Bb']

const SECTIONS = ['Ninguna', 'INTRO', 'A', 'B', 'C', 'PRE CORO', 'CORO', 'PUENTE', 'OUTRO', 'SOLO']

// --- PROJECT STATE ---
const title = ref('')
const timeSignature = ref(4)
const key = ref('C')
const scaleType = ref('major')
const measures = ref([])
const repeats = ref([])

const startProject = () => {
  title.value = configTitle.value || 'Sin Título'
  timeSignature.value = configTimeSignature.value
  key.value = configKey.value
  scaleType.value = configScale.value
  
  const count = Math.min(Math.max(configMeasuresCount.value, 1), 20)
  const emptyMeasures = []
  for(let i = 0; i < count; i++) {
    const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
    emptyMeasures.push({
      id: Date.now() + i,
      beats: emptyBeats,
      sectionLabel: null
    })
  }
  measures.value = emptyMeasures
  repeats.value = []
  isSetupMode.value = false
}

// --- GLOBAL COMPUTEDS ---
const keySignatureStr = computed(() => getKeySignatureString(key.value, scaleType.value))

const getRepeatStart = (mIdx) => repeats.value.some(r => r.startMeasure === mIdx + 1)
const getRepeatEnd = (mIdx) => repeats.value.find(r => r.endMeasure === mIdx + 1)

// --- GRID & MODAL STATE ---
const isModalOpen = ref(false)
const selectedBeat = ref(null)
const modalComplexity = ref('tetrad') 

const isMeasureOptionsOpen = ref(false)
const selectedMeasureIndex = ref(null)
const tempSectionLabel = ref('Ninguna')

const isRepeatMenuOpen = ref(false)
const newRepeat = ref({ startMeasure: 1, endMeasure: 4, times: 2 })

// --- DROPDOWN STATE ---
const activeDropdown = ref(null)
const toggleDropdown = (name) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}
const closeDropdowns = (e) => {
  if (!e.target.closest('.dropdown-container')) {
    activeDropdown.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdowns)
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})

const diatonicChords = computed(() => {
  return getDiatonicChords(key.value, scaleType.value, modalComplexity.value)
})

const openModal = (measureIndex, beatIndex) => {
  selectedBeat.value = { measureIndex, beatIndex }
  isModalOpen.value = true
}

const selectChord = (chordObj) => {
  if (selectedBeat.value) {
    const { measureIndex, beatIndex } = selectedBeat.value
    measures.value[measureIndex].beats[beatIndex] = {
      root: chordObj.root,
      type: chordObj.type,
      tension: null,
      bass: null
    }
  }
  isModalOpen.value = false
}

const openMeasureOptions = (mIdx) => {
  selectedMeasureIndex.value = mIdx
  const m = measures.value[mIdx]
  tempSectionLabel.value = m.sectionLabel || 'Ninguna'
  isMeasureOptionsOpen.value = true
}

const saveMeasureOptions = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    m.sectionLabel = tempSectionLabel.value === 'Ninguna' ? null : tempSectionLabel.value
  }
  isMeasureOptionsOpen.value = false
}

const addRepeat = () => {
  if (newRepeat.value.startMeasure >= newRepeat.value.endMeasure) {
    alert("El inicio debe ser menor al fin.")
    return
  }
  repeats.value.push({
    id: Date.now(),
    startMeasure: newRepeat.value.startMeasure,
    endMeasure: newRepeat.value.endMeasure,
    times: newRepeat.value.times
  })
}

const removeRepeat = (id) => {
  repeats.value = repeats.value.filter(r => r.id !== id)
}

const addMeasure = () => {
  if (measures.value.length >= 20) return alert("Límite de 20 compases alcanzado.")
  const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
  measures.value.push({
    id: Date.now(),
    beats: emptyBeats,
    sectionLabel: null
  })
}

const formatDisplayChord = (beat) => {
  if (!beat.root) return '-'
  let formatted = formatChord(beat)
  if (beat.type === 'maj') formatted = beat.root
  if (beat.type === 'min') formatted = beat.root + 'm'
  if (beat.type === 'dim') formatted = beat.root + 'dim'
  return formatted
}

const exportPdf = () => {
  generatePDF({
    title: title.value,
    key: key.value,
    scaleType: scaleType.value,
    timeSignature: timeSignature.value,
    measures: measures.value,
    repeats: repeats.value,
    keySignatureStr: keySignatureStr.value
  })
}
</script>

<template>
  <div class="h-[100dvh] w-full flex flex-col bg-[#F9FBF9] text-[#1C1C1E] font-sans antialiased overflow-hidden">
    
    <transition name="fade" mode="out-in">
      
      <!-- ==================== WIZARD (GREEN ACCENT) ==================== -->
      <div v-if="isSetupMode" class="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <div class="max-w-2xl mx-auto w-full pt-12 pb-8 px-4 sm:px-6">
          <div class="flex items-center gap-3 mb-8 px-4">
            <div class="w-10 h-10 bg-[#34C759] rounded-xl flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            </div>
            <h1 class="text-[34px] leading-tight font-bold text-black tracking-tight">HarmoniGrid</h1>
          </div>

          <div class="space-y-6">
            <!-- Bloque 1: General -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#34C759]/10 overflow-visible">
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Título de la canción</span>
                <input v-model="configTitle" type="text" class="text-[17px] text-right text-[#34C759] font-semibold focus:outline-none w-1/2 bg-transparent" placeholder="Ej: Mi Canción" />
              </div>
              
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Compases Iniciales</span>
                <div class="flex items-center gap-3">
                  <button @click="configMeasuresCount = Math.max(1, configMeasuresCount - 1)" class="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center active:bg-[#34C759]/20">-</button>
                  <span class="text-[17px] font-bold w-6 text-center">{{ configMeasuresCount }}</span>
                  <button @click="configMeasuresCount = Math.min(20, configMeasuresCount + 1)" class="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center active:bg-[#34C759]/20">+</button>
                </div>
              </div>

              <!-- CUSTOM DROPDOWN: Cifra Indicadora -->
              <div class="relative dropdown-container border-b border-gray-100 z-30">
                <button @click="toggleDropdown('timeSignature')" class="flex items-center justify-between w-full p-4 active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Cifra Indicadora</span>
                  <div class="flex items-center gap-1 text-[#34C759]">
                    <span class="text-[17px] font-semibold">{{ configTimeSignature }}/4</span>
                    <svg class="w-4 h-4 transition-transform" :class="{'rotate-180': activeDropdown === 'timeSignature'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'timeSignature'" class="absolute top-full right-4 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <button @click="configTimeSignature = 4; activeDropdown = null" class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#34C759]/5 text-[17px] flex justify-between">4 / 4 <span v-if="configTimeSignature===4" class="text-[#34C759]">✓</span></button>
                    <button @click="configTimeSignature = 3; activeDropdown = null" class="w-full text-left px-4 py-3 hover:bg-[#34C759]/5 text-[17px] flex justify-between">3 / 4 <span v-if="configTimeSignature===3" class="text-[#34C759]">✓</span></button>
                  </div>
                </transition>
              </div>
            </div>

            <!-- Bloque 2: Tonalidad -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#34C759]/10 p-5">
              <span class="block text-[17px] font-semibold text-gray-800 mb-5">Tonalidad Central</span>
              
              <div class="space-y-4">
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysNatural" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysSharp" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysFlat" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
              </div>

              <!-- CUSTOM DROPDOWN: Escala -->
              <div class="mt-6 border-t border-gray-100 pt-2 relative dropdown-container z-20">
                <button @click="toggleDropdown('configScale')" class="flex items-center justify-between w-full p-3 -mx-3 rounded-lg active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Tipo de Escala</span>
                  <div class="flex items-center gap-1 text-[#34C759]">
                    <span class="text-[17px] font-semibold">{{ configScale === 'major' ? 'Mayor' : 'Menor' }}</span>
                    <svg class="w-4 h-4 transition-transform" :class="{'rotate-180': activeDropdown === 'configScale'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'configScale'" class="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                    <button @click="configScale = 'major'; activeDropdown = null" class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#34C759]/5 text-[17px] flex justify-between font-medium">Escala Mayor <span v-if="configScale==='major'" class="text-[#34C759]">✓</span></button>
                    <button @click="configScale = 'minor'; activeDropdown = null" class="w-full text-left px-4 py-3 hover:bg-[#34C759]/5 text-[17px] flex justify-between font-medium">Escala Menor <span v-if="configScale==='minor'" class="text-[#34C759]">✓</span></button>
                  </div>
                </transition>
              </div>
            </div>

          </div>

          <button @click="startProject" class="w-full mt-8 bg-[#34C759] active:bg-[#248A3D] text-white font-bold text-[18px] py-4 rounded-2xl shadow-lg shadow-[#34C759]/30 transition-all transform active:scale-[0.98]">
            Crear Partitura
          </button>
        </div>
      </div>

      <!-- ==================== MAIN EDITOR ==================== -->
      <div v-else class="flex-1 flex flex-col h-full bg-[#F9FBF9] relative">
        
        <!-- HEADER -->
        <header class="flex items-center justify-between px-4 h-16 bg-white/90 backdrop-blur-xl border-b border-gray-200 z-20 sticky top-0 shadow-sm">
          <button @click="isSetupMode = true" class="text-[#34C759] font-medium text-[16px] w-24 text-left flex items-center hover:opacity-70 transition-opacity">
            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Atrás
          </button>
          
          <div class="flex-1 text-center font-bold text-[18px] text-gray-900 truncate px-2">
            <input v-model="title" class="bg-transparent text-center focus:outline-none w-full placeholder-gray-400" />
          </div>
          
          <button @click="exportPdf" class="text-white bg-[#34C759] hover:bg-[#248A3D] px-3 py-1.5 rounded-full font-bold text-[14px] w-24 text-center shadow-md shadow-[#34C759]/20 transition-all">
            Exportar
          </button>
        </header>

        <!-- TOOLBAR (Key & Repeats) -->
        <div class="px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap justify-between items-center z-10 gap-2">
          
          <div class="flex items-center gap-2">
            <!-- Custom Main Key Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainKey')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#34C759] transition-colors">
                {{ key }} <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'mainKey'" class="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-5 gap-1 z-50">
                  <button v-for="k in [...keysNatural, ...keysSharp, ...keysFlat]" :key="k" @click="key = k; activeDropdown = null" :class="key === k ? 'bg-[#34C759] text-white' : 'hover:bg-gray-100 text-gray-700'" class="py-2 rounded-lg font-bold text-sm text-center transition-colors">{{k}}</button>
                </div>
              </transition>
            </div>

            <!-- Custom Main Scale Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainScale')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#34C759] transition-colors">
                {{ scaleType === 'major' ? 'Mayor' : 'Menor' }} <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'mainScale'" class="absolute top-full left-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <button @click="scaleType = 'major'; activeDropdown = null" class="w-full text-left px-4 py-2 border-b border-gray-100 hover:bg-gray-50 text-[15px] font-medium flex justify-between">Mayor <span v-if="scaleType==='major'" class="text-[#34C759]">✓</span></button>
                  <button @click="scaleType = 'minor'; activeDropdown = null" class="w-full text-left px-4 py-2 hover:bg-gray-50 text-[15px] font-medium flex justify-between">Menor <span v-if="scaleType==='minor'" class="text-[#34C759]">✓</span></button>
                </div>
              </transition>
            </div>
          </div>

          <button @click="isRepeatMenuOpen = true" class="text-[14px] text-[#34C759] font-bold flex items-center gap-2 bg-[#34C759]/10 hover:bg-[#34C759]/20 px-3 py-1.5 rounded-lg transition-colors border border-[#34C759]/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Repeticiones 
            <span v-if="repeats.length" class="bg-[#34C759] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow-sm">{{repeats.length}}</span>
          </button>
        </div>

        <!-- GRID AREA -->
        <main class="flex-1 overflow-y-auto px-2 py-6 md:p-8 relative" @click="closeDropdowns">
          <div class="max-w-6xl mx-auto flex gap-2 md:gap-6">
            
            <!-- GLOBAL INDICATORS -->
            <div class="flex flex-col items-center pt-6 flex-shrink-0 w-8 md:w-16 select-none">
              <div class="font-bold text-xl md:text-3xl text-[#34C759] leading-none mb-4 w-full text-center">
                {{ keySignatureStr }}
              </div>
              <div class="text-4xl md:text-5xl font-serif font-bold leading-none text-gray-800">{{ timeSignature }}</div>
              <div class="text-4xl md:text-5xl font-serif font-bold leading-none -mt-1 text-gray-800">4</div>
            </div>
            
            <!-- MEASURES GRID -->
            <div class="flex-1">
              <transition-group name="grid-anim" tag="div" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-3 pb-32">
                <div 
                  v-for="(measure, mIdx) in measures" 
                  :key="measure.id"
                  class="relative bg-white border-2 border-gray-300 rounded-lg flex overflow-visible h-28 shadow-sm transition-all hover:border-[#34C759] group"
                  :class="{'border-l-[4px] border-l-black': getRepeatStart(mIdx), 'border-r-[4px] border-r-black': getRepeatEnd(mIdx)}"
                >
                  <!-- SECTION LABEL -->
                  <div v-if="measure.sectionLabel" class="absolute -top-4 left-[-2px] bg-[#34C759] text-white px-2 py-0.5 text-[11px] font-black rounded-sm z-10 shadow-sm uppercase tracking-wider">
                    {{ measure.sectionLabel }}
                  </div>
                  
                  <!-- REPEAT DOTS -->
                  <div v-if="getRepeatStart(mIdx)" class="absolute top-1/2 -translate-y-1/2 left-2 flex flex-col gap-1.5 z-10">
                    <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                  </div>
                  <div v-if="getRepeatEnd(mIdx)" class="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-1.5 z-10">
                    <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                  </div>

                  <div v-if="getRepeatEnd(mIdx)" class="absolute -top-6 right-0 text-[12px] font-bold text-gray-700 z-10 bg-white px-1 border border-b-0 border-gray-300 rounded-t-md">
                    (x{{ getRepeatEnd(mIdx).times }})
                  </div>
                  
                  <!-- Key display on first measure only -->
                  <div v-if="mIdx === 0" class="absolute top-1 right-2 text-[10px] font-black text-[#34C759]/50">
                    {{ key }}{{ scaleType === 'minor' ? 'm' : '' }}
                  </div>

                  <button 
                    @click.stop="openMeasureOptions(mIdx)"
                    class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white text-gray-400 hover:text-[#34C759] hover:border-[#34C759] border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-xs z-20 shadow-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >⚙️</button>
                  
                  <div class="absolute bottom-1 left-2 text-[10px] font-bold text-gray-300 pointer-events-none">
                    {{ mIdx + 1 }}
                  </div>
                  
                  <!-- BEATS -->
                  <div class="flex-1 flex z-0 relative ml-4 mr-4">
                    <div class="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -translate-y-1/2 pointer-events-none z-0"></div>

                    <button 
                      v-for="(beat, bIdx) in measure.beats.slice(0, timeSignature)" 
                      :key="bIdx"
                      @click="openModal(mIdx, bIdx)"
                      class="flex-1 flex flex-col items-center justify-center active:bg-[#34C759]/10 hover:bg-[#34C759]/5 h-full z-10 relative transition-colors rounded-lg m-0.5 group/beat"
                    >
                      <span class="text-2xl md:text-3xl font-bold text-gray-800 leading-none mb-1 group-hover/beat:scale-110 group-hover/beat:text-[#34C759] transition-transform">
                        {{ beat.root ? formatDisplayChord(beat) : '' }}
                      </span>
                      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-gray-300 transform rotate-12 group-hover/beat:opacity-0" v-if="!beat.root"></div>
                    </button>
                  </div>
                </div>
                
                <!-- ADD MEASURE BUTTON -->
                <button 
                  v-if="measures.length < 20"
                  @click="addMeasure"
                  class="h-28 border-2 border-dashed border-gray-300 bg-white/50 rounded-lg text-gray-400 flex items-center justify-center hover:bg-[#34C759]/5 hover:border-[#34C759] hover:text-[#34C759] transition-all group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
              </transition-group>
            </div>
          </div>
        </main>
      </div>
    </transition>

    <!-- ==================== iOS BOTTOM SHEETS ==================== -->
    <transition name="fade">
      <div v-if="isRepeatMenuOpen || isMeasureOptionsOpen || isModalOpen" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm">
        
        <div class="absolute inset-0" @click="isRepeatMenuOpen=false; isMeasureOptionsOpen=false; isModalOpen=false"></div>
        
        <!-- REPEATS MODAL -->
        <div v-if="isRepeatMenuOpen" class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe max-h-[90vh] flex flex-col z-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shadow-sm rounded-t-[16px]">
            <h3 class="text-[17px] font-bold text-gray-900 text-center w-full absolute left-0 pointer-events-none">Gestor de Repeticiones</h3>
            <button @click="isRepeatMenuOpen = false" class="text-[#34C759] text-[17px] font-bold ml-auto relative z-10 bg-[#34C759]/10 px-3 py-1 rounded-full">Hecho</button>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto">
            <div v-if="repeats.length > 0" class="bg-white rounded-2xl overflow-hidden mb-6 shadow-sm border border-gray-100">
              <div v-for="(r, i) in repeats" :key="r.id" class="flex items-center justify-between p-4" :class="{'border-b border-gray-100': i !== repeats.length -1}">
                <span class="text-[16px] font-semibold text-gray-800">Compás <span class="text-[#34C759]">{{ r.startMeasure }}</span> al <span class="text-[#34C759]">{{ r.endMeasure }}</span> <span class="text-gray-500 font-medium ml-1">(x{{ r.times }})</span></span>
                <button @click="removeRepeat(r.id)" class="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
              </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h4 class="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-4">Nueva Repetición</h4>
              <div class="grid grid-cols-3 gap-3 mb-4">
                <div class="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <span class="block text-[12px] font-semibold text-gray-500 mb-1">Desde</span>
                  <input type="number" v-model.number="newRepeat.startMeasure" class="w-full text-center text-[18px] font-bold outline-none bg-transparent text-[#34C759]" />
                </div>
                <div class="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <span class="block text-[12px] font-semibold text-gray-500 mb-1">Hasta</span>
                  <input type="number" v-model.number="newRepeat.endMeasure" class="w-full text-center text-[18px] font-bold outline-none bg-transparent text-[#34C759]" />
                </div>
                <div class="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <span class="block text-[12px] font-semibold text-gray-500 mb-1">Veces</span>
                  <input type="number" v-model.number="newRepeat.times" class="w-full text-center text-[18px] font-bold outline-none bg-transparent text-[#34C759]" />
                </div>
              </div>
              <button @click="addRepeat" class="w-full p-3.5 bg-[#34C759] text-white font-bold rounded-xl text-[17px] active:scale-[0.98] transition-transform shadow-md shadow-[#34C759]/30">
                Añadir Repetición
              </button>
            </div>
          </div>
        </div>

        <!-- SECTION OPTIONS MODAL -->
        <div v-if="isMeasureOptionsOpen" class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe z-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 rounded-t-[16px]">
            <button @click="isMeasureOptionsOpen = false" class="text-gray-500 text-[17px] font-medium">Cancelar</button>
            <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Compás {{ selectedMeasureIndex + 1 }}</h3>
            <button @click="saveMeasureOptions" class="text-[#34C759] text-[17px] font-bold">Guardar</button>
          </div>
          
          <div class="p-6">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative dropdown-container">
              <button @click="toggleDropdown('sectionLabel')" class="w-full flex items-center justify-between p-4 active:bg-gray-50">
                <span class="text-[17px] font-semibold text-gray-800">Sección</span>
                <span class="text-[17px] text-[#34C759] font-bold flex items-center gap-1">{{ tempSectionLabel }} <svg class="w-4 h-4" :class="{'rotate-180': activeDropdown === 'sectionLabel'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></span>
              </button>
              
              <transition name="dropdown">
                <div v-if="activeDropdown === 'sectionLabel'" class="absolute bottom-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mb-2">
                  <button v-for="s in SECTIONS" :key="s" @click="tempSectionLabel = s; activeDropdown = null" class="w-full text-left p-4 border-b border-gray-100 font-semibold text-[16px] hover:bg-[#34C759]/5" :class="tempSectionLabel === s ? 'text-[#34C759]' : 'text-gray-700'">{{ s }}</button>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <!-- CHORD SELECTION MODAL -->
        <div v-if="isModalOpen" class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe flex flex-col max-h-[85vh] z-10 md:w-[600px] md:mx-auto md:rounded-3xl md:mb-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shrink-0 rounded-t-[16px] md:rounded-t-3xl">
            <button @click="isModalOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">Cerrar</button>
            <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">{{ key }} {{ scaleType === 'major' ? 'Mayor' : 'Menor' }}</h3>
            <button @click="selectChord({root:'', type:''})" class="text-red-500 text-[17px] font-bold bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">Borrar</button>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto">
            <!-- iOS Segmented Control -->
            <div class="flex p-1 bg-gray-200/80 rounded-xl mb-6 max-w-sm mx-auto shadow-inner">
              <button @click="modalComplexity = 'triad'" :class="modalComplexity === 'triad' ? 'bg-white shadow-sm text-[#34C759] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tríadas</button>
              <button @click="modalComplexity = 'tetrad'" :class="modalComplexity === 'tetrad' ? 'bg-white shadow-sm text-[#34C759] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tétradas</button>
            </div>
            
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <button 
                v-for="chord in diatonicChords" 
                :key="chord.degreeNumeral"
                @click="selectChord(chord)"
                class="bg-white border border-gray-100 rounded-2xl py-5 flex flex-col items-center justify-center shadow-sm active:scale-95 active:bg-[#34C759]/5 transition-all group"
              >
                <span class="text-[12px] text-gray-400 font-bold mb-1 uppercase tracking-widest group-active:text-[#34C759]/50">{{ chord.degreeNumeral }}</span>
                <span class="text-2xl font-black text-gray-800 group-active:text-[#34C759]">{{ chord.label }}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<style>
/* CSS Reset Minimal & Utilities */
:root { --sat: env(safe-area-inset-top); --sab: env(safe-area-inset-bottom); }
.pb-safe { padding-bottom: max(1.5rem, var(--sab)); }
html, body { overscroll-behavior-y: none; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dropdown-enter-active, .dropdown-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: top; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: scaleY(0.95) translateY(-5px); }

.grid-anim-enter-active, .grid-anim-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.grid-anim-enter-from, .grid-anim-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }
.grid-anim-leave-active { position: absolute; }
</style>
