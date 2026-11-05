<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { barChartOptions, barKind, barLegendTone, barSegment, barStop } from '@/ui/charts/chartStyle.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { memoryBudget: memory } = useTunerSimulation(useActiveTuner(), simulation)

/** What each zone means, by the simulation's segment label. */
const MEANING = {
  'normal use': 'unthrottled',
  'throttle (MemoryHigh→Max)': 'throttled and reclaimed hard',
  'above MemoryMax (OOM)': 'out of reach, OOM kill at the cap',
}

// The error zone is a danger zone, so it is hatched.
const hatched = (s) => s.tone === 'error'

const chartData = computed(() => ({
  // Stacked horizontal bar across total RAM, in MiB: one segment per zone
  // (normal / throttle band / above hard cap).
  labels: ['Slice memory budget'],
  datasets: memory.value.segments.map((s) =>
    barSegment({ label: s.label, data: [s.mib], tone: s.tone, hatch: hatched(s), stack: 'mem' }),
  ),
}))

const legend = computed(() =>
  memory.value.segments.map((s) => ({ label: s.label, tone: barLegendTone(s.tone, hatched(s)), kind: barKind(s.tone, hatched(s)) })),
)

// Text alternative for screen readers.
const summary = computed(() => {
  const m = memory.value
  if (m.noLimits) {
    return 'Memory budget chart: no memory limits are set, so the slice can use all of RAM.'
  }
  const parts = m.segments.map((s) => `${s.label} ${(s.mib / 1024).toFixed(2)} GiB`)
  return `Memory budget chart: of total RAM, ${parts.join(', ')}. MemoryHigh throttles the slice and MemoryMax is the hard OOM cap.`
})

const chartOptions = computed(() => {
  const m = memory.value
  return barChartOptions({
    stacked: true,
    x: { min: 0, max: m.totalMiB, format: (v) => `${(v / 1024).toFixed(0)} GiB` },
    stops: m.segments.map((s, i) =>
      barStop(i, 0, s.label, [
        `${(s.mib / 1024).toFixed(2)} GiB, ${((s.mib / m.totalMiB) * 100).toFixed(0)}% of RAM`,
        ...(MEANING[s.label] ? [MEANING[s.label]] : []),
      ]),
    ),
  })
})
</script>

<template>
  <div class="space-y-3">
    <ChartFrame :aria-label="summary" height="7rem">
      <Bar :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <ChartLegend :items="legend" />
    <p class="text-[13px] text-ink-2">
      <code class="font-mono">MemoryHigh</code> throttles the slice; <code class="font-mono">MemoryMax</code> is the hard OOM cap.
    </p>
    <p v-if="memory.noLimits" class="flex gap-1.5 text-[13px] text-mine-text">
      <span aria-hidden="true" class="font-mono">!</span>No memory limits set; the slice can use all of RAM.
    </p>
  </div>
</template>
