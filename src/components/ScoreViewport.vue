<script setup>
import {computed,ref,onMounted,onBeforeUnmount,nextTick,watch} from 'vue'
const props = defineProps({system:{type:Object,required:true},context:{type:Object,required:true},index:Number,virtual:Boolean})
const emit = defineEmits(['register','visibility-change'])
const host = ref(null)
const nearViewport = ref(props.index < 2)
const retainedForFocus = ref(false)
const measuredHeight = ref(0)
// Track activity here so advancing playback does not rerender the editor's full list.
const pinned = computed(() => props.context.isSystemPinned(props.system))
const rendered = computed(() => !props.virtual || pinned.value || retainedForFocus.value || nearViewport.value)
const estimatedHeight = computed(() => {
  const showLyrics = props.context.showLyricsGlobal.value || props.system.measures.some(m => m.lyrics?.rawText?.trim())
  if (!showLyrics) return 150
  return props.system.measures.some(m => m.lyrics?.mode === 'rhythm') ? 360 : 240
})
let intersectionObserver,resizeObserver,releaseTimer
const observeSize = () => {
  resizeObserver?.disconnect()
  if (!rendered.value || !host.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(entries => {
    const height = entries[0]?.contentRect.height
    if (height > 0) measuredHeight.value = height
  })
  resizeObserver.observe(host.value)
}
const reveal = async () => {
  retainedForFocus.value = true
  await nextTick()
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    retainedForFocus.value = host.value?.contains(document.activeElement) || false
  },2000)
}
const retainFocus = () => {retainedForFocus.value = true}
const releaseFocus = () => {
  nextTick(() => {retainedForFocus.value = host.value?.contains(document.activeElement) || false})
}
watch(rendered,async () => {await nextTick();observeSize();emit('visibility-change')})
watch(() => props.system.measures.length,() => {measuredHeight.value = 0})
onMounted(() => {
  emit('register',props.system.id,{reveal,element:host.value})
  if (typeof IntersectionObserver === 'undefined') nearViewport.value = true
  else {
    intersectionObserver = new IntersectionObserver(entries => {
      nearViewport.value = entries[0].isIntersecting
    },{root:host.value.closest('main'),rootMargin:'1200px 0px'})
    intersectionObserver.observe(host.value)
  }
  observeSize()
})
onBeforeUnmount(() => {
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  clearTimeout(releaseTimer)
  emit('register',props.system.id,null)
})
</script>
<template>
  <div ref="host" :data-score-system="system.id" :data-score-mounted="rendered" class="w-full relative" :style="rendered ? undefined : {height: `${measuredHeight || estimatedHeight}px`}" @focusin="retainFocus" @focusout="releaseFocus">
    <slot v-if="rendered" />
  </div>
</template>
