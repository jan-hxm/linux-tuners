<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { PALETTE } from '@/ui/charts/palette.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import { formatBytes, formatRate } from '../formatting.js'
import * as simulation from '../simulation.js'

const LEGEND = [
  { label: 'tuned buffer', tone: 'ink' },
  { label: 'kernel default', tone: 'quiet', dash: true },
  { label: 'your path', tone: 'fit', dash: true },
]

const { throughputCurve: curve } = useTunerSimulation(useActiveTuner(), simulation)

const chartData = computed(() => {
  const c = curve.value
  const lastMs = c.points.at(-1).rttMs
  return {
    datasets: [
      {
        label: 'tuned tcp_rmem max',
        data: c.points.map((p) => ({ x: p.rttMs, y: p.tunedGbps })),
        borderColor: PALETTE.ink,
        backgroundColor: PALETTE.inkFill,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.2,
      },
      {
        label: 'kernel default (6 MiB)',
        data: c.points.map((p) => ({ x: p.rttMs, y: p.defaultGbps })),
        borderColor: PALETTE.quiet,
        borderDash: [4, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.2,
      },
      {
        label: 'your path',
        data: [
          { x: c.rttMs, y: 0 },
          { x: c.rttMs, y: c.linkGbps },
        ],
        borderColor: PALETTE.fit,
        borderDash: [2, 2],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        showLine: true,
      },
      {
        label: 'link speed',
        data: [
          { x: 0, y: c.linkGbps },
          { x: lastMs, y: c.linkGbps },
        ],
        borderColor: PALETTE.rule,
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        showLine: true,
      },
    ],
  }
})

// Text alternative for screen readers.
const summary = computed(() => {
  const c = curve.value
  return `Per-connection throughput chart: with a tcp_rmem max of ${formatBytes(c.bufMax)}, one connection reaches at most ${formatRate(c.reachBps)} at your ${c.rttMs} ms path, against a ${formatRate(c.linkBps)} link. The ceiling falls as the round-trip time grows.`
})

const chartOptions = computed(() => {
  const c = curve.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    animation: false,
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: c.points.at(-1).rttMs,
        title: { display: true, text: 'round-trip time (ms)' },
      },
      y: {
        type: 'linear',
        min: 0,
        max: c.linkGbps * 1.05,
        title: { display: true, text: 'one connection (Gbit/s)' },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => `RTT ${items[0].parsed.x} ms`,
          label: (item) => `${item.dataset.label}: ${formatRate(item.parsed.y * 1e9)}`,
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
    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-2">
      <dt>Bandwidth-delay product</dt>
      <dd class="font-mono text-ink">{{ formatBytes(curve.bdp) }}</dd>
      <dt>One connection at {{ curve.rttMs }} ms</dt>
      <dd class="font-mono text-ink">{{ formatRate(curve.reachBps) }}</dd>
    </dl>
  </div>
</template>
