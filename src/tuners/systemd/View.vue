<script setup>
import TunerPage from '@/ui/TunerPage.vue'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import SystemProfileForm from './components/SystemProfileForm.vue'
import CpuShareChart from './components/CpuShareChart.vue'
import MemoryBudgetChart from './components/MemoryBudgetChart.vue'
import TasksChart from './components/TasksChart.vue'
import { useSystemdStore } from './store.js'
import { systemdDomain } from './index.js'
import * as simulation from './simulation.js'

const tuner = useSystemdStore()
// Pass the store explicitly: TunerPage provides it below this view, so it
// can't be injected here.
const { impactSummary: impact } = useTunerSimulation(tuner, simulation)

const GRAPH_TABS = [
  { id: 'cpu', label: 'CPU shares', component: CpuShareChart, blurb: 'How CPUWeight splits a saturated CPU between this slice and its siblings.' },
  { id: 'memory', label: 'Memory budget', component: MemoryBudgetChart, blurb: 'MemoryHigh throttle band and the MemoryMax hard cap, against total RAM.' },
  { id: 'tasks', label: 'Task & FD caps', component: TasksChart, blurb: 'TasksMax and DefaultTasksMax as a share of the kernel PID space.' },
]
</script>

<template>
  <TunerPage :store="tuner" :domain="systemdDomain" :graph-tabs="GRAPH_TABS" :impact="impact">
    <template #profile><SystemProfileForm /></template>
  </TunerPage>
</template>
