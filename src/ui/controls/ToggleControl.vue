<script setup>
defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  labelId: { type: String, required: true },
  // Part of the shared control contract; unused here.
  range: { type: Object, default: null },
  valueText: { type: String, default: '' },
  fitValue: { type: Number, default: null },
  changed: { type: Boolean, default: false },
})
const emit = defineEmits(['update'])
</script>

<template>
  <!-- A square switch (REDESIGN §3: no rounded corners), h-6 w-11 as
       Design.md §7 asks, in a 44px tall row. On is an ink fill with the knob
       on the right; a setting that is risky when on (def.toggleDanger) says
       so in its label, in the warning colour with a warning sign. -->
  <div class="mt-4 flex min-h-11 items-center gap-3">
    <button
      type="button"
      role="switch"
      :aria-checked="value === 1"
      :aria-labelledby="labelId"
      class="relative h-6 w-11 shrink-0 border border-ink transition-colors"
      :class="value === 1 ? 'bg-ink' : 'bg-paper'"
      @click="emit('update', value === 1 ? 0 : 1)"
    >
      <span
        aria-hidden="true"
        class="absolute top-[3px] h-4 w-4 transition-all"
        :class="value === 1 ? 'left-[23px] bg-paper' : 'left-[3px] bg-ink'"
      />
    </button>
    <span
      class="inline-flex items-center gap-1.5 text-sm"
      :class="value === 1 && def.toggleDanger ? 'text-mine-text' : 'text-ink-2'"
    >
      <svg
        v-if="value === 1 && def.toggleDanger"
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="shrink-0"
      ><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
      {{ value === 1 ? (def.toggleLabels?.on ?? 'enabled') : (def.toggleLabels?.off ?? 'disabled') }}
    </span>
  </div>
</template>
