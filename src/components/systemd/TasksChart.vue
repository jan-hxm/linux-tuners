<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { useSystemdSimulation } from '@/composables/useSystemdSimulation.js'

const { tasks } = useSystemdSimulation()

const chartData = computed(() => {
  const t = tasks.value
  return {
    labels: t.bars.map((b) => b.label),
    datasets: [
      {
        label: '% of kernel.pid_max',
        data: t.bars.map((b) => b.pct),
        backgroundColor: ['#0f172a', '#64748b'],
        borderWidth: 0,
      },
    ],
  }
})

// Text alternative for screen readers.
const summary = computed(() => {
  const t = tasks.value
  const parts = t.bars.map((b) => `${b.label} ${b.value.toLocaleString()} tasks (${b.pct}% of pid_max)`)
  return `Task and FD caps chart: against kernel.pid_max of ${t.pidMax.toLocaleString()}, ${parts.join(', ')}.`
})

const chartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  scales: {
    x: { min: 0, max: 100, title: { display: true, text: '% of kernel.pid_max' } },
    y: { ticks: { font: { size: 10 } } },
  },
  plugins: {
    tooltip: {
      callbacks: {
        label: (item) => {
          const bar = tasks.value.bars[item.dataIndex]
          return `${bar.value.toLocaleString()} tasks (${bar.pct}% of pid_max)`
        },
      },
    },
  },
}))
</script>

<template>
  <div class="space-y-3">
    <div class="h-32" role="img" :aria-label="summary">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
      <dt>kernel.pid_max</dt>
      <dd class="font-mono text-slate-900">{{ tasks.pidMax.toLocaleString() }}</dd>
      <dt>DefaultLimitNOFILE (soft:hard)</dt>
      <dd class="font-mono text-slate-900">{{ tasks.nofileSoft.toLocaleString() }}:{{ tasks.nofileHard.toLocaleString() }}</dd>
    </dl>
  </div>
</template>
