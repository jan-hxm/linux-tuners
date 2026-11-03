<script setup>
// An on/off switch with its visible label, for the panel's own view settings
// (not a parameter's value: that is controls/ToggleControl.vue).
import { useId } from 'vue'

defineProps({
  checked: { type: Boolean, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:checked'])
const labelId = useId()
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-labelledby="labelId"
      :disabled="disabled"
      class="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50"
      :class="checked ? 'bg-emerald-600' : 'bg-slate-300'"
      @click="emit('update:checked', !checked)"
    >
      <span
        class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        :class="checked ? 'left-[22px]' : 'left-0.5'"
      />
    </button>
    <span :id="labelId" class="text-xs text-slate-600">{{ label }}</span>
  </div>
</template>
