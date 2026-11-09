<script setup>
/**
 * Side by side (Design.md §5 "Learning pages > Figures"): one row per state,
 * each a row of `cells` squares of which the first `lit` are lit, the first
 * of them dark `fit` (the one asked for) and the rest light `fit-tint` with
 * a `fit` edge (the ones that came along), under the state's label and the
 * setting that gives it. The squares wrap on a phone. The line under it
 * names the VM test or probe that checks the behaviour on real kernels.
 * One image, named from the data.
 */
import { computed } from 'vue'
import { backedByText, settingText, sideBySideLabel } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'sideBySide' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId); unused, side by side shows settings, not captures */
  evidence: { type: Function, default: null },
  imageId: { type: String, default: '' },
  /** Def lookup for the settings' names. */
  defsByKey: { type: Object, default: () => ({}) },
})

const label = computed(() => sideBySideLabel(props.figure, props.defsByKey))
const backed = computed(() => backedByText(props.figure.backedBy))
const caption = computed(() => [`${props.figure.title}.`, backed.value].filter(Boolean).join(' '))

function cellClass(i, lit) {
  if (i === 0 && lit > 0) return 'border-fit bg-fit'
  if (i < lit) return 'border-fit bg-fit-tint'
  return 'border-rule-strong bg-paper'
}
</script>

<template>
  <div>
    <div role="img" :aria-label="label" data-figure="sideBySide">
      <ul aria-hidden="true" class="m-0 list-none border-t border-ink p-0">
        <li v-for="state in figure.states" :key="state.label" class="border-b border-rule py-3" :data-state="state.label">
          <p class="m-0 flex flex-wrap items-baseline gap-x-3 text-[15px] leading-snug">
            <span class="font-medium text-ink">{{ state.label }}</span>
            <span class="font-mono text-[13px] text-ink-2">{{ settingText(state.setting, defsByKey) }}</span>
            <span class="text-[13px] text-quiet">{{ state.lit }} of {{ state.cells }}</span>
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span v-for="i in state.cells" :key="i" class="size-5 border" :class="cellClass(i - 1, state.lit)" :data-cell="i - 1 < state.lit ? 'lit' : 'off'" />
          </div>
        </li>
      </ul>
    </div>
    <p class="m-0 mt-2 text-[13px] text-quiet">{{ caption }}</p>
  </div>
</template>
