<script setup>
import {ref,onMounted,onUnmounted} from 'vue'
defineProps({message:{type:String,required:true}})
const emit=defineEmits(['close'])
const closeButton=ref(null)
let previousFocus
onMounted(()=>{previousFocus=document.activeElement;closeButton.value?.focus()})
onUnmounted(()=>{if(previousFocus?.isConnected)previousFocus.focus()})
const handleKey=(event)=>{
  if(event.key==='Escape'){event.preventDefault();emit('close')}
  if(event.key==='Tab'){event.preventDefault();closeButton.value?.focus()}
}
</script>
<template>
  <div role="dialog" aria-modal="true" aria-label="Aviso" @keydown="handleKey" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
    <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
      <p class="text-sm text-gray-700">{{ message }}</p>
      <button ref="closeButton" @click="emit('close')" class="mt-4 px-4 py-2 bg-[#8EE000] rounded-xl font-bold">Entendido</button>
    </div>
  </div>
</template>
