<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { useSimulation } from '@/composables/useSimulation.js'

const { watermarks } = useSimulation()

const chartData = computed(() => {
  const w = watermarks.value
  // One horizontal stacked bar, one category ("RAM zones"). Each watermark
  // segment is its own dataset so the stack renders correctly.
  return {
    labels: ['RAM zones'],
    datasets: w.segments.map((s) => ({
      label: s.label,
      data: [s.mib],
      backgroundColor: s.color,
      borderWidth: 0,
      stack: 'ram',
    })),
  }
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
    <div class="h-32">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div>
      <p class="text-[10px] uppercase tracking-wide text-slate-500">/proc/zoneinfo (simulated)</p>
      <pre class="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-[11px] leading-snug text-slate-100"><code>{{ watermarks.zoneInfoSnippet }}</code></pre>
    </div>
  </div>
</template>