<script setup>
import { computed } from 'vue'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: String, required: true },
  labelId: { type: String, required: true },
  range: { type: Object, default: null },
  // Part of the shared control contract; unused here.
  valueText: { type: String, default: '' },
})
const emit = defineEmits(['update'])

// A range with `options` narrows the list to what the profile allows.
const options = computed(() => props.def.options.filter((o) => !props.range?.options || props.range.options.includes(o.value)))
</script>

<template>
  <div class="mt-3">
    <!-- Options come from def.options (narrowed by the range), so the store's enum restore/clamp still decides what's valid. -->
    <select
      :value="value"
      :aria-labelledby="labelId"
      class="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
      @change="emit('update', $event.target.value)"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </div>
</template>
