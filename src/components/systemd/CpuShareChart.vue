<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { useSystemdSimulation } from '@/composables/useSystemdSimulation.js'

const { cpu } = useSystemdSimulation()

const chartData = computed(() => {
  const c = cpu.value
  // One horizontal stacked bar; each slice is its own dataset so the stack
  // renders as proportional CPU shares under contention.
  return {
    labels: ['CPU under contention'],
    datasets: c.segments.map((s) => ({
      label: s.slice,
      data: [s.pct],
      backgroundColor: s.color,
      borderWidth: 0,
      stack: 'cpu',
    })),
  }
})

const chartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  scales: {
    x: { stacked: true, min: 0, max: 100, title: { display: true, text: '% of CPU time' }, ticks: { stepSize: 20 } },
    y: { stacked: true, display: false },
  },
  plugins: {
    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
    tooltip: {
      callbacks: { label: (item) => `${item.dataset.label}: ${item.parsed.x}%` },
    },
  },
}))
</script>

<template>
  <div class="space-y-3">
    <div class="h-32">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-slate-600">
      <span>
        When the CPU is saturated, sibling slices split it in proportion to their
        <code class="font-mono">CPUWeight</code>. With the CPU idle, weight has no effect.
      </span>
      <span v-if="cpu.quotaCores !== null" class="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
        Hard cap: CPUQuota limits this slice to ~{{ cpu.quotaCores.toFixed(1) }} of {{ cpu.cores }} cores regardless of weight.
      </span>
    </div>
  </div>
</template>
