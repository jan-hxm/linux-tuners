<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import { barChartOptions, barSegment, barStop } from '@/ui/charts/chartStyle.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { tasksUsage: tasks } = useTunerSimulation(useActiveTuner(), simulation)

const chartData = computed(() => {
  const t = tasks.value
  return {
    labels: t.bars.map((b) => b.label),
    datasets: [barSegment({ label: '% of kernel.pid_max', data: t.bars.map((b) => b.pct), tone: ['ink', 'quiet'] })],
  }
})

// Text alternative for screen readers.
const summary = computed(() => {
  const t = tasks.value
  const parts = t.bars.map((b) => `${b.label} ${b.value.toLocaleString()} tasks (${b.pct}% of pid_max)`)
  return `Task and FD caps chart: against kernel.pid_max of ${t.pidMax.toLocaleString()}, ${parts.join(', ')}.`
})

const chartOptions = computed(() => {
  const t = tasks.value
  return barChartOptions({
    categories: true,
    x: { min: 0, max: 100, title: 'of kernel.pid_max', format: (v) => `${v}%` },
    stops: t.bars.map((b, i) =>
      barStop(0, i, b.label, [
        `${b.value.toLocaleString('en-US')} tasks, ${b.pct}% of pid_max`,
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
    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-2">
      <dt>kernel.pid_max</dt>
      <dd class="font-mono text-ink">{{ tasks.pidMax.toLocaleString() }}</dd>
      <dt>DefaultLimitNOFILE (soft:hard)</dt>
      <dd class="font-mono text-ink">{{ tasks.nofileSoft.toLocaleString() }}:{{ tasks.nofileHard.toLocaleString() }}</dd>
    </dl>
  </div>
</template>
