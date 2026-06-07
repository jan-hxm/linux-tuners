/**
 * systemd-tuner domain module. Bundles the systemd model + data into the generic
 * TunerDomain shape consumed by the store factory and the shared UI components,
 * exactly like src/domains/swap/index.js.
 */

import { DEFAULT_SYSTEMD_SPEC, SYSTEMD_KEYS } from '@/model/systemd/parameters.js'
import { SYSTEMD_DEFS_BY_KEY, SYSTEMD_RESOURCE_DOCS } from '@/data/systemd/parameterDefs.js'
import { deriveDefaults, rangeFor, cpuQuotaNoLimit } from '@/model/systemd/calculations.js'
import { validate, hasBlockingIssue } from '@/model/systemd/validation.js'
import { generateConfig } from '@/model/systemd/configOutput.js'
import { SYSTEMD_PRESETS, SYSTEMD_PRESETS_BY_ID } from '@/data/systemd/presets.js'
import { formatValue } from '@/model/systemd/formatting.js'
import { makeSerialization } from '@/model/serialization.js'

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

const { encodeState, decodeState } = makeSerialization({
  parameterKeys: SYSTEMD_KEYS,
  defaultHardware: DEFAULT_SYSTEMD_SPEC,
})

/**
 * Reference-drawer formulas for the parameters where a derived number genuinely
 * helps. Returns null for the rest.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/domains/types.js').TunerFormula|null}
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

/** @type {import('@/domains/types.js').TunerDomain} */
export const systemdDomain = {
  id: 'systemd',
  defaultHardware: DEFAULT_SYSTEMD_SPEC,
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
  encodeState,
  decodeState,
  defaultTab: 'cpu',
  workloads: ['container-host', 'kubernetes', 'database', 'general', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'host', label: 'Container host', url: SYSTEMD_RESOURCE_DOCS },
  docsLabel: 'systemd docs',
  noteKey: 'contextNote',
  formula,
}
