<script setup>
import { computed } from 'vue'
import { PRESETS } from '@/data/presets.js'
import { useTunerStore } from '@/stores/tuner.js'

const tuner = useTunerStore()

/**
 * For each preset, compute which of the keys it defines differ from the current
 * store value. Drives both the "customised" badge on the active preset and the
 * hover tooltip on every chip.
 */
const diffsByPreset = computed(() => {
  /** @type {Record<string, string[]>} */
  const result = {}
  for (const preset of PRESETS) {
    const diffs = []
    for (const [key, expected] of Object.entries(preset.values)) {
      if (tuner.params[key] !== expected) {
        diffs.push(`${key}: current ${tuner.params[key]} ↔ preset ${expected}`)
      }
    }
    result[preset.id] = diffs
  }
  return result
})

function tooltipFor(preset) {
  const diffs = diffsByPreset.value[preset.id]
  if (!diffs.length) return `${preset.description}\n\nIdentical to current values.`
  return `${preset.description}\n\nWould change:\n${diffs.map((d) => `  • ${d}`).join('\n')}`
}

function isActive(preset) {
  return tuner.activePreset === preset.id
}

function isCustomised(preset) {
  return isActive(preset) && diffsByPreset.value[preset.id].length > 0
}

function apply(preset) {
  tuner.applyPreset(preset.id, preset.values)
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <p class="text-xs text-slate-500">
      Click a preset to snap every parameter to its values. Your hardware spec stays unchanged.
    </p>

    <ul class="mt-3 flex flex-wrap gap-2">
      <li v-for="preset in PRESETS" :key="preset.id">
        <button
          type="button"
          :title="tooltipFor(preset)"
          class="group flex max-w-xs items-start gap-2 rounded border px-3 py-2 text-left text-sm transition"
          :class="[
            isActive(preset)
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50',
          ]"
          @click="apply(preset)"
        >
          <span class="flex-1">
            <span class="font-medium">{{ preset.label }}</span>
            <span
              class="block text-xs"
              :class="isActive(preset) ? 'text-slate-300' : 'text-slate-500'"
            >
              {{ preset.description }}
            </span>
          </span>
          <span
            v-if="isCustomised(preset)"
            class="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
          >
            customised
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>