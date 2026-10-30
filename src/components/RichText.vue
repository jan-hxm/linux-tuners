<script setup>
/**
 * Renders a prose string from a data file (about.js) with a tiny inline
 * markup: `code`, **bold** and [label](https://url). It builds nodes from
 * parsed segments rather than HTML, so text is always escaped (Design.md §10,
 * no HTML sinks). Links must be absolute https URLs written in the data file.
 */
import { computed } from 'vue'
import { parseRichText } from './richText.js'

const props = defineProps({
  text: { type: String, required: true },
  /** Classes for inline code; the dark hero needs a different look. */
  codeClass: { type: String, default: 'font-mono' },
})

const segments = computed(() => parseRichText(props.text))
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i">
    <code v-if="seg.type === 'code'" :class="codeClass">{{ seg.text }}</code>
    <strong v-else-if="seg.type === 'bold'">{{ seg.text }}</strong>
    <a
      v-else-if="seg.type === 'link'"
      :href="seg.href"
      class="text-sky-700 underline"
      target="_blank"
      rel="noopener"
    >{{ seg.text }} ↗</a>
    <template v-else>{{ seg.text }}</template>
  </template>
</template>
