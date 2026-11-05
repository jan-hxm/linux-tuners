<script setup>
import { computed } from 'vue'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  labelId: { type: String, required: true },
  range: { type: Object, default: null },
  // Part of the shared control contract; unused here.
  valueText: { type: String, default: '' },
  fitValue: { type: Number, default: null },
  changed: { type: Boolean, default: false },
})
const emit = defineEmits(['update'])

// Segment i stands for value i. Only the values in range are offered, so a
// profile can narrow the choice (e.g. an older kernel that lacks one mode).
const segments = computed(() =>
  props.def.segmentLabels
    .map((label, value) => ({ label, value }))
    .filter(({ value }) => !props.range || (value >= props.range.min && value <= props.range.max)),
)
</script>

<template>
  <!-- Square and hairline: the 1px gaps over the rule-strong background draw
       the dividers. Wraps onto more rows when the segments are wider than the
       card (phones), and the segments grow so a short row leaves no gap.
       Nothing clips, so the focused segment lifts above its neighbours and
       keeps the global focus ring outside it. -->
  <div
    role="radiogroup"
    :aria-labelledby="labelId"
    class="mt-4 flex w-fit max-w-full flex-wrap gap-px border border-rule-strong bg-rule-strong"
  >
    <button
      v-for="seg in segments"
      :key="seg.value"
      type="button"
      role="radio"
      :aria-checked="value === seg.value"
      class="min-h-11 flex-auto px-3.5 text-sm focus-visible:relative focus-visible:z-10"
      :class="value === seg.value ? 'bg-ink font-medium text-paper' : 'bg-paper text-ink hover:bg-paper-hover'"
      @click="emit('update', seg.value)"
    >
      {{ seg.label }}
    </button>
  </div>
</template>
