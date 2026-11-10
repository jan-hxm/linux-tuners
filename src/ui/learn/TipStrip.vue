<script setup>
/**
 * The open tooltip of one figure, shown as a strip under it below `md`
 * (Design.md §5 "Learning pages > Figures"), where a floating box would
 * cover the figure on a phone. Hidden from `md` up, where FigureTip floats.
 * It repeats what the part's own description already gives a screen
 * reader, so it is `aria-hidden`.
 */
import { computed } from 'vue'
import TipWords from './TipWords.vue'
import { openTip } from './tipState.js'

const props = defineProps({
  /** The figure's scope, as its FigureTips name it. */
  scope: { type: String, required: true },
})

const tip = computed(() => (openTip.value && openTip.value.scope === props.scope ? openTip.value : null))
</script>

<template>
  <div v-if="tip" aria-hidden="true" class="mt-3 border-l-2 border-ink bg-paper-hover px-3 py-2 text-[15px] leading-snug text-ink md:hidden" data-tip-strip>
    <span class="font-medium">{{ tip.label }}.</span>
    <template v-if="tip.tip">{{ ' ' }}<TipWords :text="tip.tip" /></template>
    <span v-if="tip.value" class="mt-1 block font-mono text-[13px] text-ink-2">{{ tip.value }}</span>
  </div>
</template>
