<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { barChartOptions, barKind, barLegendTone, barSegment, barStop } from '@/ui/charts/chartStyle.js'
import { useSeriesTone } from '@/ui/charts/useSeriesTone.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { cpuShares: cpu } = useTunerSimulation(useActiveTuner(), simulation)
// The tuned slice's share is the visitor's value: fit, or mine once changed.
const sliceTone = useSeriesTone(['cpu_weight'])
const toneOf = (s) => (s.isTarget ? sliceTone.value : s.tone)

const chartData = computed(() => ({
  // One horizontal stacked bar; each slice is its own dataset so the stack
  // renders as proportional CPU shares under contention.
  labels: ['CPU under contention'],
  datasets: cpu.value.segments.map((s) => barSegment({ label: s.slice, data: [s.pct], tone: toneOf(s), stack: 'cpu' })),
}))

const legend = computed(() => [
  { label: 'the tuned slice', tone: sliceTone.value, kind: 'fill' },
  { label: 'sibling slices', tone: barLegendTone('rule'), kind: barKind('rule') },
])

// Text alternative for screen readers.
const summary = computed(() => {
  const c = cpu.value
  const parts = c.segments.map((s) => `${s.slice} ${s.pct}%`)
  const cap = c.quotaCores !== null
    ? ` A CPUQuota hard cap limits this slice to about ${c.quotaCores.toFixed(1)} of ${c.cores} cores regardless of weight.`
    : ''
  return `CPU shares chart: under contention a saturated CPU splits by CPUWeight as ${parts.join(', ')}.${cap}`
})

const chartOptions = computed(() =>
  barChartOptions({
    stacked: true,
    x: { min: 0, max: 100, stepSize: 20, format: (v) => `${v}%` },
    stops: cpu.value.segments.map((s, i) =>
      barStop(i, 0, s.slice, [
        `${s.pct}% of CPU time`,
        s.isTarget ? `tuned slice, CPUWeight ${s.weight}` : `sibling, CPUWeight ${s.weight}`,
      ]),
    ),
  }),
)
</script>

<template>
  <div class="space-y-3">
    <ChartFrame :aria-label="summary" height="12rem">
      <Bar :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <ChartLegend :items="legend" />
    <p class="text-[13px] text-ink-2">
      When the CPU is saturated, sibling slices split it in proportion to their
      <code class="font-mono">CPUWeight</code>. With the CPU idle, weight has no effect.
    </p>
    <p v-if="cpu.quotaCores !== null" class="flex gap-1.5 text-[13px] text-mine-text">
      <span aria-hidden="true" class="font-mono">!</span>
      <span>Hard cap: CPUQuota limits this slice to ~{{ cpu.quotaCores.toFixed(1) }} of {{ cpu.cores }} cores regardless of weight.</span>
    </p>
  </div>
</template>
