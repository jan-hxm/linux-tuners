<script setup>
import { computed } from 'vue'
import { useActiveTuner } from '@/composables/useActiveTuner.js'

/**
 * Generic live-simulation panel. The tuner view passes in the set of tabs (each
 * naming the chart component to render) and the reactive `impact` summary array;
 * everything else — the tab strip, the active-tab wiring through the store, the
 * impact cards — is shared between the swap and systemd tuners.
 */
const props = defineProps({
  /** @type {{id:string,label:string,blurb:string,component:any}[]} */
  tabs: { type: Array, required: true },
  /** @type {{id:string,label:string,value:string,band:string}[]} */
  impact: { type: Array, default: () => [] },
  intro: {
    type: String,
    default: 'Teaching models, not exact predictions. The shape changes as you move the controls.',
  },
})

const tuner = useActiveTuner()
const activeTab = computed(() => tuner.activeTab)
const activeComponent = computed(() => props.tabs.find((t) => t.id === activeTab.value)?.component)
const activeBlurb = computed(() => props.tabs.find((t) => t.id === activeTab.value)?.blurb)

function bandClass(band) {
  return {
    none: 'bg-slate-100 text-slate-600',
    low: 'bg-emerald-100 text-emerald-800',
    med: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }[band] ?? 'bg-slate-100 text-slate-600'
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header class="border-b border-slate-200 px-4 py-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Live simulation</h2>
      <p class="mt-1 text-xs text-slate-500">{{ intro }}</p>
    </header>

    <div role="tablist" aria-label="Simulation graphs" class="flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`tabpanel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        class="rounded-t border-b-2 px-3 py-1.5 text-sm transition"
        :class="
          activeTab === tab.id
            ? 'border-slate-800 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        "
        @click="tuner.setActiveTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      :id="`tabpanel-${activeTab}`"
      role="tabpanel"
      :aria-labelledby="`tab-${activeTab}`"
      class="space-y-4 p-4"
    >
      <p class="text-xs text-slate-500">{{ activeBlurb }}</p>

      <component :is="activeComponent" />

      <!-- Impact summary cards -->
      <ul v-if="impact.length" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <li
          v-for="metric in impact"
          :key="metric.id"
          class="rounded border border-slate-200 p-3"
        >
          <p class="text-[10px] uppercase tracking-wide text-slate-500">{{ metric.label }}</p>
          <p
            class="mt-1 inline-block rounded px-2 py-0.5 text-sm font-medium"
            :class="bandClass(metric.band)"
          >{{ metric.value }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
