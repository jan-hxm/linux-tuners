<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { PALETTE } from '@/ui/charts/palette.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const LEGEND = [
  { label: 'dirty pages', tone: 'ink' },
  { label: 'bg flush', tone: 'quiet', dash: true },
  { label: 'stall ceiling', tone: 'error', dash: true },
]

const { dirtyTimeline: dirty } = useTunerSimulation(useActiveTuner(), simulation)

const chartData = computed(() => {
  const d = dirty.value
  return {
    datasets: [
      {
        label: 'Dirty pages (% RAM)',
        data: d.points.map((p) => ({ x: p.t, y: p.dirty })),
        borderColor: PALETTE.ink,
        backgroundColor: PALETTE.inkFill,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
      },
      {
        label: 'background flush threshold',
        data: [
          { x: 0, y: d.bgLine },
          { x: d.points.at(-1).t, y: d.bgLine },
        ],
        borderColor: PALETTE.quiet,
        borderDash: [4, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        showLine: true,
      },
      {
        label: 'synchronous stall ceiling',
        data: [
          { x: 0, y: d.ratioLine },
          { x: d.points.at(-1).t, y: d.ratioLine },
        ],
        borderColor: PALETTE.error,
        borderDash: [4, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        showLine: true,
      },
    ],
  }
})

// Text alternative for screen readers.
const summary = computed(() => {
  const d = dirty.value
  const peak = Math.max(...d.points.map((p) => p.dirty))
  const stall = d.stallReached
    ? `the synchronous stall ceiling at ${d.ratioLine}% is reached, so writes block on the flusher`
    : `dirty pages peak at about ${peak.toFixed(1)}% of available memory, staying below the ${d.ratioLine}% stall ceiling`
  return `Dirty writeback chart: over a 120-second constant write workload, ${stall}. Background flush threshold is ${d.bgLine}% of available memory.`
})

const chartOptions = computed(() => {
  const d = dirty.value
  // Cap Y so the stall ceiling has visible room above it.
  const yMax = Math.max(d.ratioLine + 5, 25)
  return {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    animation: false,
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: d.points.at(-1).t,
        title: { display: true, text: 'time (s)' },
        ticks: { stepSize: 20 },
      },
      y: {
        type: 'linear',
        min: 0,
        max: yMax,
        title: { display: true, text: 'dirty memory (% RAM)' },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => `t = ${items[0].parsed.x}s`,
          label: (item) => {
            if (item.datasetIndex === 0) return `dirty: ${item.parsed.y.toFixed(1)}%`
            if (item.datasetIndex === 1) return `bg flush threshold (${d.bgLine}%)`
            if (item.datasetIndex === 2) return `stall ceiling (${d.ratioLine}%)`
            return ''
          },
        },
      },
    },
  }
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