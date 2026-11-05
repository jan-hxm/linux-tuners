<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { hatchZone, lineChartOptions, mainSeries, threshold, xStop } from '@/ui/charts/chartStyle.js'
import { useSeriesTone } from '@/ui/charts/useSeriesTone.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

/** The parameters the timeline is drawn from. */
const KEYS = ['dirty_ratio', 'dirty_background_ratio', 'dirty_writeback_centisecs', 'dirty_expire_centisecs']

const LEGEND = [
  { label: 'background flush', tone: 'quiet', kind: 'dash' },
  { label: 'writes stall', tone: 'error', kind: 'hatch' },
]

const { dirtyTimeline: dirty } = useTunerSimulation(useActiveTuner(), simulation)
const seriesTone = useSeriesTone(KEYS)

const chartData = computed(() => ({
  datasets: [
    mainSeries({
      label: 'dirty pages',
      data: dirty.value.points.map((p) => ({ x: p.t, y: p.dirty })),
      tone: seriesTone.value,
      tension: 0.1,
    }),
  ],
}))

// Text alternative for screen readers.
const summary = computed(() => {
  const d = dirty.value
  const peak = Math.max(...d.points.map((p) => p.dirty))
  const stall = d.stallReached
    ? `the synchronous stall ceiling at ${d.ratioLine}% is reached, so writes block on the flusher`
    : `dirty pages peak at about ${peak.toFixed(1)}% of available memory, staying below the ${d.ratioLine}% stall ceiling`
  return `Dirty writeback chart: over a 120-second constant write workload, ${stall}. Background flush threshold is ${d.bgLine}% of available memory.`
})

// What is happening at one second, said only once something happens.
function stateAt(p, d) {
  if (p.stall) return 'writes stall'
  if (p.dirty >= d.bgLine) return 'flusher writing back'
  return null
}

const chartOptions = computed(() => {
  const d = dirty.value
  // Cap Y so the stall zone has visible room above the ceiling.
  const yMax = Math.max(d.ratioLine + 5, 25)
  return lineChartOptions({
    x: { min: 0, max: d.points.at(-1).t, title: 'seconds', stepSize: 20 },
    y: { min: 0, max: yMax, format: (v) => `${v}%` },
    zones: [threshold('y', d.bgLine), hatchZone('y', d.ratioLine, yMax)],
    stops: d.points.map((p) => xStop(p.t, `At ${p.t} s`, [`${p.dirty.toFixed(1)}% of RAM dirty`, stateAt(p, d)].filter(Boolean))),
  })
})
</script>

<template>
  <div class="space-y-2">
    <ChartFrame :aria-label="summary">
      <Line :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <ChartLegend :items="LEGEND" />
    <p v-if="dirty.stallReached" class="flex gap-1.5 text-[13px] text-error">
      <span aria-hidden="true" class="font-mono">×</span>Stalls reached in this window: writes synchronously waited for the flusher.
    </p>
    <p v-if="!dirty.flushEvents.length" class="flex gap-1.5 text-[13px] text-mine-text">
      <span aria-hidden="true" class="font-mono">!</span>Periodic writeback disabled (dirty_writeback_centisecs = 0).
    </p>
  </div>
</template>
