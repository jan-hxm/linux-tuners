/**
 * System V IPC domain module. Bundles the defs and rules in this folder into
 * the generic TunerDomain shape. It has no graphs: these are ceilings on
 * objects programs create, and what they cost depends on how many exist.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, DB2_KERNEL_PARAMS } from './defs.js'
import { deriveDefaults, rangeFor, queueMemoryBytes, queueRamShare } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { formatBytes } from '@/core/formatting.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'shm',
    title: 'Shared memory',
    summary: 'How many System V segments may exist, and whether unused ones are removed.',
    keys: ['shmmni', 'shm_rmid_forced'],
  },
  {
    id: 'sem',
    title: 'Semaphores',
    summary: 'The four semaphore limits in kernel.sem.',
    keys: ['sem'],
  },
  {
    id: 'msg',
    title: 'Message queues',
    summary: 'How many queues may exist, the largest message, and how much one queue holds.',
    keys: ['msgmni', 'msgmax', 'msgmnb'],
  },
]

/**
 * Reference-drawer formula for the queue size, where the kernel memory full
 * queues would hold is the trade-off.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key !== 'msgmnb') return null
  return {
    title: 'Worst-case queue memory',
    lines: ['memory = msgmni × msgmnb, if every queue is full'],
    values: [
      { label: 'worst case now', v: formatBytes(queueMemoryBytes(params)) },
      { label: 'share of RAM', v: `${Math.round(queueRamShare(hardware, params) * 100)}%` },
    ],
  }
}

export const sysvIpcDomain = defineTuner({
  id: 'sysv-ipc',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-sysv-ipc-tuning.conf',
  formula,
  workloads: ['general', 'container', 'oracle', 'db2'],
  workloadField: 'workload',
  context: { badge: 'DB', label: 'Databases', url: DB2_KERNEL_PARAMS },
  contextApplies: (hw) => hw.workload === 'oracle' || hw.workload === 'db2',
  docsLabel: 'kernel docs',
  noteKey: 'dbNote',
  page: PAGE,
  about: ABOUT,
})
