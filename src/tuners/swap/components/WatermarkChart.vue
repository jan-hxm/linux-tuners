<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { barChartOptions, barKind, barLegendTone, barSegment, barStop } from '@/ui/charts/chartStyle.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { watermarkBars: watermarks } = useTunerSimulation(useActiveTuner(), simulation)

/** What each zone means, by the simulation's segment label. */
const MEANING = {
  'reserved (≤ min)': 'kept for the kernel',
  'direct-reclaim (min → low)': 'programs stall to reclaim',
  'kswapd (low → high)': 'kswapd reclaims in the background',
  'usable (> high)': 'free, no reclaim',
}

const gib = (mib) => `${(mib / 1024).toFixed(1)} GiB`
// The error zone is a danger zone, so it is hatched.
const hatched = (s) => s.tone === 'error'

const chartData = computed(() => ({
  // One horizontal stacked bar; each zone is its own dataset so it stacks.
  labels: ['RAM zones'],
  datasets: watermarks.value.segments.map((s) =>
    barSegment({ label: s.label, data: [s.mib], tone: s.tone, hatch: hatched(s), stack: 'ram' }),
  ),
}))

const legend = computed(() =>
  watermarks.value.segments.map((s) => ({ label: s.label, tone: barLegendTone(s.tone, hatched(s)), kind: barKind(s.tone, hatched(s)) })),
)

// Text alternative for screen readers.
const summary = computed(() => {
  const w = watermarks.value
  const parts = w.segments.map((s) => `${s.label} ${(s.mib / 1024).toFixed(1)} GiB`)
  return `Watermark zones chart: a stacked bar of the RAM zone reclaim structure, ${parts.join(', ')}.`
})

const chartOptions = computed(() => {
  const segments = watermarks.value.segments
  const total = segments.reduce((sum, s) => sum + s.mib, 0)
  return barChartOptions({
    stacked: true,
    x: { min: 0, max: total, format: (v) => `${(v / 1024).toFixed(0)} GiB` },
    stops: segments.map((s, i) =>
      barStop(i, 0, s.label, [
        `${gib(s.mib)}, ${((s.mib / total) * 100).toFixed(1)}% of RAM`,
        ...(MEANING[s.label] ? [MEANING[s.label]] : []),
      ]),
    ),
  })
})
</script>

<template>
  <div class="space-y-3">
    <ChartFrame :aria-label="summary" height="12rem">
      <Bar :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <ChartLegend :items="legend" />
    <div>
      <p class="font-mono text-[13px] text-quiet">/proc/zoneinfo (simulated)</p>
      <pre class="mt-1 overflow-x-auto border border-rule bg-paper-hover p-2 font-mono text-[13px] leading-snug text-ink" tabindex="0" aria-label="Simulated /proc/zoneinfo output"><code>{{ watermarks.zoneInfoSnippet }}</code></pre>
    </div>
  </div>
</template>
