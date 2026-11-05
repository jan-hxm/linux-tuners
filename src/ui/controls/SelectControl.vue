<script setup>
import { computed } from 'vue'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: String, required: true },
  labelId: { type: String, required: true },
  range: { type: Object, default: null },
  // Part of the shared control contract; unused here.
  valueText: { type: String, default: '' },
  fitValue: { type: String, default: null },
  changed: { type: Boolean, default: false },
})
const emit = defineEmits(['update'])

// A range with `options` narrows the list to what the profile allows.
const options = computed(() => props.def.options.filter((o) => !props.range?.options || props.range.options.includes(o.value)))
</script>

<template>
  <div class="mt-4">
    <!-- max-w-full: a native select is as wide as its longest option, which is wider than a phone. -->
    <!-- Options come from def.options (narrowed by the range), so the store's enum restore/clamp still decides what's valid. -->
    <select
      :value="value"
      :aria-labelledby="labelId"
      class="min-h-11 max-w-full border border-rule-strong bg-paper px-3 font-mono text-sm text-ink hover:border-ink"
      @change="emit('update', $event.target.value)"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </div>
</template>
