<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import { tone } from '@/ui/charts/palette.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

const { memoryBudget: memory } = useTunerSimulation(useActiveTuner(), simulation)

const chartData = computed(() => {
  const m = memory.value
  // Stacked horizontal bar across total RAM, in MiB — one segment per zone
  // (normal / throttle band / above hard cap).
  return {
    labels: ['Slice memory budget'],
    datasets: m.segments.map((s) => ({
      label: s.label,
      data: [s.mib],
      backgroundColor: tone(s.tone),
      borderWidth: 0,
      stack: 'mem',
    })),
  }
})

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
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        stacked: true,
        min: 0,
        max: m.totalMiB,
        title: { display: true, text: 'GiB of RAM' },
        ticks: { callback: (v) => `${(v / 1024).toFixed(0)}` },
      },
      y: { stacked: true, display: false },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: {
        callbacks: { label: (item) => `${item.dataset.label}: ${(item.parsed.x / 1024).toFixed(2)} GiB` },
      },
    },
  }
})
</script>

<template>
  <div class="space-y-3">
    <ChartFrame :aria-label="summary" height="8rem">
      <Bar :data="chartData" :options="chartOptions" />
    </ChartFrame>
    <p class="text-[13px] text-ink-2">
      <code class="font-mono">MemoryHigh</code> throttles the slice; <code class="font-mono">MemoryMax</code> is the hard OOM cap.
    </p>
    <p v-if="memory.noLimits" class="flex gap-1.5 text-[13px] text-mine-text">
      <span aria-hidden="true" class="font-mono">!</span>No memory limits set; the slice can use all of RAM.
    </p>
  </div>
</template>
