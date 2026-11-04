<script setup>
/**
 * Renders a prose string from a data file (about.js) with a tiny inline
 * markup: `code`, **bold**, [label](https://url) and glossary terms
 * ([[label]] or [[label|id]], shown by GlossaryTerm.vue). It builds nodes from
 * parsed segments rather than HTML, so text is always escaped (Design.md §10,
 * no HTML sinks). Links must be absolute https URLs written in the data file.
 */
import { computed } from 'vue'
import { parseRichText } from './richText.js'
import GlossaryTerm from './GlossaryTerm.vue'

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
    <strong v-else-if="seg.type === 'bold'" class="font-semibold">{{ seg.text }}</strong>
    <!-- Text links are ink, underlined 3px below the text (REDESIGN §3). -->
    <a
      v-else-if="seg.type === 'link'"
      :href="seg.href"
      class="underline underline-offset-[3px] hover:decoration-2"
      target="_blank"
      rel="noopener"
    >{{ seg.text }} ↗</a>
    <GlossaryTerm v-else-if="seg.type === 'term'" :text="seg.text" :id="seg.id" />
    <template v-else>{{ seg.text }}</template>
  </template>
</template>
