<script setup>
import { computed } from 'vue'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  labelId: { type: String, required: true },
  range: { type: Object, default: null },
  // Part of the shared control contract; unused here.
  valueText: { type: String, default: '' },
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
  <!-- Wraps onto more rows when the segments are wider than the card (phones);
       the 1px gaps over the slate background draw the dividers, and the
       segments grow so a short row leaves no gap. -->
  <div
    role="radiogroup"
    :aria-labelledby="labelId"
    class="mt-3 flex w-fit max-w-full flex-wrap gap-px overflow-hidden rounded border border-slate-300 bg-slate-300"
  >
    <button
      v-for="seg in segments"
      :key="seg.value"
      type="button"
      role="radio"
      :aria-checked="value === seg.value"
      class="flex-auto px-3 py-1 text-xs"
      :class="value === seg.value ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'"
      @click="emit('update', seg.value)"
    >
      {{ seg.label }}
    </button>
  </div>
</template>
