<script setup>
defineProps({
  def: { type: Object, required: true },
  value: { type: String, required: true },
  labelId: { type: String, required: true },
  // Part of the shared control contract; unused here.
  range: { type: Object, default: null },
  valueText: { type: String, default: '' },
})
const emit = defineEmits(['update'])
</script>

<template>
  <div class="mt-3">
    <!-- Options come from def.options, so the store's enum restore/clamp still decides what's valid. -->
    <select
      :value="value"
      :aria-labelledby="labelId"
      class="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
      @change="emit('update', $event.target.value)"
    >
      <option v-for="opt in def.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </div>
</template>
