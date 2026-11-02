/**
 * Kernel domain module. Bundles the defs and rules in this folder into the
 * generic TunerDomain shape. It has no graphs: these are ceilings and crash
 * switches, and what they cost depends on what goes wrong.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, LXD_SERVER_SETTINGS } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable, defaultTasksMax, effectivePidMax, kernelThreads, threadStackRamShare } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'procs',
    title: 'Processes & threads',
    summary: 'How many processes and threads may exist at once.',
    keys: ['pid_max', 'threads_max'],
  },
  {
    id: 'keys',
    title: 'Key quotas',
    summary: 'How many kernel keys each non-root user, and so each container, may hold.',
    keys: ['maxkeys', 'maxbytes'],
  },
  {
    id: 'panic',
    title: 'Panics & SysRq',
    summary: 'What the kernel does after a crash, and what the SysRq keys may do.',
    keys: ['panic', 'panic_on_oops', 'softlockup_panic', 'sysrq'],
  },
  {
    id: 'console',
    title: 'Console',
    summary: 'Which kernel messages are printed on the console.',
    keys: ['printk'],
  },
]

/**
 * Reference-drawer formula for threads-max, where systemd's per-service task
 * cap and the kernel stack memory are the trade-off.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key !== 'threads_max') return null
  return {
    title: 'Threads, stacks and TasksMax',
    lines: [
      'kernel default ≈ RAM / (8 × 16 KiB stack)',
      'DefaultTasksMax = 15% × min(pid_max, threads-max)',
    ],
    values: [
      { label: 'kernel default', v: kernelThreads(hardware).toLocaleString() },
      { label: 'stacks if all exist', v: `${Math.round(threadStackRamShare(hardware, params) * 100)}% of RAM` },
      { label: 'DefaultTasksMax', v: defaultTasksMax(hardware, params).toLocaleString() },
    ],
  }
}

export const kernelDomain = defineTuner({
  id: 'kernel',
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
  outputFilename: '99-kernel-tuning.conf',
  formula,
  // The values the machine runs with: systemd 243+ sets pid_max at boot, and
  // threads-max is never below the kernel's own value.
  facts: (hw, p) => ({ pidMax: effectivePidMax(hw, p), threadsMax: p.threads_max }),
  workloads: ['server', 'container', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'LXD', label: 'Container hosts', url: LXD_SERVER_SETTINGS },
  contextApplies: (hw) => hw.workload === 'container',
  docsLabel: 'kernel docs',
  noteKey: 'containerNote',
  page: PAGE,
  about: ABOUT,
})
