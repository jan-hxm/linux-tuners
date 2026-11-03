<script setup>
import { ref, computed, watch, useId } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { showAllParams, setShowAllParams } from '@/ui/showAllParams.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const SECTIONS = domain.sections
const showAllLabelId = useId()

// Start with every section expanded.
const open = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, true])))

// The domain may hide context-dependent keys (e.g. swap hides overcommit_ratio
// unless strict overcommit is selected, security hides keys the chosen kernel
// lacks); defineTuner defaults to all keys.
function visibleKeys(section) {
  return domain.visibleKeys(section, tuner.params, tuner.hardware)
}

// A section with no key for this system (e.g. conntrack keys without
// nf_conntrack) isn't shown at all.
const shownSections = computed(() => SECTIONS.filter((s) => visibleKeys(s).length > 0))

// Advanced cards hide behind "Show N advanced" (Design.md §7 "Essential and
// advanced parameters"), except the ones a preset or the user changed and the
// ones with an issue, so nothing changes out of sight. A bulk change (profile,
// preset, reset, undo) replaces the params object and recomputes that set; an
// edit only adds to it, so a card dragged back to its default stays put.
const flaggedKeys = () => [...tuner.changedKeys, ...Object.keys(tuner.issuesByParam)]
const revealed = ref(new Set(flaggedKeys()))
watch(() => tuner.params, () => (revealed.value = new Set(flaggedKeys())))
watch(flaggedKeys, (keys) => {
  const added = keys.filter((k) => !revealed.value.has(k))
  if (added.length) revealed.value = new Set([...revealed.value, ...added])
})

/** Sections whose advanced cards the viewer opened. */
const advancedOpen = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, false])))

/**
 * A section's advanced cards that "Hide advanced" would hide. None when the
 * profile leaves the section no essential card (a domain's visibleKeys can
 * drop them): a section that is only a button would hide what it is about.
 */
function hideableKeys(section) {
  const keys = visibleKeys(section)
  if (!keys.some((k) => domain.defsByKey[k].tier === 'essential')) return []
  return keys.filter((k) => domain.defsByKey[k].tier === 'advanced' && !revealed.value.has(k))
}

function cardKeys(section) {
  if (showAllParams.value || advancedOpen.value[section.id]) return visibleKeys(section)
  const hidden = new Set(hideableKeys(section))
  return visibleKeys(section).filter((k) => !hidden.has(k))
}

const issueCountsBySection = computed(() => {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const section of SECTIONS) {
    counts[section.id] = section.keys.reduce(
      (sum, k) => sum + (tuner.issuesByParam[k]?.length ?? 0),
      0,
    )
  }
  return counts
})
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
      <div class="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          :aria-checked="showAllParams"
          :aria-labelledby="showAllLabelId"
          class="relative h-6 w-11 shrink-0 rounded-full transition"
          :class="showAllParams ? 'bg-emerald-600' : 'bg-slate-300'"
          @click="setShowAllParams(!showAllParams)"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            :class="showAllParams ? 'left-[22px]' : 'left-0.5'"
          />
        </button>
        <span :id="showAllLabelId" class="text-xs text-slate-600">Show all parameters</span>
      </div>
      <button
        type="button"
        class="inline-flex min-h-6 items-center text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-500"
        @click="tuner.resetToHardwareDefaults()"
      >
        Reset to hardware defaults
      </button>
    </div>
    <article
      v-for="section in shownSections"
      :key="section.id"
      class="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-slate-900">
            <button
              type="button"
              class="flex min-h-6 w-full items-center gap-1.5 text-left"
              :aria-expanded="open[section.id]"
              :aria-controls="`section-panel-${section.id}`"
              @click="open[section.id] = !open[section.id]"
            >
              <span aria-hidden="true">{{ open[section.id] ? '▾' : '▸' }}</span>
              {{ section.title }}
            </button>
          </h3>
          <p class="text-xs text-slate-500">{{ section.summary }}</p>
        </div>
        <span
          v-if="issueCountsBySection[section.id]"
          class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
        >
          {{ issueCountsBySection[section.id] }} issue{{ issueCountsBySection[section.id] === 1 ? '' : 's' }}
        </span>
      </header>
      <div
        v-if="open[section.id]"
        :id="`section-panel-${section.id}`"
        class="space-y-2 border-t border-slate-100 p-3"
      >
        <ParameterCard
          v-for="key in cardKeys(section)"
          :key="key"
          :param-key="key"
        />
        <button
          v-if="!showAllParams && hideableKeys(section).length"
          type="button"
          class="min-h-6 rounded px-1 text-xs text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700"
          :aria-expanded="advancedOpen[section.id]"
          :aria-controls="`section-panel-${section.id}`"
          @click="advancedOpen[section.id] = !advancedOpen[section.id]"
        >
          {{ advancedOpen[section.id] ? 'Hide advanced' : `Show ${hideableKeys(section).length} advanced` }}
        </button>
      </div>
    </article>
  </section>
</template>