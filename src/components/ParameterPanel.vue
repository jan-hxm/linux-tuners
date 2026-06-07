<script setup>
import { ref, computed } from 'vue'
import ParameterCard from './ParameterCard.vue'
import { useActiveTuner, useTunerDomain } from '@/composables/useActiveTuner.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const SECTIONS = domain.sections

// Start with every section expanded.
const open = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, true])))

// The domain may hide context-dependent keys (e.g. swap hides overcommit_ratio
// unless strict overcommit is selected). Falls back to showing all keys.
function visibleKeys(section) {
  return domain.visibleKeys ? domain.visibleKeys(section, tuner.params) : section.keys
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
    <div class="flex items-center justify-end px-1">
      <button
        type="button"
        class="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-500"
        @click="tuner.resetToHardwareDefaults()"
      >
        Reset to hardware defaults
      </button>
    </div>
    <article
      v-for="section in SECTIONS"
      :key="section.id"
      class="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-slate-900">
            <button
              type="button"
              class="flex w-full items-center gap-1.5 text-left"
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
          v-for="key in visibleKeys(section)"
          :key="key"
          :param-key="key"
        />
      </div>
    </article>
  </section>
</template>