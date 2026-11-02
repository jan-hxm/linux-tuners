/**
 * Filesystem and file-descriptor domain module. Bundles the defs and rules in
 * this folder into the generic TunerDomain shape. It has no graphs: these are
 * ceilings, and what they cost depends on how much of them is used.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, KIND_KNOWN_ISSUES } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable, kernelWatches, watchMemoryBytes, WATCH_COST_BYTES } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { formatBytes } from '@/core/formatting.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'descriptors',
    title: 'File descriptors',
    summary: 'How many files the whole system, and any one process, may have open.',
    keys: ['file_max', 'nr_open'],
  },
  {
    id: 'inotify',
    title: 'inotify file watching',
    summary: 'The limits IDEs, dev servers, file sync and Kubernetes nodes run into when they watch files for changes.',
    keys: ['max_user_watches', 'max_user_instances', 'max_queued_events'],
  },
  {
    id: 'aio',
    title: 'Asynchronous I/O',
    summary: 'Request slots for databases that use Linux native AIO.',
    keys: ['aio_max_nr'],
  },
]

/**
 * Reference-drawer formula for the watch limit, where the memory cost is the
 * trade-off.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key !== 'max_user_watches') return null
  return {
    title: 'Worst-case watch memory',
    lines: [
      `memory ≈ watches × ${WATCH_COST_BYTES} B (one watch with its inode)`,
      'kernel 5.11+ default ≈ 1% of RAM / cost, 8192 to 1048576',
    ],
    values: [
      { label: 'kernel default here', v: kernelWatches(hardware).toLocaleString() },
      { label: 'worst case now', v: formatBytes(watchMemoryBytes(params.max_user_watches)) },
    ],
  }
}

export const filesystemDomain = defineTuner({
  id: 'filesystem',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  visibleKeys: (section, _params, hw) => section.keys.filter((k) => isApplicable(k, hw)),
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-filesystem-tuning.conf',
  formula,
  // Left out at 1048576, where Debian 13 and Fedora start higher, so this is
  // the least the machine runs with.
  facts: (_hw, p) => ({ nrOpen: p.nr_open }),
  workloads: ['server', 'database', 'container', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'K8s', label: 'Kubernetes', url: KIND_KNOWN_ISSUES },
  contextApplies: (hw) => hw.workload === 'container',
  docsLabel: 'kernel docs',
  noteKey: 'k8sNote',
  page: PAGE,
  about: ABOUT,
})
