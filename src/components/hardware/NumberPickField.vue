<script setup>
import { computed } from 'vue'

/**
 * A labelled integer input paired with a row of quick-pick chips — the shared
 * building block for hardware/system-profile fields (Total RAM, swap size, CPU
 * cores, kernel.pid_max). Both forms use this so the inputs look and behave
 * identically. Two-way bound via v-model; the parent owns clamping on apply.
 *
 * Picks may be bare numbers or `{ value, label }` objects (see fieldOptions.js).
 * Rich help text can be passed through the `#help` slot; plain text via `help`.
 */
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [Number, String], default: '' },
  min: { type: Number, default: 0 },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
  picks: { type: Array, default: () => [] },
  help: { type: String, default: '' },
  id: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const fieldId = computed(
  () => props.id || `hwfield-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
)

const normalizedPicks = computed(() =>
  props.picks.map((p) => (typeof p === 'object' ? p : { value: p, label: String(p) })),
)

function set(value) {
  // Mirror v-model.number: a number when parseable, '' when the field is empty.
  emit('update:modelValue', value === '' ? '' : Number(value))
}
</script>

<template>
  <div>
    <label :for="fieldId" class="block text-sm font-medium text-slate-700">{{ label }}</label>
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <input
        :id="fieldId"
        :value="modelValue"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        class="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
        @input="set($event.target.value)"
      />
      <button
        v-for="pick in normalizedPicks"
        :key="pick.value"
        type="button"
        class="rounded-full border px-3 py-0.5 text-xs"
        :class="Number(modelValue) === pick.value ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 hover:bg-slate-50'"
        @click="set(pick.value)"
      >
        {{ pick.label }}
      </button>
    </div>
    <p v-if="help || $slots.help" class="mt-1 text-xs text-slate-500">
      <slot name="help">{{ help }}</slot>
    </p>
  </div>
</template>
