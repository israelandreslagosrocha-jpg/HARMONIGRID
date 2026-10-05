<script>
import {computed} from 'vue'
import PlaybackCursor from './PlaybackCursor.vue'
export default {
  components: {PlaybackCursor},
  props: {context: {type: Object, required: true}, system: {type: Object, required: true}, index: {type: Number, required: true}},
  setup(props) {
    const playingMeasure = computed(() => {
      const state = props.context.playbackRenderState
      const index = state.isPlaying.value ? state.measure.value : null
      return props.system.measures.some(m => m.displayedMeasureIndex === index) ? index : null
    })
    const playingBeat = computed(() => playingMeasure.value === null ? null : props.context.playbackRenderState.beat.value)
    return {...props.context, playingMeasure, playingBeat, system: computed(() => props.system), sIdx: computed(() => props.index)}
  }
}
</script>
<template>
<div
                :id="'system-row-' + system.id"
                class="flex flex-col gap-y-3 w-full relative system-row"
                :class="{ 'z-30': isSystemActiveOrHasActiveLyrics(system), 'z-10': !isSystemActiveOrHasActiveLyrics(system) }"
              >
                <!-- SVG Connectors overlay -->
                <svg
                  class="absolute inset-0 pointer-events-none w-full h-full z-25 overflow-visible"
                  v-if="currentPlan === 'PRO' && showLyricsGlobal"
                >
                  <path
                    v-for="conn in activeConnectors.filter(c => c.systemId === system.id)"
                    :key="conn.id"
                    :d="conn.path"
                    :stroke="conn.active ? '#8B5CF6' : '#C4B5FD'"
                    :stroke-width="conn.active ? 2.5 : 1.5"
                    :stroke-dasharray="conn.active ? 'none' : '3,3'"
                    fill="none"
                    class="transition-all duration-200"
                    :opacity="conn.active ? 1 : 0.45"
                  />
                </svg>
                <!-- MEASURES ROW -->
                <div
                  class="system-row gap-x-3 gap-y-10 w-full relative"
                  :class="{ 'z-30': isSystemActive(system), 'z-10': !isSystemActive(system) }"
                >
                <template v-for="(measure, mIdx) in system.measures" :key="measure.id">

                  <!-- Recuadro de nueva escala (Between measures, only in PRO) -->
                  <div
                    v-if="currentPlan === 'PRO' && measure.keyChange"
                    class="flex flex-col items-center justify-center pt-2 flex-shrink-0 select-none text-center min-w-[96px] md:min-w-[120px] max-w-[140px] h-28 self-center animate-scale-up"
                  >
                    <button
                      @click.stop="openKeyChangeInfo(measure)"
                      class="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-violet-500 active:scale-[0.97] transition-all w-full text-center shadow-sm"
                    >
                      <span class="text-[10px] md:text-[11px] font-black text-gray-700 leading-tight uppercase tracking-wider block w-full truncate">
                        {{ translateNoteToSpanish(measure.keyChange.key) }} {{ SCALES[measure.keyChange.scaleType]?.name || measure.keyChange.scaleType }}
                      </span>
                      <span
                        class="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black tracking-wide"
                        :class="getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) === 'Limpia' ? 'text-gray-400 bg-gray-200/80' : 'text-violet-600 bg-violet-50 border border-violet-100/50'"
                      >
                        {{ getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) }}
                      </span>
                    </button>
                  </div>
                  <!-- Recuadro de nueva métrica local (Between measures, only in PRO, skip first displayed measure) -->
                  <div
                    v-if="currentPlan === 'PRO' && measure.timeSignature && measure.displayedMeasureIndex > 0 && (measure.timeSignature.beats !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).beats || measure.timeSignature.unit !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).unit)"
                    class="flex flex-col items-center justify-center pt-2 flex-shrink-0 select-none text-center min-w-[64px] md:min-w-[72px] max-w-[90px] h-28 self-center animate-scale-up"
                  >
                    <button
                      @click.stop="openLocalMetricInfo(measure)"
                      class="flex flex-col items-center p-1.5 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-violet-500 active:scale-[0.97] transition-all w-full text-center shadow-sm animate-pulse-subtle"
                    >
                      <span class="text-[7.5px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Métrica</span>
                      <div class="flex flex-col items-center leading-none">
                        <div class="text-xl md:text-2xl font-serif font-black text-gray-850 flex items-center justify-center">
                          <span>{{ measure.timeSignature.beats }}</span>
                        </div>
                        <div class="w-4 h-0.5 bg-gray-400 my-0.5 transition-colors"></div>
                        <div class="text-xl md:text-2xl font-serif font-black text-gray-850">{{ measure.timeSignature.unit }}</div>
                      </div>
                    </button>
                  </div>
                  <!-- Measure Card -->
                  <div
                    class="relative bg-white border-2 border-gray-300 rounded-lg flex overflow-visible h-28 shadow-sm transition-all hover:border-[#8EE000] group"
                    :class="{
                      'border-l-[4px] border-l-black': getRepeatStart(measure.originalMeasureIndex),
                      'border-r-[4px] border-r-black': getRepeatEnd(measure.originalMeasureIndex),
                      'border-[#a78bfa] hover:border-[#8b5cf6]': measure.isExpandedCopy,
                      'border-[#8EE000] bg-[#8EE000]/5': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'FREE',
                      'border-violet-500 bg-violet-50/50 shadow-md shadow-violet-100': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'PRO',
                      'z-40': isRhythmSelectorActiveForMeasure(measure.originalMeasureIndex)
                    }"
                    :style="getMeasureFlexStyle(measure)"
                  >
                    <!-- Playhead Line (Reproducción) -->
                    <PlaybackCursor :measure-index="measure.displayedMeasureIndex" :state="playbackRenderState" />
                    <!-- Selection Mode Overlay -->
                    <div
                      v-if="isSelectionMode"
                      @mousedown.prevent="startSelectionDrag(measure.originalMeasureIndex)"
                      @mouseenter="continueSelectionDrag(measure.originalMeasureIndex)"
                      @click.stop="toggleMeasureSelection(measure.originalMeasureIndex)"
                      class="absolute inset-0 z-30 cursor-pointer rounded-lg transition-all duration-200"
                      :class="[
                        isMeasureSelected(measure.originalMeasureIndex)
                          ? (currentPlan === 'PRO' ? 'bg-violet-500/10 hover:bg-violet-500/20' : 'bg-[#8EE000]/10 hover:bg-[#8EE000]/20')
                          : 'hover:bg-gray-100/50'
                      ]"
                    ></div>
                    <!-- CASILLA BRACKET (COMPACT MODE ONLY) -->
                    <div v-if="viewMode === 'compact' && getCasillaData(measure.displayedMeasureIndex)" class="absolute -top-7 left-0 right-0 h-6 pointer-events-none select-none flex flex-col justify-end z-20">
                      <div class="flex items-center text-[10px] font-black text-gray-700 px-1 leading-none mb-0.5">
                        <span v-if="getCasillaData(measure.displayedMeasureIndex).isStart" class="bg-white/95 px-1 rounded-sm shadow-sm border border-gray-200">
                          {{ getCasillaData(measure.displayedMeasureIndex).type === 1 ? `1. (x${getCasillaData(measure.displayedMeasureIndex).times})` : `2.` }}
                        </span>
                      </div>
                      <div class="h-1.5 border-t-2 border-gray-800"
                           :class="{
                             'border-l-2 rounded-tl-sm': getCasillaData(measure.displayedMeasureIndex).isStart,
                             'border-r-2 rounded-tr-sm': getCasillaData(measure.displayedMeasureIndex).isEnd
                           }">
                      </div>
                    </div>
                    <!-- SECTION LABEL (INSIDE CARD TO AVOID BRACKET CONFLICTS) -->
                    <div v-if="measure.sectionLabel" class="absolute top-1.5 left-2 bg-[#8EE000] text-black px-1.5 py-0.5 text-[10px] font-black rounded z-10 shadow-sm uppercase tracking-wider">
                      {{ measure.sectionLabel }}
                    </div>

                    <!-- REPEAT DOTS -->
                    <div v-if="getRepeatStart(measure.originalMeasureIndex)" class="absolute top-1/2 -translate-y-1/2 left-2 flex flex-col gap-1.5 z-10">
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    </div>
                    <div v-if="getRepeatEnd(measure.originalMeasureIndex)" class="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-1.5 z-10">
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    </div>
                    <div v-if="getRepeatEnd(measure.originalMeasureIndex)" class="absolute -top-6 right-0 text-[12px] font-bold text-gray-700 z-10 bg-white px-1 border border-b-0 border-gray-300 rounded-t-md">
                      (x{{ getRepeatEnd(measure.originalMeasureIndex).times }})
                    </div>

                    <!-- Key display on first measure only -->
                    <div v-if="measure.displayedMeasureIndex === 0" class="absolute top-1 right-2 text-[10px] font-black text-[#6CA600]/50">
                      {{ key }}{{ scaleType === 'minor' ? 'm' : '' }}
                    </div>
                    <!-- Harmonic Rhythm Indicators (♪, ♬, ↷, 3, 5) -->
                    <div
                      v-if="getActiveMeasureRhythms(measure).length > 0"
                      class="absolute -top-6 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full px-2 py-0.5 shadow-sm text-gray-600 flex items-center gap-1 z-20 text-[9px] font-black"
                      :class="measure.displayedMeasureIndex === 0 ? 'right-12' : (getRepeatEnd(measure.originalMeasureIndex) ? 'right-12' : 'right-2')"
                      title="Ritmo Armónico Activo"
                    >
                      <span
                        v-for="(symbol, sIdx) in getActiveMeasureRhythms(measure)"
                        :key="sIdx"
                        class="text-[10px] leading-none"
                      >
                        {{ symbol }}
                      </span>
                    </div>
                    <!-- Measure Options Button (Hide in Expanded Mode) -->
                    <button
                      v-if="viewMode === 'compact'"
                      @click.stop="openMeasureOptions(measure.originalMeasureIndex)"
                      class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white text-gray-400 hover:text-[#6CA600] hover:border-[#8EE000] border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-xs z-20 shadow-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >⚙️</button>

                    <!-- MEASURE INDEX & PROJECTION BADGE -->
                    <div class="absolute bottom-1 left-2 text-[10px] font-bold text-gray-300 pointer-events-none flex items-center gap-1.5 z-10 select-none">
                      <span>#{{ measure.displayedMeasureIndex + 1 }}</span>
                      <span v-if="measure.isExpandedCopy" class="text-violet-600 font-extrabold bg-violet-50 px-1 rounded-sm border border-violet-100 text-[9px] scale-90 origin-left">
                        Original {{ measure.originalMeasureIndex + 1 }} (Vta. {{ measure.displayPass }})
                      </span>

                      <!-- Auto Subdivision Badge -->
                      <template v-if="measure.showSubdivisions !== false && getMeasureTimeSignature(measure).unit === 8">
                        <!-- Match -->
                        <span
                          v-if="analyzeMeasureSubdivision(measure).type === 'match'"
                          class="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up"
                          title="Subdivisión detectada automáticamente"
                        >
                          ✔ Sub: {{ analyzeMeasureSubdivision(measure).pattern.join('+') }}
                        </span>
                        <!-- Ambiguous Match -->
                        <span
                          v-else-if="analyzeMeasureSubdivision(measure).type === 'ambiguous_match'"
                          class="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up cursor-help"
                          :title="'Podría completarse como: ' + analyzeMeasureSubdivision(measure).matchingPatterns.map(p => p.join('+')).join(' o ')"
                        >
                          💡 Podría ser: {{ analyzeMeasureSubdivision(measure).matchingPatterns[0].join('+') }}
                        </span>
                        <!-- Inconsistent -->
                        <span
                          v-else-if="analyzeMeasureSubdivision(measure).type === 'inconsistent'"
                          class="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[8.5px] font-black rounded-md flex items-center gap-0.5 animate-scale-up"
                          :title="analyzeMeasureSubdivision(measure).message"
                        >
                          ⚠️ Ritmo irregular
                        </span>
                      </template>
                      <!-- Measure groove override indicator -->
                      <div
                        v-if="measure.groove && measure.groove !== 'global'"
                        class="bg-violet-100 text-violet-750 border border-violet-200 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wide pointer-events-auto"
                        title="Anulación de groove en este compás"
                      >
                        {{ measure.groove === 'neutral' ? 'Neutral' : 'Custom' }}
                      </div>
                    </div>

                    <!-- BEATS -->
                    <div class="flex-1 flex z-0 relative ml-4 mr-4">
                      <!-- Center horizontal line -->
                      <div class="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -translate-y-1/2 pointer-events-none z-0"></div>
                      <!-- SVG Overlay for Ties (Ligados) -->
                      <svg
                        v-if="currentPlan === 'PRO'"
                        class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                        viewBox="0 0 1000 100"
                        preserveAspectRatio="none"
                      >
                        <path
                          v-for="(path, pIdx) in getMeasureTiesPaths(measure)"
                          :key="pIdx"
                          :d="path.d"
                          fill="none"
                          stroke="#8EE000"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          class="tie-arc transition-all duration-300"
                        />
                      </svg>

                      <template v-for="state in getMergedBeats(measure)" :key="state.index">
                        <div
                          v-if="!state.isMerged"
                          class="flex h-full z-10 relative m-0.5 beat-container"
                          :style="{
                            flex: currentPlan === 'PRO' ? `${state.durationSlots} ${state.durationSlots} 0%` : getBeatFlexGrow(measure, state.beat, state.index),
                            minWidth: `${getBeatMinWidth(measure, state.beat, state)}px`
                          }"
                          :class="{
                            'bg-violet-600/[0.03] border-y border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).groupIndex % 2 === 0,
                            'bg-indigo-600/[0.03] border-y border-indigo-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).groupIndex % 2 !== 0,
                            'rounded-l-lg border-l border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst,
                            'rounded-r-lg border-r border-violet-600/[0.05]': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isLast,
                            'ml-2.5': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                            'ml-2': currentPlan === 'PRO' && measure.showSubdivisions === false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                            'ring-2 ring-[#8EE000]/80 bg-[#8EE000]/10 shadow-lg shadow-[#8EE000]/15 z-20': playingMeasure === measure.displayedMeasureIndex && playingBeat === state.index
                          }"
                        >
                          <!-- Group separator line -->
                          <div
                            v-if="currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0"
                            class="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-violet-400/80 -ml-[6px] rounded-full pointer-events-none"
                          ></div>
                          <div
                            v-if="state.durationSlots > 1"
                            class="absolute inset-0 flex pointer-events-none z-0 transition-opacity duration-200"
                            :class="measure.showSubdivisions !== false ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'"
                          >
                            <div v-for="n in state.durationSlots - 1" :key="n" class="flex-1 border-r border-gray-400/50"></div>
                            <div class="flex-1"></div>
                          </div>
                          <!-- Normal Beat -->
                          <div
                            v-if="!shouldRenderAsSubdivided(measure, state.beat, state.index)"
                            @click.stop="clickBeat(measure.originalMeasureIndex, state.index, measure.displayedMeasureIndex)"
                            class="w-full h-full flex flex-col items-center justify-center active:bg-[#8EE000]/10 hover:bg-[#8EE000]/5 relative transition-colors rounded-lg group/beat cursor-pointer"
                          >
                            <!-- Chord name wrapped in white badge for clean margins and readability -->
                            <div
                              v-if="state.beat.root || (state.beat.subdivisions && state.beat.subdivisions.some(s => s.root))"
                              :id="'chord-card-' + state.beat.id"
                              @mouseenter="hoveredChordId = state.beat.id"
                              @mouseleave="hoveredChordId = null"
                              class="bg-white/95 border border-gray-200/80 rounded-xl px-3 py-1 shadow-sm z-10 flex flex-col items-center justify-center gap-0.5 group-hover/beat:scale-105 transition-transform animate-scale-up max-w-[calc(100%+16px)]"
                              :class="{ 'border-violet-500 ring-2 ring-violet-100 shadow-md shadow-violet-100': currentPlan === 'PRO' && (hoveredChordId === state.beat.id || (hoveredAnchor && isChordIdRelatedToBeat(hoveredAnchor.chordId, state.beat.id, measure))) }"
                            >
                              <div class="flex flex-col items-center justify-center">
                                <span :class="[getMeasureFontSizeClass(measure), 'text-gray-800 font-black leading-none']">
                                  {{ getBeatDisplayChord(state.beat).main }}
                                </span>
                                <span v-if="getBeatDisplayChord(state.beat).bass" class="text-xs text-gray-500 font-bold leading-none mt-0.5">
                                  {{ getBeatDisplayChord(state.beat).bass }}
                                </span>
                              </div>
                              <!-- Obligado symbol display -->
                              <svg
                                v-if="measure.showObligado"
                                class="h-4 w-12 text-violet-600 shrink-0 select-none pointer-events-none mt-0.5"
                                viewBox="0 0 100 24"
                                preserveAspectRatio="none"
                                v-html="getRhythmDisplayIconSVG(state.beat.harmonicRhythm || 'auto', measure, state.beat)"
                              ></svg>
                            </div>
                            <!-- Rest Badge / Slash line -->
                            <template v-else>
                              <div
                                v-if="measure.showObligado && state.beat.harmonicRhythm"
                                class="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 shadow-sm z-10 flex flex-col items-center justify-center gap-0.5 opacity-60 hover:scale-105 transition-transform"
                              >
                                <span class="text-gray-400 font-bold leading-none text-[11px]">𝄾</span>
                                <svg
                                  class="h-4 w-12 text-gray-400 shrink-0 select-none pointer-events-none mt-0.5"
                                  viewBox="0 0 100 24"
                                  preserveAspectRatio="none"
                                  v-html="getRhythmDisplayIconSVG(state.beat.harmonicRhythm, measure, state.beat)"
                                ></svg>
                              </div>
                              <div
                                v-else
                                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-gray-300 transform rotate-12 group-hover/beat:opacity-0"
                              ></div>
                            </template>

                            <!-- Beat override icon -->
                            <span
                              v-if="hasBeatRhythmOverride(measure, state.beat, state.index)"
                              class="text-[9px] font-black text-violet-600 absolute top-1 right-2 select-none pointer-events-none transition-opacity duration-200 group-hover/beat:opacity-0"
                              title="Anulación de ritmo en este acorde"
                            >
                              {{ getSubdivisionIcon(state.beat.harmonicRhythm) }}
                            </span>
                            <!-- Tiny Rhythm edit button (only visible when Ritmo Armónico is ON) -->
                            <button
                              v-if="measure.showObligado"
                              @click.stop="openRhythmSelector(measure.originalMeasureIndex, state.index)"
                              class="absolute top-1 right-1 text-[9px] text-[#6CA600]/50 hover:text-[#6CA600] hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/beat:opacity-100 z-20 w-4 h-4 flex items-center justify-center bg-gray-550 hover:bg-gray-100 rounded border border-gray-200/80 shadow-sm"
                              title="Cambiar figura rítmica"
                            >
                              ✏️
                            </button>
                            <!-- Rhythm Selector Popover for Normal Beat -->
                            <transition name="dropdown">
                              <div
                                v-if="activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex && activeRhythmSelector.beatIndex === state.index"
                                class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] max-h-[420px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 rhythm-popover-container text-white text-left font-sans cursor-default scrollbar-thin scrollbar-thumb-slate-700"
                                @click.stop
                              >
                                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">Figuras Básicas</div>
                                <div class="grid grid-cols-2 gap-1.5">
                                  <button v-show="!isFreeLaunch || !fig.isPro"
                                    v-for="fig in getAvailableRhythmFigures(measure)"
                                    :key="fig.value"
                                    @click.stop="selectRhythmFigure(fig.value)"
                                    class="flex flex-col justify-center px-3 py-1.5 rounded-xl border transition-all text-left"
                                    :class="[
                                      getEffectiveRhythm(measure, state.beat, state.index) === fig.value
                                        ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                        : 'text-slate-200 bg-slate-850/50 border border-transparent',
                                      !isFigureValid(fig.value, measure, state.index)
                                        ? 'opacity-40 cursor-not-allowed'
                                        : ''
                                    ]"
                                  >
                                      <div class="flex items-center gap-1.5">
                                        <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(fig.value, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                        <span v-if="fig.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black shrink-0">PRO</span>
                                      </div>
                                      <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ fig.label }}</span>
                                    </button>
                                  </div>

                                  <template v-if="['eighth', 'sixteenth', 'triplet'].includes(getEffectiveRhythm(measure, state.beat, state.index))">
                                    <div class="border-t border-slate-800/80 my-1"></div>

                                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none flex items-center justify-center gap-1.5">
                                      <span>♬</span> <span>{{ getEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? 'Familia de Tresillos' : (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? (getMeasureTimeSignature(measure).unit === 8 ? 'Familia de Semicorcheas (2 Notas)' : 'Familia de Corcheas (2 Notas)') : 'Familia de Semicorcheas') }}</span>
                                      <span v-show="!isFreeLaunch" v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black uppercase tracking-wide">PRO</span>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                      <button
                                        v-for="(pat, key) in (getEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? TRIPLET_PATTERNS : (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS))"
                                        :key="key"
                                        @click.stop="selectSixteenthPatternWrapper(measure, state.beat, key)"
                                        class="w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left"
                                        :class="isPatternActive(measure, state.beat, state.index, key)
                                          ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                          : 'text-slate-200 bg-slate-850/30 border border-transparent'"
                                      >
                                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                                          <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                          <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ getPatternLabel(key, pat, getMeasureTimeSignature(measure).unit === 8) }}</span>
                                        </div>
                                        <span v-if="isPatternActive(measure, state.beat, state.index, key)" class="text-[#6CA600] text-xs font-black shrink-0 ml-2">✓</span>
                                      </button>
                                    </div>

                                  <div class="border-t border-slate-800/80 my-1.5"></div>
                                  <div class="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                                    <div class="flex items-center justify-between">
                                      <span class="text-[10px] font-black text-violet-400 uppercase tracking-wider">Vista de figuras separadas</span>
                                      <button
                                        @click.stop="state.beat.forceSeparated = !state.beat.forceSeparated"
                                        class="px-2 py-1 rounded text-[10px] font-black transition-all"
                                        :class="state.beat.forceSeparated ? 'bg-[#8EE000]/20 text-[#8EE000] border border-[#8EE000]/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'"
                                      >
                                        {{ state.beat.forceSeparated ? 'ACTIVADA' : 'DESACTIVADA' }}
                                      </button>
                                    </div>
                                    <p class="text-[9px] text-slate-400 leading-normal font-medium select-none">
                                      Usa esta vista para separar las figuras en tarjetas individuales y poder elegir acordes asociados a cada figura que se está mostrando de forma independiente.
                                    </p>
                                  </div>
                                </template>
                              </div>
                            </transition>
                          </div>
                          <!-- Subdivided Beat -->
                          <div
                            v-else
                            class="w-full h-full flex flex-col border border-gray-200 rounded-lg overflow-visible bg-white relative shadow-sm group/sub-beat"
                          >
                            <!-- SVG Rhythmic Beam Display with Click to Edit Rhythm -->
                            <div
                              @click.stop="openRhythmSelector(measure.originalMeasureIndex, state.index)"
                              class="h-6 w-full bg-gray-50/70 hover:bg-[#8EE000]/10 border-b border-gray-100 flex items-center justify-center select-none relative group/rhythm transition-colors outline-none cursor-pointer shrink-0"
                              title="Cambiar figura rítmica del pulso"
                            >
                              <svg
                                class="h-4 text-[#6CA600] transition-all duration-200"
                                :class="measure.showSubdivisions !== false ? 'w-full' : (getVisibleSlotsForRender(measure, state.beat, state.index).length === 1 ? 'w-16 mx-auto' : 'w-full')"
                                :style="{ opacity: (measure.showSubdivisions === false && state.index > 0) ? 0.65 : 1 }"
                                viewBox="0 0 100 24"
                                preserveAspectRatio="none"
                              >
                                <g v-html="getDynamicRhythmSVG(getEffectiveRhythm(measure, state.beat, state.index), getBeatPatternKey(state.beat, getEffectiveRhythm(measure, state.beat, state.index)), getVisibleSlotsForRender(measure, state.beat, state.index), getMeasureTimeSignature(measure).unit === 8)"></g>
                              </svg>
                              <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#6CA600]/75 group-hover/rhythm:text-[#6CA600] group-hover/rhythm:scale-110 transition-all font-bold">✏️</span>

                              <!-- Rhythm Selector Popover for Subdivided Beat -->
                              <transition name="dropdown">
                                <div
                                  v-if="activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex && activeRhythmSelector.beatIndex === state.index"
                                  class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] max-h-[420px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 rhythm-popover-container text-white text-left font-sans cursor-default scrollbar-thin scrollbar-thumb-slate-700"
                                  @click.stop
                                >
                                  <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">Figuras Básicas</div>
                                  <div class="grid grid-cols-2 gap-1.5">
                                    <button v-show="!isFreeLaunch || !fig.isPro"
                                      v-for="fig in getAvailableRhythmFigures(measure)"
                                      :key="fig.value"
                                      @click.stop="selectRhythmFigure(fig.value)"
                                      class="flex flex-col justify-center px-3 py-1.5 rounded-xl border transition-all text-left"
                                      :class="[
                                        getEffectiveRhythm(measure, state.beat, state.index) === fig.value
                                          ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                          : 'text-slate-200 bg-slate-850/50 border border-transparent',
                                        !isFigureValid(fig.value, measure, state.index)
                                          ? 'opacity-40 cursor-not-allowed'
                                          : ''
                                      ]"
                                    >
                                      <div class="flex items-center gap-1.5">
                                        <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(fig.value, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                        <span v-if="fig.isPro && currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 py-0.2 rounded font-black shrink-0">PRO</span>
                                      </div>
                                      <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ fig.label }}</span>
                                    </button>
                                  </div>

                                  <template v-if="['eighth', 'sixteenth', 'triplet'].includes(getEffectiveRhythm(measure, state.beat, state.index))">
                                    <div class="border-t border-slate-800/80 my-1"></div>

                                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none flex items-center justify-center gap-1.5">
                                      <span>♬</span> <span>{{ getEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? 'Familia de Tresillos' : (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? (getMeasureTimeSignature(measure).unit === 8 ? 'Familia de Semicorcheas (2 Notas)' : 'Familia de Corcheas (2 Notas)') : 'Familia de Semicorcheas') }}</span>
                                      <span v-show="!isFreeLaunch" v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-black uppercase tracking-wide">PRO</span>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                      <button
                                        v-for="(pat, key) in (getEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? TRIPLET_PATTERNS : (getEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS))"
                                        :key="key"
                                        @click.stop="selectSixteenthPatternWrapper(measure, state.beat, key)"
                                        class="w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-left"
                                        :class="isPatternActive(measure, state.beat, state.index, key)
                                          ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                          : 'text-slate-200 bg-slate-850/30 border border-transparent'"
                                      >
                                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                                          <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                          <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ getPatternLabel(key, pat, getMeasureTimeSignature(measure).unit === 8) }}</span>
                                        </div>
                                        <span v-if="isPatternActive(measure, state.beat, state.index, key)" class="text-[#6CA600] text-xs font-black shrink-0 ml-2">✓</span>
                                      </button>
                                    </div>

                                    <div class="border-t border-slate-800/80 my-1.5"></div>
                                    <div class="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                                      <div class="flex items-center justify-between">
                                        <span class="text-[10px] font-black text-violet-400 uppercase tracking-wider">Vista de figuras separadas</span>
                                        <button
                                          @click.stop="state.beat.forceSeparated = !state.beat.forceSeparated"
                                          class="px-2 py-1 rounded text-[10px] font-black transition-all"
                                          :class="state.beat.forceSeparated ? 'bg-[#8EE000]/20 text-[#8EE000] border border-[#8EE000]/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'"
                                        >
                                          {{ state.beat.forceSeparated ? 'ACTIVADA' : 'DESACTIVADA' }}
                                        </button>
                                      </div>
                                      <p class="text-[9px] text-slate-400 leading-normal font-medium select-none">
                                        Usa esta vista para separar las figuras en tarjetas individuales y poder elegir acordes asociados a cada figura que se está mostrando de forma independiente.
                                      </p>
                                    </div>
                                  </template>
                                </div>
                              </transition>
                            </div>
                            <!-- Subdivided Slots -->
                            <div :class="['flex-1 flex', measure.showSubdivisions !== false ? 'divide-x divide-gray-200' : 'divide-x divide-transparent group-hover/sub-beat:divide-gray-200/40 transition-colors duration-200']">
                              <button
                                v-for="sub in getVisibleSlotsForRender(measure, state.beat, state.index)"
                                :key="sub.originalIndex"
                                :disabled="getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0"
                                @click.stop="clickBeat(measure.originalMeasureIndex, state.index, measure.displayedMeasureIndex, sub.originalIndex)"
                                class="h-full flex flex-col items-center justify-center relative transition-colors group/subslot"
                                :style="{ flexGrow: sub.flexGrow }"
                                :class="[
                                  getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0
                                    ? (measure.showSubdivisions !== false ? 'bg-gray-105 cursor-not-allowed text-gray-450' : 'bg-transparent cursor-not-allowed text-gray-400')
                                    : 'active:bg-[#8EE000]/10 hover:bg-[#8EE000]/5 text-gray-800'
                                ]"
                              >
                                <!-- Botón para alternar ligado con la siguiente figura -->
                                <button v-show="!isFreeLaunch"
                                  v-if="getEffectiveRhythm(measure, state.beat, state.index) !== 'offbeat' || sub.originalIndex !== 0"
                                  @click.stop="toggleTieBySlotId(`${measure.originalMeasureIndex}_${state.index}_${sub.originalIndex}`)"
                                  class="absolute -top-1 -right-1 text-[8px] px-1 py-0.2 rounded-full transition-all font-bold z-20 shadow-sm flex items-center justify-center bg-gray-100 hover:bg-violet-100 text-gray-400 hover:text-violet-750 opacity-0 group-hover/subslot:opacity-100"
                                  :class="{ 'bg-violet-600 text-white !opacity-100 shadow-violet-200': isSlotTiedToNext(`${measure.originalMeasureIndex}_${state.index}_${sub.originalIndex}`) }"
                                  title="Ligar a la siguiente figura"
                                >
                                  🔗
                                </button>

                                <!-- Arco de ligado curvo (TIE) a la siguiente figura -->
                                <div v-if="isSlotTiedToNext(`${measure.originalMeasureIndex}_${state.index}_${sub.originalIndex}`)" class="absolute -bottom-2 right-0 translate-x-1/2 z-30 pointer-events-none flex items-center justify-center">
                                  <svg class="w-8 h-3.5 text-violet-600 drop-shadow-sm" viewBox="0 0 32 14">
                                    <path d="M 2 2 Q 16 14 30 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                                  </svg>
                                </div>

                                <!-- Mini override rhythm indicator over chord -->
                                <span
                                  v-if="hasBeatRhythmOverride(measure, state.beat, state.index) && !sub.isSilence"
                                  class="text-[9px] font-black text-violet-600 leading-none scale-75 select-none absolute top-1 pointer-events-none"
                                  title="Anulación de ritmo en este acorde"
                                >
                                  {{ getSubdivisionIcon(state.beat.harmonicRhythm) }}
                                </span>
                                <!-- Silence indicator for offbeat (contratiempo) or empty subdivisions -->
                                <div
                                  v-if="getEffectiveRhythm(measure, state.beat, state.index) === 'offbeat' && sub.originalIndex === 0"
                                  class="flex flex-col items-center justify-center pt-1"
                                >
                                  <span class="text-[9px] font-bold text-gray-400 select-none">𝄾</span>
                                  <span class="text-[7px] font-black text-gray-300 uppercase tracking-tight scale-90 mt-0.5">Silencio</span>
                                </div>
                                <span
                                  v-else
                                  :class="[
                                    getSubdivisionFontSizeClass(getEffectiveRhythm(measure, state.beat, state.index) === 'sixteenth' ? (4 / sub.flexGrow) : getBeatSlots(measure, state.beat, state.index).length),
                                    'leading-none font-bold text-center mt-2 flex items-center justify-center gap-0.5'
                                  ]"
                                >
                                  <span v-if="!sub.root">𝄾</span>
                                  <span v-else
                                    :id="'chord-card-' + sub.id"
                                    @mouseenter="hoveredChordId = sub.id"
                                    @mouseleave="hoveredChordId = null"
                                    class="flex flex-col items-center justify-center leading-none px-1 py-0.5 rounded border border-transparent transition-all"
                                    :class="{ 'border-violet-500 bg-violet-50 text-violet-750 font-black shadow-sm ring-1 ring-violet-100': currentPlan === 'PRO' && (hoveredChordId === sub.id || (hoveredAnchor && isChordIdRelatedToBeat(hoveredAnchor.chordId, sub.id, measure))) }"
                                  >
                                    <span>{{ splitChordDisplay(sub, measure.originalMeasureIndex).main }}</span>
                                    <span v-if="splitChordDisplay(sub, measure.originalMeasureIndex).bass" class="text-[9px] text-gray-500 font-semibold mt-0.5">
                                      {{ splitChordDisplay(sub, measure.originalMeasureIndex).bass }}
                                    </span>
                                  </span>
                                  <span
                                    v-if="sub.isSilence && sub.root"
                                    class="text-amber-500 text-[11px] animate-pulse cursor-help shrink-0"
                                    title="Advertencia: Acorde colocado en un silencio rítmico"
                                  >⚠️</span>
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                    <!-- Bulb icon for suggestions (💡 Ampolleta de ideas) -->
                    <button
                      v-if="!isOrderingModeActive && system.measures.length === 4 && mIdx === 3 && getSuggestionsForSystemLocal(system).length > 0"
                      @click.stop="openSystemSuggestions(system)"
                      class="absolute -right-5 top-1/2 -translate-y-1/2 bg-amber-50 border border-amber-200 rounded-full w-9 h-9 flex items-center justify-center text-lg z-30 shadow-lg shadow-amber-100 hover:bg-amber-100 active:scale-95 transition-all animate-pulse"
                      title="💡 Sugerencias disponibles para este sistema"
                    >💡</button>
                    <!-- System Break Toggle Button (Ordering Mode only, PRO only) -->
                    <button v-show="!isFreeLaunch"
                      v-if="isOrderingModeActive"
                      @click.stop="toggleSystemBreak(measure.originalMeasureIndex)"
                      class="absolute -right-5 top-1/2 -translate-y-1/2 rounded-full w-9 h-9 flex items-center justify-center text-sm z-30 shadow-lg transition-all border font-bold"
                      :class="measure.systemBreak
                        ? 'bg-violet-600 border-violet-700 text-white hover:bg-violet-750'
                        : 'bg-white border-gray-200 text-gray-400 hover:text-gray-650 hover:border-gray-300'"
                      title="Insertar/Eliminar Salto de Sistema después de este compás"
                    >
                      ↵
                    </button>
                    <div
                      v-if="measure.showObligado && currentPlan === 'PRO' && !getMeasureCapacityExceededMessage(measure)"
                      class="absolute bottom-1 right-2 z-20 flex items-center gap-1 select-none"
                    >
                      <span
                        v-if="getMeasureRemainingBeats(measure) === 0"
                        class="text-[9px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5"
                        title="Compás completo"
                      >
                        ✔ Completo
                      </span>
                      <span
                        v-else
                        class="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-100 transition-colors animate-pulse pointer-events-auto"
                        @click.stop="autoCompleteMeasure(measure)"
                        title="Haga clic para completar automáticamente con silencios"
                      >
                        ⚠️ Falta {{ getMeasureRemainingBeats(measure) }} {{ getMeasureTimeSignature(measure).unit === 8 ? 'corchea' : 'negra' }}{{ getMeasureRemainingBeats(measure) !== 1 ? 's' : '' }}
                      </span>
                    </div>
                    <!-- Lyrics indicator icon (visible when showLyricsGlobal is false and measure has lyrics) -->
                    <div
                      v-if="!showLyricsGlobal && measure.lyrics?.rawText && measure.lyrics.rawText.trim() !== ''"
                      @click.stop="activateLyricsForMeasure(measure.originalMeasureIndex)"
                      class="absolute top-1.5 right-2 text-[10px] bg-violet-100 hover:bg-violet-200 text-violet-750 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer shadow-sm border border-violet-200/50 z-25 transition-all transform hover:scale-105"
                      :class="{ 'mr-10': measure.displayedMeasureIndex === 0 }"
                      title="Ver letra / anotaciones"
                    >
                      💬
                    </div>

                    <!-- Capacity exceeded warning recuadro -->
                    <div
                      v-if="getMeasureCapacityExceededMessage(measure)"
                      class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[95%] bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black px-2 py-1.5 rounded-md z-45 text-center shadow-lg shadow-rose-100/30 flex items-center justify-center gap-1 animate-scale-up"
                    >
                      <span>⚠️</span>
                      <span class="uppercase font-sans font-black tracking-wide">{{ getMeasureCapacityExceededMessage(measure) }}</span>
                    </div>
                  </div>
                </template>

                <!-- ADD MEASURE BUTTON (Hide in Expanded Mode) -->
                <button
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && (currentPlan === 'PRO' || measures.length < 20) && !shouldShowLyricsRow(system)"
                  @click="addMeasure"
                  class="h-28 border-2 border-dashed border-gray-300 bg-white/50 rounded-lg text-gray-400 flex items-center justify-center hover:bg-[#8EE000]/5 hover:border-[#8EE000] hover:text-[#6CA600] transition-all group"
                  :style="getAddButtonFlexStyle()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <!-- Promocional de compases cuando se llega al límite en versión FREE -->
                <button
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && currentPlan === 'FREE' && measures.length >= 20 && !shouldShowLyricsRow(system)"
                  @click="upgradeReason = 'limit'; isUpgradeModalOpen = true"
                  class="h-28 border-2 border-dashed border-violet-300 bg-violet-50/20 rounded-lg text-violet-500 flex flex-col gap-1 items-center justify-center hover:bg-violet-50/50 hover:border-violet-400 hover:text-violet-600 transition-all group px-4 text-center cursor-pointer"
                  :style="getAddButtonFlexStyle()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:scale-110 transition-transform mb-0.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span class="text-xs font-black">20 compases max en FREE</span>
                  <span class="text-[10px] text-violet-600 font-bold">Límite de creación alcanzado</span>
                </button>
              </div>
              <!-- LYRICS ROW -->
              <div
                v-if="shouldShowLyricsRow(system)"
                class="flex flex-row w-full items-stretch gap-x-3 mt-1 select-none transition-all duration-300"
                :class="{
                  'z-30': activeLyricsRhythmSelector && system.measures.some(m => m.originalMeasureIndex === activeLyricsRhythmSelector.measureIndex),
                  'z-20': !activeLyricsRhythmSelector || !system.measures.some(m => m.originalMeasureIndex === activeLyricsRhythmSelector.measureIndex)
                }"
              >
                <template v-for="(measure, mIdx) in system.measures" :key="'lyrics-' + measure.id">
                  <!-- Spacer for key change -->
                  <div
                    v-if="currentPlan === 'PRO' && measure.keyChange"
                    class="flex-shrink-0 min-w-[96px] md:min-w-[120px] max-w-[140px]"
                  ></div>

                  <!-- Spacer for metric change -->
                  <div
                    v-if="currentPlan === 'PRO' && measure.timeSignature && measure.displayedMeasureIndex > 0 && (measure.timeSignature.beats !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).beats || measure.timeSignature.unit !== getMeasureTimeSignature(measure.originalMeasureIndex - 1).unit)"
                    class="flex-shrink-0 min-w-[64px] md:min-w-[72px] max-w-[90px]"
                  ></div>

                  <!-- Lyric block column -->
                  <div
                    :style="getMeasureFlexStyle(measure)"
                    class="relative transition-all duration-200 flex flex-col justify-stretch group"
                    :class="{ 'z-40': activeLyricsRhythmSelector && activeLyricsRhythmSelector.measureIndex === measure.originalMeasureIndex }"
                    @mouseenter="hoveredMeasureIndex = measure.originalMeasureIndex"
                    @mouseleave="hoveredMeasureIndex = null"
                  >
                    <!-- Mode Selector (Libre vs Sincro vs Rítmico) -->
                    <div
                      v-if="hoveredMeasureIndex === measure.originalMeasureIndex && (showLyricsGlobal || (measure.lyrics && measure.lyrics.rawText && measure.lyrics.rawText.trim() !== ''))"
                      class="absolute -top-6 right-2 flex bg-white/95 backdrop-blur-sm shadow-md rounded-full p-0.5 border border-gray-200 z-30 transition-all text-[10px] font-bold"
                    >
                      <button
                        @click="measure.lyrics.mode = 'free'"
                        :class="(measure.lyrics?.mode !== 'synced' && measure.lyrics?.mode !== 'rhythm') ? 'bg-[#8EE000] text-black px-2 py-0.5 rounded-full shadow-sm' : 'text-gray-500 hover:text-gray-700 px-2 py-0.5'"
                      >
                        Libre
                      </button>
                      <button v-show="!isFreeLaunch"
                        @click="currentPlan === 'PRO' ? (measure.lyrics.mode = 'synced') : (upgradeReason = 'synced_lyrics', isUpgradeModalOpen = true)"
                        :class="measure.lyrics?.mode === 'synced' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm' : 'text-gray-500 hover:text-gray-700 px-2 py-0.5 flex items-center gap-0.5'"
                      >
                        Sincro
                        <span v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 rounded-full font-black font-sans">PRO</span>
                      </button>
                      <button v-show="!isFreeLaunch"
                        @click="currentPlan === 'PRO' ? (measure.lyrics.mode = 'rhythm') : (upgradeReason = 'rhythm_lyrics', isUpgradeModalOpen = true)"
                        :class="measure.lyrics?.mode === 'rhythm' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm' : 'text-gray-500 hover:text-gray-700 px-2 py-0.5 flex items-center gap-0.5'"
                      >
                        Rítmico
                        <span v-if="currentPlan !== 'PRO'" class="text-[7px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1 rounded-full font-black font-sans">PRO</span>
                      </button>
                    </div>
                    <!-- Tooltip and floating Assign Button for pending selection -->
                    <div
                      v-if="pendingSelection && pendingSelection.measureIndex === measure.originalMeasureIndex"
                      class="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white shadow-xl rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-xs font-bold border border-slate-800 z-45 animate-scale-up whitespace-nowrap cursor-default animate-bounce"
                    >
                      <button
                        @click.stop="assignPendingSelection(measure)"
                        class="bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs font-black shadow-md shadow-violet-900/20 active:scale-95 animate-scale-up"
                      >
                        <span>➕ Asignar</span>
                        <span v-if="getNextUnusedChord(measure)" class="bg-violet-850 text-[9px] px-1.5 py-0.5 rounded font-black text-violet-100 uppercase tracking-wide">
                          {{ formatDisplayChord(getNextUnusedChord(measure)) }}
                        </span>
                        <span v-else class="text-[9px] text-violet-300 font-normal italic">
                          (Sin acordes libres)
                        </span>
                      </button>

                      <!-- Cancel button -->
                      <button
                        @click.stop="pendingSelection = null"
                        class="text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <!-- Edit / View Area (if visible) -->
                    <div
                      v-if="showLyricsGlobal || (measure.lyrics && measure.lyrics.rawText && measure.lyrics.rawText.trim() !== '') || measure.originalMeasureIndex === activeEditingLyricsIndex"
                      class="w-full h-full min-h-[38px] flex flex-col justify-stretch bg-white border-y border-gray-300 hover:border-y-gray-400 focus-within:border-y-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition-all overflow-visible"
                      :class="{
                        'border-l border-gray-300 rounded-l-2xl hover:border-l-gray-400 focus-within:border-l-violet-500': isFirstOfGroup(system.measures, mIdx),
                        'border-r border-gray-300 rounded-r-2xl hover:border-r-gray-400 focus-within:border-r-violet-500': isLastOfGroup(system.measures, mIdx),
                        'border-r border-gray-250': !isLastOfGroup(system.measures, mIdx)
                      }"
                    >
                      <!-- MODE: FREE (standard textarea) -->
                      <div
                        v-if="measure.lyrics?.mode !== 'synced' && measure.lyrics?.mode !== 'rhythm'"
                        class="grid w-full h-full items-stretch"
                      >
                        <!-- Auto-grow hidden span -->
                        <span class="lyric-span select-none invisible col-start-1 row-start-1 whitespace-pre-wrap break-words leading-relaxed text-gray-800 font-sans text-[13px]" style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;">{{ measure.lyrics?.rawText || ' ' }}</span>
                        <!-- Actual Textarea -->
                        <textarea
                          :id="'lyrics-textarea-' + measure.originalMeasureIndex"
                          :name="'lyrics-textarea-' + measure.originalMeasureIndex"
                          v-model="measure.lyrics.rawText"
                          placeholder="Escribe..."
                          class="lyric-textarea col-start-1 row-start-1 w-full h-full resize-none bg-transparent outline-none leading-relaxed text-gray-800 font-sans border-0 shadow-none focus:ring-0 focus:outline-none text-[13px]"
                          style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;"
                          @keydown="handleLyricsKeydown($event, measure.originalMeasureIndex)"
                          @focus="activeEditingLyricsIndex = measure.originalMeasureIndex"
                          @blur="activeEditingLyricsIndex = null"
                        ></textarea>
                      </div>
                      <!-- MODE: SYNCED (interactive renderer matching beats row grid layout) -->
                      <div
                        v-else-if="measure.lyrics?.mode === 'synced'"
                        class="flex-1 flex flex-row items-stretch select-text cursor-text"
                        style="padding: 0 16px;"
                      >
                        <template v-for="state in getMergedBeats(measure)" :key="state.index">
                          <div
                            v-if="!state.isMerged"
                            class="flex h-full z-10 relative m-0.5 pointer-events-none"
                            :style="{
                              flex: currentPlan === 'PRO' ? `${state.durationSlots} ${state.durationSlots} 0%` : getBeatFlexGrow(measure, state.beat, state.index),
                              minWidth: `${getBeatMinWidth(measure, state.beat, state)}px`
                            }"
                            :class="{
                              'ml-2.5': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                              'ml-2': currentPlan === 'PRO' && measure.showSubdivisions === false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0
                            }"
                          >
                            <!-- Always render beat slot (never subdivided in lyrics row) -->
                            <div
                              class="w-full h-full flex flex-col justify-center relative select-text pointer-events-none"
                              @mouseup="handleSlotLyricsMouseUp($event, measure, state.beat.id)"
                              @dblclick="handleSlotLyricsDblClick($event, measure)"
                            >
                              <div
                                v-for="layout in [getSlotLayout(measure, state.beat.id)]"
                                :key="state.beat.id"
                                class="leading-relaxed text-gray-800 font-sans text-[13px] py-2 whitespace-nowrap overflow-visible select-text w-full"
                                :class="layout.hasLyrics ? 'pointer-events-auto' : 'pointer-events-none'"
                              >
                                <template v-if="!layout.hasLyrics">
                                  <span class="opacity-0 pointer-events-none select-none">.</span>
                                </template>
                                <template v-else-if="layout.hasAssociated">
                                  <div class="flex justify-center w-full relative">
                                    <div class="relative">
                                      <!-- Pre text aligned to the left of the syllable and flows left -->
                                      <div class="absolute right-full top-0 whitespace-nowrap pr-0.5 select-text">
                                        <span
                                          v-for="segment in layout.pre"
                                          :key="segment.start + '-' + segment.end"
                                          class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                          :class="{
                                            'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                            'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                          }"
                                          @click.stop="handleSegmentClick(segment, measure)"
                                        >{{ segment.text }}</span>
                                      </div>
                                      <!-- Centered syllable -->
                                      <span
                                        :id="'lyric-span-' + measure.originalMeasureIndex + '-' + layout.associated.start + '-' + layout.associated.end"
                                        class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                        :class="{
                                          'bg-violet-50 text-violet-750 font-black border border-violet-200 underline decoration-violet-400 decoration-wavy underline-offset-4 cursor-pointer hover:bg-violet-100': true,
                                          'bg-violet-100 ring-2 ring-violet-200': hoveredChordId === layout.associated.anchor.chordId || (hoveredAnchor && hoveredAnchor.chordId === layout.associated.anchor.chordId && hoveredAnchor.start === layout.associated.anchor.start)
                                        }"
                                        @mouseenter="hoveredAnchor = layout.associated.anchor"
                                        @mouseleave="hoveredAnchor = null"
                                        @click.stop="handleSegmentClick(layout.associated, measure)"
                                      >{{ layout.associated.text }}</span>
                                      <!-- Trailing text aligned to the right of the syllable and flows right -->
                                      <div class="absolute left-full top-0 whitespace-nowrap pl-0.5 select-text">
                                        <span
                                          v-for="segment in layout.post"
                                          :key="segment.start + '-' + segment.end"
                                          class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                          :class="{
                                            'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                            'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                          }"
                                          @click.stop="handleSegmentClick(segment, measure)"
                                        >{{ segment.text }}</span>
                                      </div>
                                    </div>
                                  </div>
                                </template>
                                <template v-else>
                                  <span
                                    v-for="segment in layout.normalSegments"
                                    :key="segment.start + '-' + segment.end"
                                    class="transition-all duration-150 inline-block rounded px-0.5 animate-scale-up"
                                    :class="{
                                      'hover:bg-gray-150 cursor-pointer': segment.type === 'normal',
                                      'bg-amber-100 text-amber-900 font-bold border border-dashed border-amber-300 animate-pulse': segment.type === 'pending'
                                    }"
                                    @click.stop="handleSegmentClick(segment, measure)"
                                  >{{ segment.text }}</span>
                                </template>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                      <!-- MODE: RHYTHM (aligned slots renderer + editor layout) -->
                      <div
                        v-else-if="measure.lyrics?.mode === 'rhythm'"
                        class="flex-1 flex flex-col items-stretch"
                      >
                        <!-- Lyrics Rhythm Grid (Physically between chords score and textarea/pills) -->
                        <div
                          class="flex-1 flex flex-row items-stretch select-none border-b border-gray-100 bg-gray-50/10 py-1.5 relative"
                          style="padding: 0 16px; min-h-[46px]"
                        >
                          <!-- Lyrics Ties paths SVG overlay -->
                          <svg
                            class="absolute pointer-events-none z-25 h-6 top-1.5"
                            style="left: 16px; right: 16px; width: calc(100% - 32px);"
                            viewBox="0 0 1000 24"
                            preserveAspectRatio="none"
                          >
                            <path
                              v-for="(path, pIdx) in getMeasureLyricsTiesPaths(measure)"
                              :key="pIdx"
                              :d="path.d"
                              fill="none"
                              stroke="#8b5cf6"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              class="tie-arc transition-all duration-300"
                            />
                          </svg>
                          <template v-for="state in getLyricsMergedBeats(measure)" :key="state.index">
                            <div
                              v-if="!state.isMerged"
                              class="flex flex-col h-full relative m-0.5"
                              :style="{
                                flex: `${state.durationSlots} ${state.durationSlots} 0%`,
                                minWidth: `${getBeatMinWidth(measure, state.beat, state)}px`
                              }"
                              :class="[
                                (activeLyricsRhythmSelector && activeLyricsRhythmSelector.measureIndex === measure.originalMeasureIndex && activeLyricsRhythmSelector.beatIndex === state.index) ? 'z-30' : 'z-10',
                                {
                                  'ml-2.5': currentPlan === 'PRO' && measure.showSubdivisions !== false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0,
                                  'ml-2': currentPlan === 'PRO' && measure.showSubdivisions === false && getBeatGroupInfo(measure, state.index).isFirst && getBeatGroupInfo(measure, state.index).groupIndex > 0
                                }
                              ]"
                            >
                              <!-- Rhythmic Figure SVG beam at the top of the beat -->
                              <div
                                @click.stop="openLyricsRhythmSelector(measure.originalMeasureIndex, state.index)"
                                class="h-5 w-full bg-violet-50/30 hover:bg-[#8EE000]/10 border border-violet-100/50 rounded flex items-center justify-center relative group/rhythm transition-colors outline-none cursor-pointer shrink-0 mb-1"
                                title="Cambiar figura rítmica de la letra"
                              >
                                <svg
                                  class="h-3.5 text-violet-600 transition-all duration-200"
                                  :class="getLyricsVisibleSlotsForRender(measure, state.beat, state.index).length === 1 ? 'w-16 mx-auto' : 'w-full'"
                                  viewBox="0 0 100 24"
                                  preserveAspectRatio="none"
                                >
                                  <g v-html="getDynamicRhythmSVG(getLyricsEffectiveRhythm(measure, state.beat, state.index), getLyricsBeatPatternKey(state.beat, getLyricsEffectiveRhythm(measure, state.beat, state.index), measure, state.index), getLyricsVisibleSlotsForRender(measure, state.beat, state.index), getMeasureTimeSignature(measure).unit === 8)"></g>
                                </svg>
                                <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-violet-500/70 group-hover/rhythm:text-violet-750 font-bold">✏️</span>
                              </div>

                              <!-- Dedicated Lyrics Figure Selector Popover -->
                              <transition name="dropdown">
                                <div
                                  v-if="activeLyricsRhythmSelector && activeLyricsRhythmSelector.measureIndex === measure.originalMeasureIndex && activeLyricsRhythmSelector.beatIndex === state.index"
                                  class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] max-h-[420px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 rhythm-popover-container text-white text-left font-sans cursor-default scrollbar-thin scrollbar-thumb-slate-700"
                                  @click.stop
                                >
                                  <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none">Figuras para Letra</div>

                                  <!-- Mismo ritmo armónico toggle -->
                                  <div class="bg-slate-850 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5 mb-1.5">
                                    <div class="flex items-center justify-between">
                                      <span class="text-[10px] font-black text-violet-400 uppercase tracking-wider select-none">Mismo ritmo armónico</span>
                                      <button
                                        @click.stop="toggleSyncWithHarmonic(measure, state.beat, state.index)"
                                        class="px-2 py-1 rounded text-[10px] font-black transition-all"
                                        :class="state.beat.syncWithHarmonic ? 'bg-[#8EE000]/20 text-[#8EE000] border border-[#8EE000]/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'"
                                      >
                                        {{ state.beat.syncWithHarmonic ? 'ACTIVADA' : 'DESACTIVADA' }}
                                      </button>
                                    </div>
                                    <p class="text-[9px] text-slate-400 leading-normal font-medium select-none">
                                      Activa esta opción para que el ritmo de la letra siga exactamente al ritmo armónico del acorde.
                                    </p>
                                  </div>

                                  <div class="grid grid-cols-2 gap-1.5">
                                    <button
                                      v-for="fig in getAvailableRhythmFigures(measure)"
                                      :key="fig.value"
                                      :disabled="state.beat.syncWithHarmonic || !isLyricsFigureValid(fig.value, measure, state.index)"
                                      @click.stop="selectLyricsRhythmFigure(fig.value)"
                                      class="flex flex-col justify-center px-3 py-1.5 rounded-xl border transition-all text-left"
                                      :class="[
                                        getLyricsEffectiveRhythm(measure, state.beat, state.index) === fig.value
                                          ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                          : 'text-slate-200 bg-slate-850/50 border border-transparent',
                                        (state.beat.syncWithHarmonic || !isLyricsFigureValid(fig.value, measure, state.index)) ? 'opacity-40 cursor-not-allowed' : ''
                                      ]"
                                    >
                                      <div class="flex items-center gap-1.5">
                                        <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(fig.value, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                      </div>
                                      <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ fig.label }}</span>
                                    </button>
                                  </div>

                                  <template v-if="['eighth', 'sixteenth', 'triplet'].includes(getLyricsEffectiveRhythm(measure, state.beat, state.index))">
                                    <div class="border-t border-slate-800/80 my-1"></div>

                                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center select-none flex items-center justify-center gap-1.5">
                                      <span>♬</span> <span>{{ getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? 'Familia de Tresillos' : (getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? (getMeasureTimeSignature(measure).unit === 8 ? 'Familia de Semicorcheas (2 Notas)' : 'Familia de Corcheas (2 Notas)') : 'Familia de Semicorcheas') }}</span>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                      <button
                                        v-for="(pat, key) in (getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? TRIPLET_PATTERNS : (getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? EIGHTH_PATTERNS : SIXTEENTH_PATTERNS))"
                                        :key="key"
                                        :disabled="state.beat.syncWithHarmonic || !isLyricsFigureValid(getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? 'eighth' : (getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? 'triplet' : 'sixteenth'), measure, state.index)"
                                        @click.stop="selectLyricsSixteenthPatternWrapper(measure, state.beat, key)"
                                        :class="[
                                          isLyricsPatternActive(measure, state.beat, state.index, key)
                                            ? 'bg-[#8EE000]/20 text-[#6CA600] border border-[#8EE000]/30'
                                            : 'text-slate-200 bg-slate-850/30 border border-transparent',
                                          !isLyricsFigureValid(getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'eighth' ? 'eighth' : (getLyricsEffectiveRhythm(measure, state.beat, state.index) === 'triplet' ? 'triplet' : 'sixteenth'), measure, state.index) ? 'opacity-40 cursor-not-allowed' : ''
                                        ]"
                                      >
                                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                                          <svg class="h-4 w-12 text-current shrink-0 select-none" viewBox="0 0 100 24" preserveAspectRatio="none" v-html="getRhythmIconSVG(key, getMeasureTimeSignature(measure).unit === 8)"></svg>
                                          <span class="text-[9px] opacity-65 font-bold truncate block mt-0.5 select-none">{{ getPatternLabel(key, pat, getMeasureTimeSignature(measure).unit === 8) }}</span>
                                        </div>
                                        <span v-if="isLyricsPatternActive(measure, state.beat, state.index, key)" class="text-[#6CA600] text-xs font-black shrink-0 ml-2">✓</span>
                                      </button>
                                    </div>
                                  </template>
                                </div>
                              </transition>
                              <template v-if="getLyricsBeatSlots(measure, state.beat, state.index).length === 0">
                                <div
                                  class="w-full flex-1 flex flex-col justify-center items-center relative transition-colors border border-transparent group/sub"
                                  :class="[
                                    isLyricsSlotSilence(measure, state.index, null)
                                      ? 'cursor-default opacity-40 bg-gray-100/50'
                                      : 'cursor-pointer hover:bg-violet-50/40 rounded-lg',
                                    !isLyricsSlotSilence(measure, state.index, null) && isSlotSelectedForSyllable(measure, state.index, null)
                                      ? 'ring-2 ring-violet-500 bg-violet-50/20'
                                      : '',
                                    !isLyricsSlotSilence(measure, state.index, null) && activeSyllableSelection && activeSyllableSelection.measureIndex === measure.originalMeasureIndex
                                      ? 'ring-1 ring-dashed ring-violet-400/50 bg-violet-500/[0.02] hover:bg-violet-500/10'
                                      : ''
                                  ]"
                                  @click.stop="!isLyricsSlotSilence(measure, state.index, null) && assignSyllableToSlot(measure, state.index, null)"
                                >
                                  <div class="text-[12px] font-sans py-1 text-center w-full flex items-center justify-center gap-1">
                                    <span v-if="getSyllableAtSlot(measure, state.index, null)" class="font-bold text-gray-800 flex items-center gap-0.5">
                                      {{ getSyllableAtSlot(measure, state.index, null).text }}
                                      <span v-if="getSyllableAtSlot(measure, state.index, null).tied" class="text-violet-500 font-mono">~</span>
                                    </span>
                                    <span v-else-if="isLyricsSlotSilence(measure, state.index, null)" class="text-[10px] text-gray-400 font-mono">𝄾</span>
                                    <span v-else class="text-[9px] text-gray-300 opacity-20">.</span>

                                    <!-- Tie toggle button (Absolutely positioned on top-right, visible on hover or when tied) -->
                                    <button
                                      v-if="!isLyricsSlotSilence(measure, state.index, null) && getSyllableAtSlot(measure, state.index, null) && getSyllableAtSlot(measure, state.index, null).isRoot"
                                      @click.stop="toggleLyricsTieSlot(`lyrics_${measure.originalMeasureIndex}_${state.index}`)"
                                      class="absolute top-0.5 right-0.5 text-[8px] w-3 h-3 flex items-center justify-center rounded bg-gray-100 hover:bg-violet-200 text-gray-400 hover:text-violet-750 transition-all font-bold opacity-0 group-hover/sub:opacity-100 z-10"
                                      :class="{ 'bg-violet-100 text-violet-750 !opacity-100 border border-violet-200': isLyricsNextSlotTied(`lyrics_${measure.originalMeasureIndex}_${state.index}`) }"
                                      title="Ligar a la siguiente figura"
                                    >
                                      ~
                                    </button>
                                  </div>
                                </div>
                              </template>
                              <!-- Subdivided beat slots -->
                              <template v-else>
                                <div class="flex-1 flex divide-x divide-gray-150 bg-gray-50/20 rounded-lg overflow-hidden border border-gray-100">
                                  <div
                                    v-for="sub in getLyricsVisibleSlotsForRender(measure, state.beat, state.index)"
                                    :key="sub.originalIndex"
                                    :style="{ flexGrow: sub.flexGrow }"
                                    class="h-full flex flex-col items-center justify-center relative transition-colors group/sub"
                                    :class="[
                                      isLyricsSlotSilence(measure, state.index, sub.originalIndex)
                                        ? 'cursor-default opacity-40 bg-gray-100/30'
                                        : 'cursor-pointer hover:bg-violet-50/40',
                                      !isLyricsSlotSilence(measure, state.index, sub.originalIndex) && isSlotSelectedForSyllable(measure, state.index, sub.originalIndex)
                                        ? 'ring-2 ring-violet-500 bg-violet-50/20'
                                        : '',
                                      !isLyricsSlotSilence(measure, state.index, sub.originalIndex) && activeSyllableSelection && activeSyllableSelection.measureIndex === measure.originalMeasureIndex
                                        ? 'ring-1 ring-dashed ring-violet-400/50 bg-violet-500/[0.02] hover:bg-violet-500/10'
                                        : ''
                                    ]"
                                    @click.stop="!isLyricsSlotSilence(measure, state.index, sub.originalIndex) && assignSyllableToSlot(measure, state.index, sub.originalIndex)"
                                  >
                                    <div class="text-[11px] font-sans py-1 text-center w-full flex items-center justify-center gap-1">
                                      <span v-if="getSyllableAtSlot(measure, state.index, sub.originalIndex)" class="font-bold text-gray-800 flex items-center gap-0.5">
                                        {{ getSyllableAtSlot(measure, state.index, sub.originalIndex).text }}
                                        <span v-if="getSyllableAtSlot(measure, state.index, sub.originalIndex).tied" class="text-violet-500 font-mono">~</span>
                                      </span>
                                      <span v-else-if="isLyricsSlotSilence(measure, state.index, sub.originalIndex)" class="text-[9px] text-gray-400 font-mono">𝄾</span>
                                      <span v-else class="text-[9px] text-gray-300 opacity-20">.</span>

                                      <!-- Tie toggle button (Absolutely positioned on top-right, visible on hover or when tied) -->
                                      <button
                                        v-if="!isLyricsSlotSilence(measure, state.index, sub.originalIndex) && getSyllableAtSlot(measure, state.index, sub.originalIndex) && getSyllableAtSlot(measure, state.index, sub.originalIndex).isRoot"
                                        @click.stop="toggleLyricsTieSlot(`lyrics_${measure.originalMeasureIndex}_${state.index}_${sub.originalIndex}`)"
                                        class="absolute top-0.5 right-0.5 text-[8px] w-3 h-3 flex items-center justify-center rounded bg-gray-100 hover:bg-violet-200 text-gray-400 hover:text-violet-750 transition-all font-bold opacity-0 group-hover/sub:opacity-100 z-10"
                                        :class="{ 'bg-violet-100 text-violet-750 !opacity-100 border border-violet-200': isLyricsNextSlotTied(`lyrics_${measure.originalMeasureIndex}_${state.index}_${sub.originalIndex}`) }"
                                        title="Ligar a la siguiente figura"
                                      >
                                        ~
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </template>
                            </div>
                          </template>
                        </div>
                        <!-- Editable text area shown when editing -->
                        <div
                          v-if="showLyricsGlobal || measure.originalMeasureIndex === activeEditingLyricsIndex"
                          class="grid w-full min-h-[48px] border-b border-gray-200"
                        >
                          <!-- Auto-grow hidden span -->
                          <span class="lyric-span select-none invisible col-start-1 row-start-1 whitespace-pre-wrap break-words leading-relaxed text-gray-800 font-sans text-[13px]" style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;">{{ measure.lyrics?.rawText || ' ' }}</span>
                          <!-- Textarea -->
                          <textarea
                            :id="'lyrics-textarea-' + measure.originalMeasureIndex"
                            v-model="measure.lyrics.rawText"
                            placeholder="Escribe la letra..."
                            class="lyric-textarea col-start-1 row-start-1 w-full h-full resize-none bg-transparent outline-none leading-relaxed text-gray-800 font-sans border-0 shadow-none focus:ring-0 focus:outline-none text-[13px]"
                            style="grid-area: 1 / 1 / 2 / 2; letter-spacing: 0.02em; padding: 8px 12px;"
                            @keydown="handleLyricsKeydown($event, measure.originalMeasureIndex)"
                            @focus="activeEditingLyricsIndex = measure.originalMeasureIndex"
                            @blur="activeEditingLyricsIndex = null"
                          ></textarea>
                        </div>

                        <!-- Syllable Assign Panel (only when editing) -->
                        <div
                          v-if="(showLyricsGlobal || measure.originalMeasureIndex === activeEditingLyricsIndex) && measure.lyrics?.syllables"
                          class="flex flex-col gap-2 p-3 bg-violet-50/40 border-b border-violet-100/50"
                        >
                          <!-- Suggestions / Question Banner -->
                          <div
                            v-if="measure.lyrics.syllableSuggestion && !measure.lyrics.ignoreSuggestion && !hasHyphensOrCommas(measure.lyrics.rawText)"
                            class="flex flex-col gap-2 bg-violet-50 border border-violet-200 rounded-xl p-3 text-[12px] text-violet-950 shadow-sm animate-scale-up mb-2 font-sans w-full"
                          >
                            <div class="flex items-start gap-2">
                              <span class="text-base">💡</span>
                              <div class="flex-1">
                                <div class="font-bold text-violet-900 mb-0.5">¿Cómo quieres dividir las sílabas para el ritmo?</div>
                                <div>Hemos detectado texto sin división. ¿Asignamos la división automática de sílabas sugerida o prefieres asignarlo manualmente escribiendo tus propios guiones?</div>
                                <div class="mt-1.5 font-mono bg-white/60 border border-violet-100 rounded px-2 py-1 text-violet-800 text-[11px] inline-block">
                                  Sugerencia: <strong>{{ measure.lyrics.syllableSuggestion }}</strong>
                                </div>
                              </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-1 font-sans font-bold self-end">
                              <button
                                @click.stop="applySyllableSuggestion(measure)"
                                class="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded-lg shadow-sm transition-colors text-[11px]"
                              >
                                Sí, aplicar a este compás
                              </button>
                              <button
                                @click.stop="applySyllableSuggestionToAllMeasures()"
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg shadow-sm transition-colors text-[11px]"
                              >
                                Aplicar a toda la letra (todos los compases)
                              </button>
                              <button
                                @click.stop="measure.lyrics.ignoreSuggestion = true"
                                class="text-gray-500 hover:text-gray-700 hover:bg-gray-150 px-3 py-1 rounded-lg border border-gray-200 bg-white transition-colors text-[11px]"
                              >
                                Asignar manualmente
                              </button>
                            </div>
                          </div>


                          <!-- Syllable Pills List -->
                          <div class="flex flex-wrap items-center gap-1.5 w-full">
                            <div
                              v-for="syl in measure.lyrics.syllables"
                              :key="syl.id"
                              class="relative flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer select-none"
                              :class="[
                                activeSyllableSelection?.syllableId === syl.id
                                  ? 'bg-violet-600 text-white shadow-md shadow-violet-200 ring-2 ring-violet-300'
                                  : (syl.rhythmEventId
                                      ? 'bg-violet-100 text-violet-850 hover:bg-violet-200 border border-violet-200/50'
                                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300')
                              ]"
                              @click.stop="selectSyllablePill(measure, syl)"
                            >
                              <span>{{ syl.text }}</span>
                              <span v-if="syl.rhythmEventId" class="text-[9px] opacity-75 font-mono">
                                ({{ getSyllableSlotDisplayLabel(measure, syl.rhythmEventId) }})
                              </span>
                              <button
                                v-if="syl.rhythmEventId"
                                @click.stop="clearSyllableAssignment(measure, syl)"
                                class="text-[10px] opacity-60 hover:opacity-100 ml-1 hover:text-red-500 transition-colors"
                                title="Desvincular"
                              >
                                ✕
                              </button>
                            </div>

                            <div
                              v-if="(measure.lyrics.rawText && (measure.lyrics.rawText.includes('-') || measure.lyrics.ignoreSuggestion)) || (measure.lyrics.syllables && measure.lyrics.syllables.some(s => s.rhythmEventId))"
                              class="flex items-center gap-2 ml-auto"
                            >
                              <button
                                v-if="measure.lyrics.rawText && (measure.lyrics.rawText.includes('-') || measure.lyrics.ignoreSuggestion)"
                                @click.stop="resetLyricsSyllables(measure)"
                                class="text-[11px] text-violet-600 hover:text-violet-800 font-bold px-2 py-1 rounded hover:bg-violet-50 transition-colors"
                                title="Recomponer el texto quitando guiones para volver a subdividirlo o asignarlo libremente"
                              >
                                Recomponer texto (quitar guiones)
                              </button>

                              <button
                                v-if="measure.lyrics.syllables && measure.lyrics.syllables.some(s => s.rhythmEventId)"
                                @click.stop="clearAllSyllableAssignments(measure)"
                                class="text-[11px] text-gray-500 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors animate-scale-up"
                              >
                                Limpiar todo
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Sutil Hint button (if hidden but hovered) -->
                    <button
                      v-else-if="hoveredMeasureIndex === measure.originalMeasureIndex"
                      @click.stop="activateLyricsForMeasure(measure.originalMeasureIndex)"
                      class="w-full min-h-[38px] flex items-center justify-center border border-dashed border-gray-300 rounded-full hover:border-[#8EE000] hover:bg-[#8EE000]/5 text-gray-400 hover:text-[#6CA600] transition-all text-xs font-semibold cursor-pointer py-2"
                    >
                      + Letra
                    </button>

                    <!-- Default invisible spacing block to preserve alignment -->
                    <div v-else class="w-full min-h-[38px] opacity-0 pointer-events-none"></div>
                  </div>
                </template>

                <!-- Spacer for ADD MEASURE BUTTON -->
                <div
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && (currentPlan === 'PRO' || measures.length < 20) && !shouldShowLyricsRow(system)"
                  class="flex-shrink-0"
                  :style="getAddButtonFlexStyle()"
                ></div>
                <!-- Spacer for Promocional button -->
                <div
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && currentPlan === 'FREE' && measures.length >= 20 && !shouldShowLyricsRow(system)"
                  class="flex-shrink-0"
                  :style="getAddButtonFlexStyle()"
                ></div>
              </div>

              <!-- ADD MEASURE BUTTON BELOW LYRICS (Only on last system, when lyrics are shown) -->
              <div
                v-if="viewMode === 'compact' && sIdx === systems.length - 1 && shouldShowLyricsRow(system)"
                class="w-full mt-3 flex justify-center"
              >
                <!-- Botón de agregar compás normal -->
                <button
                  v-if="currentPlan === 'PRO' || measures.length < 20"
                  @click="addMeasure"
                  class="h-16 w-full border-2 border-dashed border-gray-300 bg-white/50 rounded-xl text-gray-400 flex items-center justify-center hover:bg-[#8EE000]/5 hover:border-[#8EE000] hover:text-[#6CA600] transition-all group shadow-sm cursor-pointer animate-scale-up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:scale-110 transition-transform text-gray-400 hover:text-[#6CA600]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <!-- Botón promocional si llega al límite (versión FREE) -->
                <button
                  v-else
                  @click="upgradeReason = 'limit'; isUpgradeModalOpen = true"
                  class="h-20 w-full border-2 border-dashed border-violet-300 bg-violet-50/20 rounded-xl text-violet-500 flex flex-col gap-1 items-center justify-center hover:bg-violet-50/50 hover:border-violet-400 hover:text-violet-600 transition-all group px-4 text-center cursor-pointer shadow-sm animate-scale-up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:scale-110 transition-transform mb-0.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span class="text-xs font-black">20 compases max en FREE</span>
                  <span class="text-[10px] text-violet-600 font-bold">Límite de creación alcanzado</span>
                </button>
              </div>
            </div>
</template>
