<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { useSimulation } from '@/composables/useSimulation.js'

const { dirty } = useSimulation()

const chartData = computed(() => {
  const d = dirty.value
  return {
    datasets: [
      {
        label: 'Dirty pages (% RAM)',
        data: d.points.map((p) => ({ x: p.t, y: p.dirty })),
        borderColor: '#0f172a',
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
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
        borderColor: '#16a34a',
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
        borderColor: '#dc2626',
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
    : `dirty pages peak at about ${peak.toFixed(1)}% of RAM, staying below the ${d.ratioLine}% stall ceiling`
  return `Dirty writeback chart: over a 120-second constant write workload, ${stall}. Background flush threshold is ${d.bgLine}% of RAM.`
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
    <div class="h-64" role="img" :aria-label="summary">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-slate-600">
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 bg-slate-900"></span> dirty pages
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 border-t border-dashed border-green-600"></span> bg flush
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 border-t border-dashed border-red-600"></span> stall ceiling
      </span>
      <span v-if="dirty.stallReached" class="rounded bg-red-50 px-2 py-0.5 text-red-800">
        Stalls reached in this window: writes synchronously waited for the flusher.
      </span>
      <span v-if="!dirty.flushEvents.length" class="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
        Periodic writeback disabled (dirty_writeback_centisecs = 0).
      </span>
    </div>
  </div>
</template>