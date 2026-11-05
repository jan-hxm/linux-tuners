<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartFrame from '@/ui/charts/ChartFrame.vue'
import ChartLegend from '@/ui/charts/ChartLegend.vue'
import { band, comparisonSeries, hatchZone, lineChartOptions, mainSeries, ownerLabel, xStop } from '@/ui/charts/chartStyle.js'
import { useSeriesTone } from '@/ui/charts/useSeriesTone.js'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import * as simulation from '../simulation.js'

/** The parameters the curve is drawn from. */
const KEYS = ['swappiness', 'min_free_kbytes', 'watermark_scale_factor']

const LEGEND = [
  { label: 'kswapd band', tone: 'quiet', kind: 'band' },
  { label: 'direct reclaim, OOM risk', tone: 'error', kind: 'hatch' },
]

const store = useActiveTuner()
const domain = useTunerDomain()
const { pressureCurve: pressure } = useTunerSimulation(store, simulation)
const seriesTone = useSeriesTone(KEYS)

// The same curve with the kernel's defaults, for comparison; not drawn while
// it is the same curve.
const stock = computed(() => {
  const params = { ...store.params }
  for (const k of KEYS) params[k] = domain.defsByKey[k].kernelDefault
  return simulation.pressureCurve(store.hardware, params)
})
const showStock = computed(() => stock.value.points.some((pt, i) => pt.swapUsage !== pressure.value.points[i]?.swapUsage))

const pct = (v) => `${Math.round(v)}%`

// Which part of the curve a memory fill falls in, in plain words.
function zoneAt(fill, p) {
  if (p.noSwap) return 'Swap is off, so nothing is swapped.'
  if (fill < p.highFillPct) return 'Below the kswapd band: memory is free, little swapping.'
  if (fill < p.lowFillPct) return 'In the kswapd band: kswapd reclaims in the background.'
  if (fill < p.minFillPct) return 'Past the low watermark: reclaim gets harder.'
  return 'Past the min watermark: direct reclaim stalls programs, OOM risk.'
}

const chartData = computed(() => {
  const p = pressure.value
  const datasets = [
    mainSeries({
      label: 'swap use',
      data: p.points.map((pt) => ({ x: pt.memFill, y: pt.swapUsage })),
      tone: seriesTone.value,
      endLabel: `${ownerLabel(seriesTone.value)}: ${store.params.swappiness}`,
    }),
  ]
  if (showStock.value) {
    datasets.push(
      comparisonSeries({
        label: 'kernel default',
        data: stock.value.points.map((pt) => ({ x: pt.memFill, y: pt.swapUsage })),
        endLabel: `kernel default ${domain.defsByKey.swappiness.kernelDefault}`,
      }),
    )
  }
  return { datasets }
})

// Text alternative for screen readers (the <canvas> itself is opaque to AT).
const summary = computed(() => {
  const p = pressure.value
  if (p.noSwap) {
    return 'Swap pressure chart: swap is disabled, so estimated swap usage stays at 0% across all memory fill levels.'
  }
  return (
    `Swap pressure chart: estimated swap usage stays near zero until about ${p.highFillPct.toFixed(0)}% memory fill, ` +
    `then ramps up through the kswapd band, climbing steeply past the low watermark near ${p.lowFillPct.toFixed(0)}% ` +
    `and approaching direct reclaim and OOM around ${p.minFillPct.toFixed(0)}%.`
  )
})

const chartOptions = computed(() => {
  const p = pressure.value
  const stockPoints = stock.value.points
  return lineChartOptions({
    x: { min: 0, max: 100, title: 'memory fill', stepSize: 20, format: pct },
    y: { min: 0, max: 100, title: 'swap in use', stepSize: 25, format: pct },
    zones: [band('x', p.highFillPct, p.lowFillPct), hatchZone('x', p.minFillPct, 100)],
    stops: p.points.map((pt, i) =>
      xStop(pt.memFill, `At ${pct(pt.memFill)} memory fill`, [
        `${pct(pt.swapUsage)} of swap in use`,
        ...(showStock.value ? [`Kernel default: ${pct(stockPoints[i].swapUsage)}`] : []),
        zoneAt(pt.memFill, p),
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
    <p v-if="pressure.noSwap" class="flex gap-1.5 text-[13px] text-mine-text">
      <span aria-hidden="true" class="font-mono">!</span>Swap disabled, so the curve stays at 0.
    </p>
  </div>
</template>
