/**
 * Teaching-model simulations for the systemd tuner, mirroring the swap tuner's
 * simulation.js (pure functions over hardware + params, consumed reactively by
 * the chart components). Each is a simplified but faithful illustration of a
 * real cgroup v2 mechanism, not an exact predictor.
 */

import { cpuQuotaNoLimit } from './calculations.js'

const TARGET_COLOR = '#0f172a' // slate-900
const SIBLING_COLOR = '#cbd5e1' // slate-300

const TOP_LEVEL_SLICES = ['system.slice', 'user.slice', 'machine.slice']

/**
 * Proportional CPU distribution under full contention. cgroup v2 splits a
 * saturated CPU between sibling slices in proportion to cpu.weight. Every
 * top-level slice defaults to weight 100; the tuned slice uses cpu_weight.
 *
 * @param {import('./parameters.js').SystemdSpec} hw
 * @param {import('./parameters.js').SystemdValues} p
 */
export function cpuShares(hw, p) {
  const weights = TOP_LEVEL_SLICES.map((slice) => ({
    slice,
    weight: slice === hw.targetSlice ? p.cpu_weight : 100,
    isTarget: slice === hw.targetSlice,
  }))
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  const segments = weights.map((w) => ({
    ...w,
    pct: Math.round((w.weight / total) * 1000) / 10,
    color: w.isTarget ? TARGET_COLOR : SIBLING_COLOR,
  }))
  const targetPct = segments.find((s) => s.isTarget)?.pct ?? 0

  // A hard CPUQuota caps the slice regardless of weight — surface it as context.
  const quotaCores = p.cpu_quota < cpuQuotaNoLimit(hw) ? p.cpu_quota / 100 : null

  return { segments, targetPct, quotaCores, cores: hw.cpuCores }
}

/**
 * Memory budget for the tuned slice as a stacked bar over total RAM. MemoryHigh
 * is the soft throttle line, MemoryMax the hard OOM cap; both are percentages of
 * RAM here (100 = infinity / unset).
 *
 * @param {import('./parameters.js').SystemdSpec} hw
 * @param {import('./parameters.js').SystemdValues} p
 */
export function memoryBudget(hw, p) {
  const totalMiB = hw.ramGiB * 1024
  const pctToMiB = (pct) => Math.round((totalMiB * pct) / 100)

  const throttleStart = p.memory_high < 100 ? p.memory_high : null
  const hardCap = p.memory_max < 100 ? p.memory_max : null

  /** @type {{label:string, mib:number, color:string}[]} */
  const segments = []
  // Normal-use zone: up to the first limit we encounter.
  const normalEndPct = throttleStart ?? hardCap ?? 100
  segments.push({ label: 'normal use', mib: pctToMiB(normalEndPct), color: '#10b981' }) // emerald-500

  // Throttle band between MemoryHigh and MemoryMax (or RAM top).
  if (throttleStart !== null) {
    const bandEndPct = hardCap ?? 100
    if (bandEndPct > throttleStart) {
      segments.push({ label: 'throttle (MemoryHigh→Max)', mib: pctToMiB(bandEndPct - throttleStart), color: '#f59e0b' }) // amber-500
    }
  }

  // Above the hard cap: unavailable to the slice (OOM territory).
  if (hardCap !== null && hardCap < 100) {
    segments.push({ label: 'above MemoryMax (OOM)', mib: pctToMiB(100 - hardCap), color: '#dc2626' }) // red-600
  }

  return {
    segments,
    totalMiB,
    throttleStart,
    hardCap,
    noLimits: throttleStart === null && hardCap === null,
  }
}

/**
 * Task-cap headroom: the slice TasksMax and the per-unit DefaultTasksMax as a
 * fraction of the kernel PID space (kernel.pid_max).
 *
 * @param {import('./parameters.js').SystemdSpec} hw
 * @param {import('./parameters.js').SystemdValues} p
 */
export function tasksUsage(hw, p) {
  const bars = [
    { label: 'TasksMax (slice)', value: p.tasks_max },
    { label: 'DefaultTasksMax (per unit)', value: p.default_tasks_max },
  ].map((b) => ({ ...b, pct: Math.round((b.value / hw.pidMax) * 1000) / 10 }))
  return { bars, pidMax: hw.pidMax, nofileHard: p.default_limit_nofile_hard, nofileSoft: p.default_limit_nofile_soft }
}

/**
 * Three at-a-glance impact metrics for the cards under the chart.
 *
 * @param {import('./parameters.js').SystemdSpec} hw
 * @param {import('./parameters.js').SystemdValues} p
 * @returns {{id:string,label:string,value:string,band:string}[]}
 */
export function impactSummary(hw, p) {
  const { targetPct } = cpuShares(hw, p)
  const memValue = p.memory_max >= 100
    ? 'no hard limit'
    : `${p.memory_max}% (${((hw.ramGiB * p.memory_max) / 100).toFixed(1)} GiB)`
  const memBand = p.memory_max >= 100 ? 'none' : p.memory_max < 50 ? 'high' : 'med'
  const tasksBand = p.tasks_max < hw.pidMax * 0.05 ? 'med' : 'none'

  return [
    { id: 'cpu', label: `${hw.targetSlice} CPU share`, value: `${targetPct}% contended`, band: 'none' },
    { id: 'mem', label: 'Memory hard cap', value: memValue, band: memBand },
    { id: 'tasks', label: 'Slice task cap', value: p.tasks_max.toLocaleString(), band: tasksBand },
  ]
}
