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
  <div class="mt-3 flex items-center gap-3">
    <button
      type="button"
      role="switch"
      :aria-checked="value === 1"
      :aria-labelledby="labelId"
      class="relative h-5 w-9 rounded-full transition"
      :class="value === 1 ? (def.toggleDanger ? 'bg-red-600' : 'bg-emerald-600') : 'bg-slate-300'"
      @click="emit('update', value === 1 ? 0 : 1)"
    >
      <span
        class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
        :class="value === 1 ? 'left-[18px]' : 'left-0.5'"
      />
    </button>
    <span class="text-xs text-slate-600">
      {{ value === 1 ? (def.toggleLabels?.on ?? 'enabled') : (def.toggleLabels?.off ?? 'disabled') }}
    </span>
  </div>
</template>
