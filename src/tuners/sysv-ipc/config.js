/**
 * Generate the sysctl.d drop-in. Pure function over (hardware, params,
 * presetLabel). The ConfigOutput component renders the returned file verbatim
 * into the textarea; what's here is what the user copies.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { queueMemoryBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { undoComment } from '@/core/output/installSteps.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'

const PATH = '/etc/sysctl.d/99-sysv-ipc-tuning.conf'

const SECTIONS = [
  { id: 'shm', title: 'Shared memory' },
  { id: 'sem', title: 'Semaphores' },
  { id: 'msg', title: 'Message queues' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').IpcSpec} opts.hardware
 * @param {import('./defs.js').IpcValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []

  lines.push(rule())
  lines.push('# Linux System V IPC sysctls: shared memory, semaphores, message queues')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/sysv-ipc`)
  lines.push(`# System: ${describeSystem(hardware)}`)
  lines.push(`# Profile: ${presetSummary(presetLabel, customised)}`)
  lines.push(rule())
  lines.push('#')
  lines.push('# HOW TO APPLY THESE SETTINGS')
  lines.push('#')
  lines.push('# 1. Persist them. Save this whole file as a drop-in (sysctl ignores')
  lines.push('#    the comment lines, and any *.conf in /etc/sysctl.d/ loads on boot):')
  lines.push(`#      sudo nano ${PATH}   # then paste this file`)
  lines.push('#')
  lines.push('# 2. Apply them now, without rebooting:')
  lines.push('#      sudo sysctl --system')
  lines.push('#')
  lines.push('# 3. Verify they took effect:')
  lines.push('#      ipcs -l')
  lines.push('#')
  lines.push(...undoComment([PATH]), '#')
  lines.push(...noteBlock(hardware))
  lines.push('# Sources:')
  lines.push('#   kernel sysctls: https://docs.kernel.org/admin-guide/sysctl/kernel.html')
  lines.push('#   kernel.sem: https://man7.org/linux/man-pages/man5/proc_sys_kernel.5.html')
  lines.push('')

  lines.push(...sysctlConfig({
    defs: PARAMETER_DEFS,
    sections: SECTIONS,
    params,
    comment: (def, value) => commentFor(def, value, params),
    include: () => true,
  }))

  return [configFile(PATH, lines)]
}

/** What the file leaves out, why it writes the defaults, and where it doesn't reach. */
function noteBlock(hw) {
  const groups = [
    [
      '# kernel.shmmax and kernel.shmall are left out: since kernel 3.16 both',
      '# default to 18446744073692774399, no limit, and any value lowers them.',
    ],
    [
      '# Every key is written, at the kernel default too. sysctl.d files load',
      '# in name order and a 99- file after most others, so this one undoes',
      '# lower values an older guide left in another file. Check for those:',
      '#   grep -rs "kernel\\.\\(shm\\|sem\\|msg\\)" /etc/sysctl.conf /etc/sysctl.d',
    ],
  ]
  if (hw.workload === 'oracle') {
    groups.push([
      '# Oracle\'s minimums (kernel.sem 250 32000 100 128, kernel.shmmni 4096)',
      '# are all at or below the kernel defaults, so none is raised here.',
    ])
  }
  if (hw.workload === 'db2') {
    groups.push([
      '# Db2 raises these to its minimums when an instance starts, but not at',
      '# boot; this file makes them hold from boot.',
    ])
  }
  groups.push([
    '# Each container gets its own IPC namespace, which starts at the kernel',
    '# defaults, not at these values: set them per container instead.',
  ])
  return ['# NOTES', '#', ...groups.flatMap((g, i) => (i ? ['#', ...g] : g)), '#', rule(), '#']
}

/** @param {import('./profile.js').IpcSpec} hw */
function describeSystem(hw) {
  const label = PROFILE.fields.find((f) => f.key === 'workload').options.find((o) => o.value === hw.workload).label
  return `${label}, ${hw.ramGiB} GiB RAM`
}

/**
 * The inline comment for each value in the output file.
 *
 * @param {Object} def
 * @param {number|number[]} value
 * @param {import('./defs.js').IpcValues} params
 */
function commentFor(def, value, params) {
  switch (def.key) {
    case 'shmmni':
      return 'shared memory segments system-wide'
    case 'shm_rmid_forced':
      return value === 1 ? 'remove segments no process uses' : 'segments stay until removed'
    case 'sem':
      return 'per array, system-wide, ops per semop(), arrays'
    case 'msgmni':
      return 'message queues system-wide'
    case 'msgmax':
      return 'largest message in bytes'
    case 'msgmnb':
      return `bytes per queue, up to ${formatBytes(queueMemoryBytes(params))} if every queue fills`
    default:
      return ''
  }
}
