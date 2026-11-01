/**
 * Block I/O domain module. Bundles the defs and rules in this folder into the
 * generic TunerDomain shape. It has no graphs: the effect of a scheduler or a
 * read-ahead window depends on the device's firmware and the workload, which
 * no formula here can model honestly.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, BFQ_DOCS } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable, schedulerRequests } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'device',
    title: 'Device type',
    summary: 'What the kernel believes about a virtual disk.',
    keys: ['rotational'],
  },
  {
    id: 'sched',
    title: 'I/O scheduler',
    summary: 'Who orders the requests, and how many may wait.',
    keys: ['scheduler', 'nr_requests'],
  },
  {
    id: 'reads',
    title: 'Read-ahead & merging',
    summary: 'How far ahead sequential reads go, and whether neighbouring requests merge.',
    keys: ['read_ahead_kb', 'nomerges'],
  },
]

/**
 * Reference-drawer formula for nr_requests: what the kernel starts it at.
 *
 * @param {Object} def
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def) {
  if (def.key !== 'nr_requests') return null
  return {
    title: 'The kernel\'s own value',
    lines: ['nr_requests = 2 × min(queue depth, 128), once a scheduler is set'],
    values: [
      { label: 'SATA (queue depth 32)', v: String(schedulerRequests(32)) },
      { label: 'virtio (256)', v: String(schedulerRequests(256)) },
      { label: 'NVMe (1023)', v: String(schedulerRequests(1023)) },
    ],
  }
}

export const blockIoDomain = defineTuner({
  id: 'block-io',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  visibleKeys: (section, params, hw) => section.keys.filter((k) => isApplicable(k, hw, params)),
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-block-tuning.rules',
  formula,
  workloads: ['server', 'database', 'streaming', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'BFQ', label: 'Desktops', url: BFQ_DOCS },
  contextApplies: (hw) => hw.workload === 'desktop',
  docsLabel: 'kernel docs',
  noteKey: 'desktopNote',
  page: PAGE,
  about: ABOUT,
})
