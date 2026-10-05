<script setup>
import {computed} from 'vue'
const props = defineProps({measureIndex: {type: Number, required: true}, state: {type: Object, required: true}})
const visible = computed(() => props.state.isPlaying.value && props.state.measure.value === props.measureIndex)
const position = computed(() => `${props.state.progress.value * 100}%`)
</script>
<template>
  <div v-if="visible" class="absolute top-0 bottom-0 w-[3px] bg-[#8EE000] z-40 pointer-events-none shadow-[0_0_8px_#8EE000]" :style="{left: position}" aria-hidden="true"></div>
</template>
