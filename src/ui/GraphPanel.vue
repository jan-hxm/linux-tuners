<script setup>
import { computed, nextTick } from 'vue'
import { useActiveTuner } from '@/ui/useActiveTuner.js'

/**
 * Generic live-simulation panel. TunerPage passes in the domain's graph tabs
 * (each naming the chart component to render) and the reactive `impact` summary array;
 * everything else (the tab strip, the active-tab wiring through the store, the
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
// Fall back to the first tab when the store holds an id this panel doesn't have
// (stale or hand-edited share link); otherwise every tab gets tabindex -1 and
// the tablist is unreachable by keyboard.
const activeTab = computed(() =>
  props.tabs.some((t) => t.id === tuner.activeTab) ? tuner.activeTab : props.tabs[0]?.id,
)
const activeComponent = computed(() => props.tabs.find((t) => t.id === activeTab.value)?.component)
const activeBlurb = computed(() => props.tabs.find((t) => t.id === activeTab.value)?.blurb)

// ARIA tab pattern: Left/Right/Home/End move the selection and follow focus to
// the newly selected tab. Without this the roving tabindex leaves non-selected
// tabs unreachable by keyboard.
function onTabKeydown(e) {
  const ids = props.tabs.map((t) => t.id)
  const current = ids.indexOf(activeTab.value)
  if (current === -1) return
  let next = current
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % ids.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + ids.length) % ids.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = ids.length - 1
  else return
  e.preventDefault()
  tuner.setActiveTab(ids[next])
  nextTick(() => document.getElementById(`tab-${ids[next]}`)?.focus())
}

// The band of an impact metric, as the value's colour. The value's own words
// carry the meaning; the colour only echoes it.
function bandClass(band) {
  return { low: 'text-fit-text', med: 'text-mine-text', high: 'text-error' }[band] ?? 'text-ink-2'
}
</script>

<template>
  <!-- A hairline panel: no box, the tabs on an ink rule, the chart, its
       caption and the impact numbers between hairlines. -->
  <section aria-labelledby="graph-panel-title">
    <h3 id="graph-panel-title" class="text-[15px] font-medium text-ink">Live simulation</h3>

    <div role="tablist" aria-label="Simulation graphs" class="mt-2 flex flex-wrap border-b border-ink" @keydown="onTabKeydown">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`tabpanel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        class="-mb-px min-h-11 border-b-[3px] px-3.5 text-sm font-medium transition-colors first:pl-0 hover:bg-paper-hover"
        :class="activeTab === tab.id ? 'border-fit text-ink' : 'border-transparent text-ink-2 hover:text-ink'"
        @click="tuner.setActiveTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      :id="`tabpanel-${activeTab}`"
      role="tabpanel"
      :aria-labelledby="`tab-${activeTab}`"
      class="pt-3"
    >
      <component :is="activeComponent" />

      <p class="mt-2 border-t border-rule pt-2 text-[15px] leading-[1.5] text-ink-2">{{ activeBlurb }}</p>

      <!-- Impact numbers, one hairline row each. -->
      <ul v-if="impact.length" class="mt-2">
        <li
          v-for="metric in impact"
          :key="metric.id"
          class="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-rule py-1.5 last:border-b"
        >
          <span class="text-[13px] text-quiet">{{ metric.label }}</span>
          <span class="font-mono text-[15px]" :class="bandClass(metric.band)">{{ metric.value }}</span>
        </li>
      </ul>

      <p class="mt-2 text-[13px] text-quiet">{{ intro }}</p>
    </div>
  </section>
</template>
