<script setup>
import { computed } from 'vue'

/**
 * A labelled number input paired with a row of quick-pick chips, used by
 * ProfileForm for every `number` profile field (Total RAM, swap size, CPU
 * cores, kernel.pid_max). Two-way bound via v-model; the form snaps and clamps
 * on apply.
 *
 * Below `sm` the picks are a select instead, since a dozen chips wrap into
 * rows that push the tune step down on a phone.
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

/** The pick the value matches, as the select's value, or '' for none. */
const pickedValue = computed(() => {
  const pick = normalizedPicks.value.find((p) => p.value === Number(props.modelValue))
  return pick && props.modelValue !== '' ? String(pick.value) : ''
})

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
      <select
        v-if="normalizedPicks.length"
        :value="pickedValue"
        :aria-label="`${label}: common values`"
        class="min-h-6 max-w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm sm:hidden"
        @change="$event.target.value !== '' && set($event.target.value)"
      >
        <option value="" disabled>Common values</option>
        <option v-for="pick in normalizedPicks" :key="pick.value" :value="String(pick.value)">{{ pick.label }}</option>
      </select>
      <button
        v-for="pick in normalizedPicks"
        :key="pick.value"
        type="button"
        class="hidden min-h-6 rounded-full border px-3 py-0.5 text-xs sm:inline-block"
        :class="Number(modelValue) === pick.value ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 hover:bg-slate-50'"
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
