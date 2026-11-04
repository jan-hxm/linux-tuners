<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import { tone } from '@/ui/charts/palette.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { watermarkBars: watermarks } = useTunerSimulation(useActiveTuner(), simulation)

const chartData = computed(() => {
  const w = watermarks.value
  // One horizontal stacked bar, one category ("RAM zones"). Each watermark
  // segment is its own dataset so the stack renders correctly.
  return {
    labels: ['RAM zones'],
    datasets: w.segments.map((s) => ({
      label: s.label,
      data: [s.mib],
      backgroundColor: tone(s.tone),
      borderWidth: 0,
      stack: 'ram',
    })),
  }
})

// Text alternative for screen readers.
const summary = computed(() => {
  const w = watermarks.value
  const parts = w.segments.map((s) => `${s.label} ${(s.mib / 1024).toFixed(1)} GiB`)
  return `Watermark zones chart: a stacked bar of the RAM zone reclaim structure, ${parts.join(', ')}.`
})

const chartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  scales: {
    x: {
      stacked: true,
      title: { display: true, text: 'MiB' },
      ticks: {
        callback: (v) => `${(v / 1024).toFixed(1)} GiB`,
      },
    },
    y: { stacked: true, display: false },
  },
  plugins: {
    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
    tooltip: {
      callbacks: {
        label: (item) => `${item.dataset.label}: ${item.parsed.x.toLocaleString()} MiB`,
      },
    },
  },
}))
</script>

<template>
  <div class="space-y-3">
    <ChartFrame :aria-label="summary" height="8rem">
      <Bar :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <div>
      <p class="font-mono text-[13px] text-quiet">/proc/zoneinfo (simulated)</p>
      <pre class="mt-1 overflow-x-auto border border-rule bg-paper-hover p-2 font-mono text-[13px] leading-snug text-ink" tabindex="0" aria-label="Simulated /proc/zoneinfo output"><code>{{ watermarks.zoneInfoSnippet }}</code></pre>
    </div>
  </div>
</template>