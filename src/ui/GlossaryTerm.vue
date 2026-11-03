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
    <button
      type="button"
      class="rounded-sm underline decoration-sky-700 decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600"
      :class="open ? 'bg-sky-50 text-sky-900' : ''"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
      @keydown.esc="onEscape"
    >{{ text }}</button>
    <span
      v-show="open"
      :id="panelId"
      class="my-1 block rounded border-l-2 border-sky-600 bg-sky-50 px-2 py-1 font-normal text-sky-900"
    ><strong class="font-semibold">{{ entry.term }}:</strong> {{ entry.definition }}</span>
  </template>
  <template v-else>{{ text }}</template>
</template>
