<script setup>
import { computed, ref, useId } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { differingKeys } from '@/core/valueTypes.js'
import PlusMinus from '@/ui/PlusMinus.vue'

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
  <section>
    <p class="text-[15px] text-ink-2">
      Click a preset to snap every parameter to its values. Your hardware spec stays unchanged.
    </p>

    <!-- Hairline rows; the applied preset sits on the selected tint with a
         filled verdigris dot, like a radio. -->
    <ul class="mt-4 grid grid-cols-1 gap-x-8 border-t border-ink sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="preset in PRESETS" :key="preset.id" class="flex min-w-0 flex-col border-b border-rule">
        <button
          type="button"
          class="flex flex-1 items-start gap-3.5 px-2 py-3.5 text-left text-ink"
          :aria-pressed="isActive(preset)"
          :class="isActive(preset) ? 'bg-fit-tint' : 'hover:bg-paper-hover'"
          @click="apply(preset)"
        >
          <span
            aria-hidden="true"
            class="mt-[3px] h-[18px] w-[18px] shrink-0 rounded-full"
            :class="isActive(preset) ? 'border-[6px] border-fit bg-paper' : 'border-[1.5px] border-rule-strong'"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-base" :class="isActive(preset) ? 'font-medium' : ''">{{ preset.label }}</span>
            <span class="mt-0.5 block text-sm leading-relaxed text-ink-2">{{ preset.description }}</span>
            <span v-if="isCustomised(preset)" class="mt-1.5 flex items-center gap-1.5 text-[13px] text-mine-text">
              <span aria-hidden="true" class="h-[9px] w-[9px] shrink-0 rounded-full bg-mine" />
              customised
            </span>
          </span>
        </button>
        <button
          v-if="diffsByPreset[preset.id].length"
          type="button"
          class="inline-flex min-h-9 items-center gap-2 self-start px-2 pb-1.5 text-[13px] text-ink-2 underline underline-offset-[3px] hover:text-ink"
          :aria-expanded="previewId === preset.id"
          :aria-controls="panelId"
          :aria-label="`${preset.label}: ${changeCount(preset)}, show what would change`"
          @click="togglePreview(preset)"
        >
          {{ changeCount(preset) }}<PlusMinus :open="previewId === preset.id" />
        </button>
        <span v-else class="inline-flex min-h-9 items-center px-2 pb-1.5 text-[13px] text-quiet">Matches current values</span>
      </li>
    </ul>

    <div :id="panelId">
      <div
        v-if="previewPreset"
        class="mt-4 border-b border-rule pb-3 text-sm text-ink-2"
      >
        <p class="font-medium text-ink">Applying {{ previewPreset.label }} would change:</p>
        <ul v-if="diffsByPreset[previewPreset.id].length" class="mt-2">
          <li v-for="d in diffsByPreset[previewPreset.id]" :key="d.key" class="break-words border-t border-rule py-1.5">
            <span class="font-mono text-ink">{{ d.name }}</span>: <span class="font-mono">{{ d.current }} → {{ d.preset }}</span>
          </li>
        </ul>
        <p v-else class="mt-2">Nothing: it matches your current values.</p>
      </div>
    </div>
  </section>
</template>
