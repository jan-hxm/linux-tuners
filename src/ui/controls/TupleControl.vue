<script setup>
const props = defineProps({
  def: { type: Object, required: true },
  value: { type: Array, required: true },
  range: { type: Object, required: true },
  labelId: { type: String, required: true },
  // Part of the shared control contract; unused here.
  valueText: { type: String, default: '' },
})
const emit = defineEmits(['update'])

// One number input per element, labelled from def.tupleLabels. A change emits
// the whole tuple; the store parses and clamps it by type, so a cleared or
// non-numeric field leaves the value as it was.
function commit(index, raw) {
  if (String(raw).trim() === '') return
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  emit('update', props.value.map((v, i) => (i === index ? n : v)))
}
</script>

<template>
  <div role="group" :aria-labelledby="labelId" class="mt-3 flex flex-wrap gap-3">
    <label v-for="(label, i) in def.tupleLabels" :key="label" class="flex flex-col text-[11px] text-slate-600">
      {{ label }}
      <input
        type="number"
        :value="value[i]"
        :min="range.min"
        :max="range.max"
        :step="def.step"
        class="mt-0.5 w-32 rounded border border-slate-300 px-1.5 py-0.5 text-right font-mono text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
        @change="commit(i, $event.target.value)"
      />
    </label>
  </div>
</template>
