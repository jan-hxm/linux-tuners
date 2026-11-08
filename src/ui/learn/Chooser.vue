<script setup>
/**
 * The interactive form of a chapter's `choose` (Design.md §5 "Learning pages
 * > Figures"): one question at a time with Yes and No buttons and how to
 * check it, then a result in `fit-tint` naming the setting and which way to
 * move it, with "Open it in the tuner" (when `tuneHref` gives a link) and
 * "Start over". A missing `no` goes on to the next question; past the last
 * one the result is to leave the settings alone. Each step is read out by a
 * polite live region; the Yes and No buttons stay in place between
 * questions, so focus stays on the one pressed, and on a result focus moves
 * to "Start over", which puts it back on Yes.
 */
import { computed, nextTick, ref } from 'vue'
import { answerText, chooseStep, defTitle } from './figureText.js'
import RichText from '@/ui/RichText.vue'
import { parseRichText } from '@/ui/richText.js'

/** What a reader sees of a RichText string, for the live region. */
const visibleText = (s) => parseRichText(s).map((seg) => seg.text).join('')

const props = defineProps({
  /** chapter.choose: [{ q, check, hint, yes, no? }] */
  choose: { type: Array, required: true },
  defsByKey: { type: Object, default: () => ({}) },
  /** key => href of the setting in its tuner, or null for no link. */
  tuneHref: { type: Function, default: null },
})

const index = ref(0)
const result = ref(null)
const message = ref('')
const yesButton = ref(null)
const startOver = ref(null)

const question = computed(() => props.choose[index.value])
const resultText = computed(() => (result.value ? answerText(result.value, props.defsByKey) : ''))
const resultTitle = computed(() => (result.value?.key ? defTitle(result.value.key, props.defsByKey) : ''))
const href = computed(() => (result.value?.key && props.tuneHref ? props.tuneHref(result.value.key) : null))

const questionText = () => `Question ${index.value + 1} of ${props.choose.length}: ${question.value.q}`

async function say(text) {
  // Empty first, so the same words as last time are read again.
  message.value = ''
  await nextTick()
  message.value = text
}

async function answer(yes) {
  const step = chooseStep(props.choose, index.value, yes)
  if (step.result) {
    result.value = step.result
    say(`Result: ${visibleText(resultText.value)}`)
    await nextTick()
    startOver.value?.focus()
  } else {
    index.value = step.next
    say(questionText())
  }
}

async function restart() {
  index.value = 0
  result.value = null
  say(questionText())
  await nextTick()
  yesButton.value?.focus()
}
</script>

<template>
  <div v-if="choose.length" data-chooser>
    <p class="sr-only" aria-live="polite">{{ message }}</p>
    <div v-if="!result" class="border-t border-ink py-3">
      <p class="m-0 text-[13px] text-quiet">Question {{ index + 1 }} of {{ choose.length }}</p>
      <p class="m-0 mt-1 text-[17px] font-medium leading-snug text-ink" data-question>{{ question.q }}</p>
      <p class="m-0 mt-2 text-[15px] leading-[1.55] text-ink-2">
        How to check: <code class="font-mono text-ink">{{ question.check }}</code> <span><RichText :text="question.hint" /></span>
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button ref="yesButton" type="button" class="min-h-11 border border-rule-strong px-5 text-[15px] font-medium text-ink hover:bg-paper-hover" @click="answer(true)">Yes</button>
        <button type="button" class="min-h-11 border border-rule-strong px-5 text-[15px] font-medium text-ink hover:bg-paper-hover" @click="answer(false)">No</button>
      </div>
    </div>
    <div v-else class="border-l-4 border-fit bg-fit-tint p-4" data-result>
      <p class="m-0 text-[13px] text-fit-text">Result</p>
      <p class="m-0 mt-1 text-[17px] font-medium leading-snug text-ink"><RichText :text="resultText" /></p>
      <p v-if="resultTitle" class="m-0 text-[15px] text-ink-2">{{ resultTitle }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-4">
        <a v-if="href" :href="href" class="inline-flex min-h-6 items-center text-[15px] text-ink underline underline-offset-[3px] hover:decoration-2">Open it in the tuner</a>
        <button ref="startOver" type="button" class="inline-flex min-h-6 items-center text-[15px] text-ink underline underline-offset-[3px] hover:decoration-2" @click="restart">Start over</button>
      </div>
    </div>
  </div>
</template>
