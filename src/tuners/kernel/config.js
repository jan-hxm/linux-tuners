/**
 * Generate the sysctl.d drop-in. Pure function over (hardware, params,
 * presetLabel). The ConfigOutput component renders the returned file verbatim
 * into the textarea; what's here is what the user copies.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { defaultTasksMax, isEmitted } from './calculations.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'

const PATH = '/etc/sysctl.d/99-kernel-tuning.conf'

const SECTIONS = [
  { id: 'procs', title: 'Processes & threads' },
  { id: 'keys', title: 'Key quotas' },
  { id: 'panic', title: 'Panics & SysRq' },
  { id: 'console', title: 'Console' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').KernelSpec} opts.hardware
 * @param {import('./defs.js').KernelValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []

  lines.push(rule())
  lines.push('# Linux kernel sysctls: process limits, key quotas, panics, console')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/kernel`)
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
  lines.push(`#      sysctl ${PARAMETER_DEFS.filter((d) => isEmitted(d.key, hardware, params)).map((d) => d.sysctlName).join(' ')}`)
  lines.push('#')
  lines.push(...noteBlock(hardware, params))
  lines.push('# Sources:')
  lines.push('#   kernel sysctls: https://docs.kernel.org/admin-guide/sysctl/kernel.html')
  lines.push('#   key quotas:     https://docs.kernel.org/security/keys/core.html')
  lines.push('')

  lines.push(...sysctlConfig({
    defs: PARAMETER_DEFS,
    sections: SECTIONS,
    params,
    comment: (def, value) => commentFor(def, value),
    include: (def) => isEmitted(def.key, hardware, params),
  }))

  return [configFile(PATH, lines)]
}

/** What the file leaves out, and how the keys reach other limits. */
function noteBlock(hw, p) {
  const groups = []
  if (hw.systemd === 'modern') {
    groups.push([
      '# kernel.pid_max is left out: systemd 243 and newer raise it to',
      '# 4194304, the most the kernel takes on 64-bit, at boot.',
    ])
  }
  if (isEmitted('threads_max', hw, p)) {
    groups.push([
      '# systemd sets each service\'s default TasksMax to 15% of the smaller',
      `# of kernel.pid_max and kernel.threads-max, ${defaultTasksMax(hw, p)} here, when it starts:`,
      '# after a reboot, or now with sudo systemctl daemon-reexec.',
    ])
  } else {
    groups.push([
      '# kernel.threads-max is left out at the kernel\'s own value, about',
      '# one thread per 128 KiB of RAM.',
    ])
  }
  groups.push([
    '# kernel.panic decides whether a panic ends in a reboot, including the',
    '# panics vm.panic_on_oom asks for.',
  ])
  groups.push([
    '# kernel.sysrq covers the keyboard and serial console only: root can',
    '# trigger every function through /proc/sysrq-trigger at any setting.',
  ])
  groups.push([
    '# kernel.printk only decides what reaches the console: dmesg and the',
    '# journal keep every message.',
  ])
  return ['# NOTES', '#', ...groups.flatMap((g, i) => (i ? ['#', ...g] : g)), '#', rule(), '#']
}

/** @param {import('./profile.js').KernelSpec} hw */
function describeSystem(hw) {
  const label = (key, value) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === value).label
  return `${label('workload', hw.workload)}, ${hw.ramGiB} GiB RAM, systemd ${label('systemd', hw.systemd)}`
}

/**
 * The inline comment for each value in the output file.
 *
 * @param {Object} def
 * @param {number|number[]|string} value
 */
function commentFor(def, value) {
  switch (def.key) {
    case 'pid_max':
      return 'highest PID plus one'
    case 'threads_max':
      return 'threads system-wide'
    case 'maxkeys':
      return 'keys per non-root user'
    case 'maxbytes':
      return 'key bytes per non-root user'
    case 'panic':
      return value === 0 ? 'stay down after a panic' : `reboot ${value} s after a panic`
    case 'panic_on_oops':
      return value === 1 ? 'an oops panics' : 'an oops kills the task'
    case 'softlockup_panic':
      return value === 1 ? 'a soft lockup panics' : 'a soft lockup is logged'
    case 'sysrq':
      return 'SysRq functions allowed (bitmask)'
    case 'printk':
      return `console shows levels below ${value[0]}`
    default:
      return ''
  }
}
