<script setup>
import {computed} from 'vue'
import CloudWorkspace from './CloudWorkspace.vue'

const props=defineProps({context:{type:Object,required:true},generation:Number})
const emit=defineEmits(['load','clear-account'])
// Read the snapshot here: ordinary edits must not subscribe the whole score's
// parent render to cloud-document changes. Account/save behavior stays in place.
const projectDocument=computed(()=>props.context.document.value)
</script>
<template>
  <CloudWorkspace :document="projectDocument" :generation="generation"
    @load="emit('load',$event)" @clear-account="emit('clear-account')" />
</template>
