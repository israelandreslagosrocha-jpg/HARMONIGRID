<script setup>
import {computed} from 'vue'
import {formatChord} from '../core/chords.js'
const props = defineProps({measures: {type:Array,required:true}, playback: {type:Object,required:true}, selected: Number, canAdd:Boolean})
const emit = defineEmits(['open','add'])
const playingIndex = computed(() => props.playback.isPlaying.value ? props.playback.measure.value : null)
const chordLabels = measure => (measure.beats || []).flatMap(beat => {
  const parts = beat.subdivisions?.length ? beat.subdivisions : [beat]
  return parts.filter(part => part.root).map(part => formatChord(part))
})
</script>
<template>
  <section aria-label="Vista general de compases" class="mobile-score-overview">
    <p class="overview-hint">Toca un compás para editarlo ampliado.</p>
    <div class="overview-grid">
      <button v-for="measure in measures" :key="measure.id" type="button"
        class="overview-measure" :class="{'overview-playing':playingIndex === measure.displayedMeasureIndex, 'overview-selected':selected === measure.displayedMeasureIndex}"
        :aria-label="'Editar compás ' + (measure.originalMeasureIndex + 1) + (chordLabels(measure).length ? ': ' + chordLabels(measure).join(', ') : ', vacío')"
        @click="emit('open',measure.displayedMeasureIndex)">
        <span class="overview-number">{{ measure.originalMeasureIndex + 1 }}<span v-if="measure.sectionLabel && measure.sectionLabel !== 'Ninguna'"> · {{ measure.sectionLabel }}</span><span v-if="measure.isExpandedCopy"> · repetición</span></span>
        <span class="overview-chords">{{ chordLabels(measure).join(' · ') || 'Sin acordes' }}</span>
        <span class="overview-pulses" aria-hidden="true"><span v-for="(_,index) in measure.beats" :key="index">╱</span></span>
        <span v-if="measure.lyrics?.rawText" class="overview-lyrics">{{ measure.lyrics.rawText }}</span>
      </button>
      <button v-if="canAdd" type="button" class="overview-add" @click="emit('add')">＋ Añadir compás</button>
    </div>
  </section>
</template>
<style scoped>
.overview-hint {font-size:13px;color:#4b5563;margin:0 0 12px}
.overview-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.overview-measure {min-height:104px;padding:10px;text-align:left;background:white;border:1px solid #cbd5e1;border-radius:10px;min-width:0;display:flex;flex-direction:column;gap:8px;color:#111827}
.overview-number {font-size:12px;font-weight:600;color:#475569}
.overview-chords {font-size:14px;font-weight:700;overflow-wrap:anywhere;line-height:1.3}
.overview-pulses {display:flex;justify-content:space-around;border-top:1px solid #cbd5e1;margin-top:4px;font-size:18px;line-height:12px;color:#64748b}
.overview-lyrics {font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475569}
.overview-selected {border-color:#6ca600;box-shadow:inset 0 0 0 1px #6ca600}
.overview-playing {background:#efffcf;border-color:#6ca600}
.overview-add {min-height:104px;border:1px dashed #6ca600;border-radius:10px;color:#365900;background:#f5ffe5;font-size:14px;font-weight:600}
button:focus-visible {outline:3px solid #6d28d9;outline-offset:2px}
@media (min-width:560px) {.overview-grid {grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
