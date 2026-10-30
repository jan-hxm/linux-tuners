<script setup>
import TunerPage from '@/ui/TunerPage.vue'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import HardwareForm from './components/HardwareForm.vue'
import PressureChart from './components/PressureChart.vue'
import WatermarkChart from './components/WatermarkChart.vue'
import DirtyChart from './components/DirtyChart.vue'
import { useTunerStore } from './store.js'
import { swapDomain } from './index.js'
import * as simulation from './simulation.js'

const tuner = useTunerStore()
// Pass the store explicitly: TunerPage provides it below this view, so it
// can't be injected here.
const { impactSummary: impact } = useTunerSimulation(tuner, simulation)

const GRAPH_TABS = [
  { id: 'pressure', label: 'Swap pressure', component: PressureChart, blurb: 'How swap usage grows as memory fills, given current swappiness and watermarks.' },
  { id: 'watermarks', label: 'Watermark zones', component: WatermarkChart, blurb: 'min → low → high → usable breakdown of the kernel zone structure.' },
  { id: 'dirty', label: 'Dirty writeback', component: DirtyChart, blurb: 'Dirty page accumulation under a synthetic constant write workload.' },
]
</script>

<template>
  <TunerPage :store="tuner" :domain="swapDomain" :graph-tabs="GRAPH_TABS" :impact="impact">
    <template #profile><HardwareForm /></template>
  </TunerPage>
</template>
