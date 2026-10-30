<script setup>
defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  labelId: { type: String, required: true },
  // Part of the shared control contract; unused here.
  range: { type: Object, default: null },
  valueText: { type: String, default: '' },
})
const emit = defineEmits(['update'])
</script>

<template>
  <div
    role="radiogroup"
    :aria-labelledby="labelId"
    class="mt-3 inline-flex overflow-hidden rounded border border-slate-300"
  >
    <button
      v-for="(label, i) in def.segmentLabels"
      :key="i"
      type="button"
      role="radio"
      :aria-checked="value === i"
      class="px-3 py-1 text-xs"
      :class="value === i ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'"
      @click="emit('update', i)"
    >
      {{ label }}
    </button>
  </div>
</template>
