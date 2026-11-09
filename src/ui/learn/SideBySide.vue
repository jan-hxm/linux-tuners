<script setup>
/**
 * Side by side (Design.md §5 "Learning pages > Figures"): one row per state,
 * each a row of `cells` squares under the state's label and the setting
 * that gives it. The lit cells run from `start`; the one the request was
 * for (`asked`) is filled `ink`, the others lit are filled `fit`, and the
 * rest are empty `rule-strong` outlines, so lit and unlit differ in fill
 * and lightness, not in outline alone. A small legend names the three, in
 * the figure's own words (`legend`) or "lit" and "not lit". The squares
 * wrap on a phone. The line under it names the VM test or probe that checks
 * the behaviour on real kernels. One image, named from the data.
 */
import { computed } from 'vue'
import { backedByText, cellCounts, cellKinds, settingText, sideBySideLabel, sideBySideLegend } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'sideBySide' */
  figure: { type: Object, required: true },
  /** Unused: side by side shows settings, not captures. Every figure takes the same props. */
  evidence: { type: Function, default: null },
  imageId: { type: String, default: '' },
  sameOn: { type: Number, default: 0 },
  highlight: { type: String, default: null },
  selectedKey: { type: String, default: null },
  /** Def lookup for the settings' names. */
  defsByKey: { type: Object, default: () => ({}) },
})
defineEmits(['select'])

const label = computed(() => sideBySideLabel(props.figure, props.defsByKey))
const legend = computed(() => sideBySideLegend(props.figure))
const hasAsked = computed(() => props.figure.states.some((s) => s.asked !== undefined))
const backed = computed(() => backedByText(props.figure.backedBy))
const caption = computed(() => [`${props.figure.title}.`, backed.value].filter(Boolean).join(' '))

const CELL = { asked: 'bg-ink', lit: 'bg-fit', off: 'border border-rule-strong bg-paper' }
</script>

<template>
  <div>
    <div role="img" :aria-label="label" data-figure="sideBySide">
      <div aria-hidden="true">
        <ul class="m-0 list-none border-t border-ink p-0">
          <li v-for="state in figure.states" :key="state.label" class="border-b border-rule py-3" :data-state="state.label">
            <p class="m-0 flex flex-wrap items-baseline gap-x-3 text-[15px] leading-snug">
              <span class="font-medium text-ink">{{ state.label }}</span>
              <span class="font-mono text-[13px] text-ink-2">{{ settingText(state.setting, defsByKey) }}</span>
              <span class="text-[13px] text-ink-2">{{ cellCounts(state, legend) }}</span>
            </p>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="(kind, i) in cellKinds(state)" :key="i" class="size-6" :class="CELL[kind]" :data-cell="kind" />
            </div>
          </li>
        </ul>
        <p class="m-0 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2" data-legend>
          <span v-if="hasAsked" class="inline-flex items-center gap-1.5"><span class="inline-block size-3 bg-ink" />{{ legend.asked }}</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block size-3 bg-fit" />{{ legend.lit }}</span>
          <span class="inline-flex items-center gap-1.5"><span class="inline-block size-3 border border-rule-strong bg-paper" />{{ legend.off }}</span>
        </p>
      </div>
    </div>
    <p class="m-0 mt-2 text-[13px] text-ink-2">{{ caption }}</p>
  </div>
</template>
