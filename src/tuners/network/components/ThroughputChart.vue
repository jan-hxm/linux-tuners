<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { comparisonSeries, lineChartOptions, mainSeries, threshold, xStop } from '@/ui/charts/chartStyle.js'
import { useSeriesTone } from '@/ui/charts/useSeriesTone.js'
import { useActiveTuner } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import { formatBytes, formatRate } from '../formatting.js'
import * as simulation from '../simulation.js'

/** The parameter the tuned curve is drawn from. */
const KEYS = ['tcp_rmem']

const LEGEND = [
  { label: 'your path', tone: 'fit', kind: 'dash' },
  { label: 'link speed', tone: 'ink', kind: 'dash' },
]

const { throughputCurve: curve } = useTunerSimulation(useActiveTuner(), simulation)
const seriesTone = useSeriesTone(KEYS)

const chartData = computed(() => {
  const c = curve.value
  return {
    datasets: [
      mainSeries({
        label: 'tuned tcp_rmem max',
        data: c.points.map((p) => ({ x: p.rttMs, y: p.tunedGbps })),
        tone: seriesTone.value,
      }),
      comparisonSeries({
        label: 'kernel default (6 MiB)',
        data: c.points.map((p) => ({ x: p.rttMs, y: p.defaultGbps })),
        endLabel: 'kernel default',
      }),
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
  const capped = (gbps) => gbps >= c.linkGbps * 0.999
  return lineChartOptions({
    x: { min: 0, max: c.points.at(-1).rttMs, title: 'round trip, ms' },
    y: { min: 0, max: c.linkGbps * 1.05, format: (v) => `${v} Gbit/s` },
    zones: [threshold('x', c.rttMs, 'fit'), threshold('y', c.linkGbps, 'ink')],
    stops: c.points.map((p) =>
      xStop(p.rttMs, `At ${p.rttMs} ms round trip${p.rttMs === c.rttMs ? ', your path' : ''}`, [
        `${formatRate(p.tunedGbps * 1e9)}, default ${formatRate(p.defaultGbps * 1e9)}`,
        ...(capped(p.tunedGbps) ? ['the link is the limit'] : []),
      ]),
    ),
  })
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
