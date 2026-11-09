<script setup>
/**
 * A chapter's `choose` questions all at once, as a numbered list: the
 * question, how to check, and where Yes and No lead (Design.md §5 "Learning
 * pages > Figures"). The static form of the Chooser, for print; the same
 * words come from figureText.js, which the prerendered page uses too. The
 * hint and the answers are RichText (a `to` answer's value is a code span).
 */
import { answerText, noText } from './figureText.js'
import RichText from '@/ui/RichText.vue'

defineProps({
  /** chapter.choose: [{ q, check, hint, yes, no? }] */
  choose: { type: Array, required: true },
  defsByKey: { type: Object, default: () => ({}) },
})
</script>

<template>
  <ol class="m-0 list-none p-0 text-[15px] leading-[1.55]" data-flow>
    <li v-for="(item, i) in choose" :key="i" class="border-t border-rule py-3">
      <p class="m-0 font-medium text-ink"><span class="font-mono text-quiet">{{ i + 1 }}.</span> {{ item.q }}</p>
      <p class="m-0 text-ink-2">How to check: <code class="font-mono text-ink">{{ item.check }}</code> <span>(<RichText :text="item.hint" />)</span></p>
      <p class="m-0 text-ink-2"><span class="font-medium text-ink">Yes:</span> <RichText :text="answerText(item.yes, defsByKey)" /></p>
      <p class="m-0 text-ink-2"><span class="font-medium text-ink">No:</span> <RichText :text="noText(choose, i, defsByKey)" /></p>
    </li>
  </ol>
</template>
