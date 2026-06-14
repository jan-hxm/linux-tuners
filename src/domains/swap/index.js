/**
 * Swap-tuner domain module. Bundles the existing swap model + data into the
 * generic TunerDomain shape consumed by the store factory and shared UI
 * components. This file deliberately re-exports existing single-source modules
 * (calculations, validation, configOutput, parameterDefs, presets) rather than
 * moving them, so the swap unit tests keep importing them from their original
 * paths.
 */

import { DEFAULT_HARDWARE, PARAMETER_KEYS } from '@/model/parameters.js'
import { PARAMETER_DEFS_BY_KEY, K8S_BLOG } from '@/data/parameterDefs.js'
import {
  deriveDefaults,
  rangeFor,
  watermarkLevelsMiB,
} from '@/model/calculations.js'
import { validate, hasBlockingIssue } from '@/model/validation.js'
import { generateConfig } from '@/model/configOutput.js'
import { PRESETS, PRESETS_BY_ID } from '@/data/presets.js'
import { encodeState, decodeState } from '@/model/serialization.js'
import { formatValue } from '@/utils/formatting.js'

/** Card groupings (was hardcoded inside ParameterPanel). */
const SECTIONS = [
  {
    id: 'memory-reclaim',
    title: 'Memory reclaim & swap',
    summary: 'When does the kernel reclaim pages, and how aggressively does it swap?',
    keys: ['swappiness', 'min_free_kbytes', 'watermark_scale_factor', 'vfs_cache_pressure'],
  },
  {
    id: 'dirty-writeback',
    title: 'Dirty page writeback',
    summary: 'How long modified pages can stay in RAM before being flushed to disk.',
    keys: ['dirty_ratio', 'dirty_background_ratio', 'dirty_expire_centisecs', 'dirty_writeback_centisecs'],
  },
  {
    id: 'oom-overcommit',
    title: 'OOM & overcommit',
    summary: 'Allocation policy and what happens when the system runs out of memory.',
    keys: ['overcommit_memory', 'overcommit_ratio', 'panic_on_oom'],
  },
]

/**
 * Per-parameter "show me the formula" block for the reference drawer. Only the
 * two parameters with a genuinely useful derived formula return anything.
 * (Was hardcoded inside InfoDrawer.)
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/domains/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key === 'watermark_scale_factor') {
    const lv = watermarkLevelsMiB(hardware.ramGiB, params.min_free_kbytes, params.watermark_scale_factor)
    return {
      title: 'Watermark formula (whole-system view)',
      lines: [
        'window_pages = total_managed_pages × watermark_scale_factor / 10000',
        'low  = min + window',
        'high = low + window',
      ],
      values: [
        { label: 'min', v: `${lv.minMiB} MiB` },
        { label: 'low', v: `${lv.lowMiB} MiB` },
        { label: 'high', v: `${lv.highMiB} MiB` },
        { label: 'usable above high', v: `${lv.usableMiB} MiB` },
      ],
    }
  }
  if (def.key === 'overcommit_ratio') {
    const ramKb = hardware.ramGiB * 1024 * 1024
    const swapKb = hardware.swapGiB * 1024 * 1024
    const commitLimit = swapKb + (ramKb * params.overcommit_ratio) / 100
    return {
      title: 'CommitLimit formula (when overcommit_memory = 2)',
      lines: ['CommitLimit = swap + RAM × overcommit_ratio / 100'],
      values: [
        { label: 'CommitLimit', v: `${Math.round(commitLimit / 1024).toLocaleString()} MiB` },
      ],
    }
  }
  return null
}

/** @type {import('@/domains/types.js').TunerDomain} */
export const swapDomain = {
  id: 'swap',
  defaultHardware: DEFAULT_HARDWARE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue: (value, def, hw) => formatValue(value, def.unit, hw.ramGiB),
  sections: SECTIONS,
  visibleKeys: (section, params) =>
    section.id === 'oom-overcommit'
      ? section.keys.filter((k) => k !== 'overcommit_ratio' || params.overcommit_memory === 2)
      : section.keys,
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-swap-tuning.conf',
  encodeState,
  decodeState,
  defaultTab: 'pressure',
  workloads: ['k8s', 'database', 'general', 'desktop', 'embedded'],
  workloadField: 'workload',
  context: { badge: 'K8s', label: 'Kubernetes', url: K8S_BLOG },
  // The Kubernetes guidance only applies when the user is actually tuning a k8s node
  contextApplies: (hw) => hw.workload === 'k8s',
  docsLabel: 'kernel.org docs',
  noteKey: 'k8sNote',
  formula,
}
