<script setup>
/**
 * A tip's sentence (a part's `does`) as text: code spans and bold only.
 * A tooltip never holds a link or a control, so a link or glossary mark
 * (which the guide contract refuses in a tip anyway) shows as its words.
 */
import { computed } from 'vue'
import { parseRichText } from '@/ui/richText.js'

const props = defineProps({ text: { type: String, default: '' } })
const segments = computed(() => parseRichText(props.text))
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i">
    <code v-if="seg.type === 'code'" class="font-mono">{{ seg.text }}</code>
    <strong v-else-if="seg.type === 'bold'" class="font-semibold">{{ seg.text }}</strong>
    <template v-else>{{ seg.text }}</template>
  </template>
</template>
