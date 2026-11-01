/**
 * systemd-tuner domain module. Bundles the systemd model + data into the generic
 * TunerDomain shape consumed by the store factory and the shared UI components,
 * exactly like src/tuners/swap/index.js.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { SYSTEMD_KEYS, SYSTEMD_DEFS_BY_KEY, SYSTEMD_RESOURCE_DOCS } from './defs.js'
import { deriveDefaults, rangeFor, cpuQuotaNoLimit, hasCpuAccountingOption, hasSwapControl } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { SYSTEMD_PRESETS, SYSTEMD_PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { PAGE, ABOUT } from './about.js'
import * as simulation from './simulation.js'
import CpuShareChart from './components/CpuShareChart.vue'
import MemoryBudgetChart from './components/MemoryBudgetChart.vue'
import TasksChart from './components/TasksChart.vue'

const SECTIONS = [
  {
    id: 'manager-defaults',
    title: 'Manager defaults (system.conf)',
    summary: 'System-wide defaults every unit inherits: accounting, the task cap, and rlimits.',
    keys: [
      'default_cpu_accounting',
      'default_memory_accounting',
      'default_io_accounting',
      'default_tasks_accounting',
      'default_ip_accounting',
      'default_tasks_max',
      'default_limit_nofile_soft',
      'default_limit_nofile_hard',
      'default_limit_memlock',
    ],
  },
  {
    id: 'slice-resources',
    title: 'Slice resource control',
    summary: 'cgroup v2 CPU / memory / I/O / task controls applied to the chosen slice.',
    keys: ['cpu_weight', 'cpu_quota', 'memory_high', 'memory_max', 'memory_swap_max', 'io_weight', 'tasks_max'],
  },
]

const GRAPH_TABS = [
  { id: 'cpu', label: 'CPU shares', component: CpuShareChart, blurb: 'How CPUWeight splits a saturated CPU between this slice and its siblings.' },
  { id: 'memory', label: 'Memory budget', component: MemoryBudgetChart, blurb: 'MemoryHigh throttle band and the MemoryMax hard cap, against total RAM.' },
  { id: 'tasks', label: 'Task & FD caps', component: TasksChart, blurb: 'TasksMax and DefaultTasksMax as a share of the kernel PID space.' },
]

/**
 * Reference-drawer formulas for the parameters where a derived number genuinely
 * helps. Returns null for the rest.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key === 'memory_high' || def.key === 'memory_max') {
    const toGiB = (pct) => (pct >= 100 ? 'infinity' : `${((hardware.ramGiB * pct) / 100).toFixed(2)} GiB`)
    return {
      title: 'Memory budget (percent of RAM → bytes)',
      lines: ['limit_bytes = RAM × percent / 100', `RAM = ${hardware.ramGiB} GiB`],
      values: [
        { label: 'MemoryHigh', v: toGiB(params.memory_high) },
        { label: 'MemoryMax', v: toGiB(params.memory_max) },
        { label: 'MemorySwapMax', v: params.memory_swap_max === 0 ? '0 (no swap)' : toGiB(params.memory_swap_max) },
      ],
    }
  }
  if (def.key === 'cpu_weight') {
    // Share against two sibling slices at the default weight 100.
    const total = params.cpu_weight + 100 + 100
    const pct = Math.round((params.cpu_weight / total) * 1000) / 10
    return {
      title: 'Contended CPU share (vs 2 sibling slices at weight 100)',
      lines: ['share = weight / Σ sibling weights'],
      values: [
        { label: 'this slice', v: `${pct}%` },
        { label: 'each sibling', v: `${Math.round((100 / total) * 1000) / 10}%` },
      ],
    }
  }
  if (def.key === 'cpu_quota') {
    return {
      title: 'CPUQuota (percent → cores)',
      lines: ['cores = CPUQuota% / 100', `no-limit at ${cpuQuotaNoLimit(hardware)}% (${hardware.cpuCores} cores)`],
      values: [
        { label: 'cap', v: params.cpu_quota >= cpuQuotaNoLimit(hardware) ? 'no limit' : `${(params.cpu_quota / 100).toFixed(1)} cores` },
      ],
    }
  }
  if (def.key === 'default_tasks_max' || def.key === 'tasks_max') {
    const pct = Math.round((params[def.key] / hardware.pidMax) * 1000) / 10
    return {
      title: 'Task cap as a share of the PID space',
      lines: ['share = value / kernel.pid_max', `kernel.pid_max = ${hardware.pidMax.toLocaleString()}`],
      values: [{ label: 'share of pid_max', v: `${pct}%` }],
    }
  }
  return null
}

export const systemdDomain = defineTuner({
  id: 'systemd',
  profile: PROFILE,
  parameterKeys: SYSTEMD_KEYS,
  defsByKey: SYSTEMD_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  presets: SYSTEMD_PRESETS,
  presetsById: SYSTEMD_PRESETS_BY_ID,
  generateConfig,
  outputFilename: 'systemd-resource-tuning.conf',
  defaultTab: 'cpu',
  graphTabs: GRAPH_TABS,
  visibleKeys: (section, _params, hw) =>
    section.keys.filter((k) =>
      (k !== 'default_cpu_accounting' || hasCpuAccountingOption(hw)) && (k !== 'memory_swap_max' || hasSwapControl(hw))),
  simulation,
  workloads: ['container-host', 'kubernetes', 'database', 'general', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'host', label: 'Container host', url: SYSTEMD_RESOURCE_DOCS },
  docsLabel: 'systemd docs',
  noteKey: 'contextNote',
  formula,
  page: PAGE,
  about: ABOUT,
})
