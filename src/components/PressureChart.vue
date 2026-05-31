<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { useSimulation } from '@/composables/useSimulation.js'

const { pressure } = useSimulation()

const chartData = computed(() => {
  const p = pressure.value
  // Threshold markers drawn as two-point datasets that span the full Y range.
  const verticalMarker = (x, color, dash) => ({
    label: '',
    data: [
      { x, y: 0 },
      { x, y: 100 },
    ],
    borderColor: color,
    borderDash: dash,
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
    showLine: true,
  })

  const datasets = [
    {
      label: 'Swap usage %',
      data: p.points.map((pt) => ({ x: pt.memFill, y: pt.swapUsage })),
      borderColor: '#0f172a',
      backgroundColor: 'rgba(15, 23, 42, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      tension: 0.2,
    },
    // Kswapd band: two boundary lines + filled area between via the same
    // dataset's fill. We achieve this with paired dummy datasets.
    {
      label: 'kswapd band (high watermark)',
      data: [
        { x: p.highFillPct, y: 0 },
        { x: p.highFillPct, y: 100 },
      ],
      borderColor: '#0ea5e9',
      borderDash: [4, 3],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      showLine: true,
    },
    {
      label: 'kswapd band (low watermark)',
      data: [
        { x: p.lowFillPct, y: 0 },
        { x: p.lowFillPct, y: 100 },
      ],
      borderColor: '#0ea5e9',
      borderDash: [4, 3],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      showLine: true,
    },
    verticalMarker(p.minFillPct, '#dc2626', [2, 2]),
  ]
  return { datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  parsing: false,
  animation: false,
  scales: {
    x: {
      type: 'linear',
      min: 0,
      max: 100,
      title: { display: true, text: 'Memory fill %' },
      ticks: { stepSize: 10 },
    },
    y: {
      type: 'linear',
      min: 0,
      max: 100,
      title: { display: true, text: 'Estimated swap usage %' },
      ticks: { stepSize: 20 },
    },
  },
  plugins: {
    tooltip: {
      callbacks: {
        title: (items) => `mem fill ${items[0].parsed.x.toFixed(0)}%`,
        label: (item) => {
          if (item.datasetIndex === 0) return `swap: ${item.parsed.y.toFixed(1)}%`
          if (item.datasetIndex === 1) return `high watermark`
          if (item.datasetIndex === 2) return `low watermark`
          if (item.datasetIndex === 3) return `min watermark (direct reclaim → OOM)`
          return ''
        },
      },
    },
  },
}))
</script>

<template>
  <div class="space-y-2">
    <div class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-slate-600">
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 bg-slate-900"></span> swap usage
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 border-t border-dashed border-sky-500"></span> kswapd band
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-4 border-t border-dashed border-red-600"></span> direct reclaim / OOM
      </span>
      <span v-if="pressure.noSwap" class="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
        Swap disabled, so the curve stays at 0.
      </span>
    </div>
  </div>
</template>