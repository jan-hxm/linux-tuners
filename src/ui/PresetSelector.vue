<script setup>
import { computed, ref, useId } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { differingKeys } from '@/core/valueTypes.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()
const PRESETS = domain.presets
const panelId = useId()

/**
 * For each preset, compute which of the keys it defines differ from the current
 * store value. Drives both the "customised" badge on the active preset and the
 * "what would change" panel.
 */
const diffsByPreset = computed(() => {
  /** @type {Record<string, { key: string, name: string, current: string, preset: string }[]>} */
  const result = {}
  for (const preset of PRESETS) {
    result[preset.id] = differingKeys(domain.defsByKey, preset.values, tuner.params).map((key) => {
      const def = domain.defsByKey[key]
      return {
        key,
        name: def.sysctlName,
        current: domain.formatValue(tuner.params[key], def, tuner.hardware),
        preset: domain.formatValue(preset.values[key], def, tuner.hardware),
      }
    })
  }
  return result
})

// The preset whose changes are shown below the chips, or null. A separate
// button rather than a hover tooltip, so touch and keyboard users can see the
// changes before a click on the chip applies them.
const previewId = ref(null)
const previewPreset = computed(() => PRESETS.find((p) => p.id === previewId.value) ?? null)

function togglePreview(preset) {
  previewId.value = previewId.value === preset.id ? null : preset.id
}

function changeCount(preset) {
  const n = diffsByPreset.value[preset.id].length
  return n === 1 ? '1 change' : `${n} changes`
}

function isActive(preset) {
  return tuner.activePreset === preset.id
}

function isCustomised(preset) {
  return isActive(preset) && diffsByPreset.value[preset.id].length > 0
}

function apply(preset) {
  tuner.applyPreset(preset.id, preset.values)
  // Its preview would now say "nothing", with its toggle gone.
  if (previewId.value === preset.id) previewId.value = null
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <p class="text-xs text-slate-500">
      Click a preset to snap every parameter to its values. Your hardware spec stays unchanged.
    </p>

    <ul class="mt-3 flex flex-wrap gap-2">
      <li v-for="preset in PRESETS" :key="preset.id" class="flex max-w-xs flex-col gap-1">
        <button
          type="button"
          class="group flex flex-1 items-start gap-2 rounded border px-3 py-2 text-left text-sm transition"
          :class="[
            isActive(preset)
              ? 'border-sky-700 bg-sky-700 text-white'
              : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50',
          ]"
          @click="apply(preset)"
        >
          <span class="flex-1">
            <span class="font-medium">{{ preset.label }}</span>
            <span
              class="block text-xs"
              :class="isActive(preset) ? 'text-sky-100' : 'text-slate-500'"
            >
              {{ preset.description }}
            </span>
          </span>
          <span
            v-if="isCustomised(preset)"
            class="light-palette shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
          >
            customised
          </span>
        </button>
        <button
          v-if="diffsByPreset[preset.id].length"
          type="button"
          class="inline-flex min-h-6 items-center self-start px-1 text-xs text-slate-500 hover:text-slate-700"
          :aria-expanded="previewId === preset.id"
          :aria-controls="panelId"
          :aria-label="`${preset.label}: ${changeCount(preset)}, show what would change`"
          @click="togglePreview(preset)"
        >
          {{ previewId === preset.id ? '▾' : '▸' }} {{ changeCount(preset) }}
        </button>
        <span v-else class="px-1 text-xs text-slate-500">Matches current values</span>
      </li>
    </ul>

    <div :id="panelId">
      <div
        v-if="previewPreset"
        class="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
      >
        <p class="font-semibold text-slate-800">Applying {{ previewPreset.label }} would change:</p>
        <ul v-if="diffsByPreset[previewPreset.id].length" class="mt-2 space-y-1">
          <li v-for="d in diffsByPreset[previewPreset.id]" :key="d.key" class="break-words">
            <span class="font-mono">{{ d.name }}</span>: {{ d.current }} → {{ d.preset }}
          </li>
        </ul>
        <p v-else class="mt-2">Nothing: it matches your current values.</p>
      </div>
    </div>
  </section>
</template>
