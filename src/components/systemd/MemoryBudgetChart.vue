<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { useSystemdSimulation } from '@/composables/useSystemdSimulation.js'

const { memory } = useSystemdSimulation()

const chartData = computed(() => {
  const m = memory.value
  // Stacked horizontal bar across total RAM, in MiB — one segment per zone
  // (normal / throttle band / above hard cap).
  return {
    labels: ['Slice memory budget'],
    datasets: m.segments.map((s) => ({
      label: s.label,
      data: [s.mib],
      backgroundColor: s.color,
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
    <div class="h-32" role="img" :aria-label="summary">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-slate-600">
      <span>
        <code class="font-mono">MemoryHigh</code> throttles the slice; <code class="font-mono">MemoryMax</code> is the hard OOM cap.
      </span>
      <span v-if="memory.noLimits" class="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
        No memory limits set; the slice can use all of RAM.
      </span>
    </div>
  </div>
</template>
