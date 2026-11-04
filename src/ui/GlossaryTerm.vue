<script setup>
/**
 * A glossary term in running text (`[[label|id]]`, ui/richText.js). The label
 * is a real button; pressing it shows the definition from ui/glossary.js on
 * its own line right below, and pressing it again (or Escape) hides it.
 * Inline rather than a tooltip or popover, so it works on touch, with a
 * keyboard and at phone width (Design.md §7). An unknown id renders as plain
 * text; the contract suite keeps the copy from having one.
 */
import { computed, ref, useId } from 'vue'
import { GLOSSARY } from './glossary.js'

const props = defineProps({
  text: { type: String, required: true },
  id: { type: String, required: true },
})

const entry = computed(() => (Object.hasOwn(GLOSSARY, props.id) ? GLOSSARY[props.id] : null))
const open = ref(false)
const panelId = useId()

function onEscape(event) {
  if (!open.value) return
  // Don't also close a drawer or dialog the term sits in.
  event.stopPropagation()
  open.value = false
}
</script>

<template>
  <template v-if="entry">
    <!-- A dotted ink-2 underline marks the term; solid while hovered or open.
         The definition reads like a margin note: a 2px rule on its left,
         15px text. The focus ring is the global one (main.css). -->
    <button
      type="button"
      class="underline decoration-ink-2 decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid"
      :class="{ 'decoration-solid': open }"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
      @keydown.esc="onEscape"
    >{{ text }}</button>
    <span
      v-show="open"
      :id="panelId"
      class="my-2 block border-l-2 border-ink py-1 pl-3 text-[15px] font-normal leading-[1.55] text-ink-2"
    ><strong class="font-medium text-ink">{{ entry.term }}:</strong> {{ entry.definition }}</span>
  </template>
  <template v-else>{{ text }}</template>
</template>
