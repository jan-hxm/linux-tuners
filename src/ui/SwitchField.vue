<script setup>
// An on/off switch with its visible label, for the panel's own view settings
// (not a parameter's value: that is controls/ToggleControl.vue, which this
// matches: square, h-6 w-11, on is an ink fill with the knob on the right).
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
  <div class="flex min-h-11 items-center gap-2.5" :class="{ 'opacity-50': disabled }">
    <button
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-labelledby="labelId"
      :disabled="disabled"
      class="relative h-6 w-11 shrink-0 border border-ink transition-colors"
      :class="checked ? 'bg-ink' : 'bg-paper'"
      @click="emit('update:checked', !checked)"
    >
      <span
        aria-hidden="true"
        class="absolute top-[3px] h-4 w-4 transition-all"
        :class="checked ? 'left-[23px] bg-paper' : 'left-[3px] bg-ink'"
      />
    </button>
    <span :id="labelId" class="text-sm text-ink-2">{{ label }}</span>
  </div>
</template>
