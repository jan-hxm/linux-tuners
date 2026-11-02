/**
 * Generate the sysctl.d drop-in. Pure function over (hardware, params,
 * presetLabel). The ConfigOutput component renders the returned file verbatim
 * into the textarea; what's here is what the user copies.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { isEmitted, watchMemoryBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { undoComment } from '@/core/output/installSteps.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'

const PATH = '/etc/sysctl.d/99-filesystem-tuning.conf'

const SECTIONS = [
  { id: 'descriptors', title: 'File descriptors' },
  { id: 'inotify', title: 'inotify file watching' },
  { id: 'aio', title: 'Asynchronous I/O' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').FilesystemSpec} opts.hardware
 * @param {import('./defs.js').FilesystemValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []

  lines.push(rule())
  lines.push('# Linux filesystem and file-descriptor sysctls')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/filesystem`)
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
  lines.push('# 3. Verify a value took effect:')
  lines.push('#      sysctl fs.inotify.max_user_watches')
  lines.push('#')
  lines.push(...undoComment([PATH]), '#')
  lines.push(...noteBlock(hardware, params))
  lines.push('# Sources:')
  lines.push('#   fs sysctls: https://docs.kernel.org/admin-guide/sysctl/fs.html')
  lines.push('#   inotify limits: https://man7.org/linux/man-pages/man7/inotify.7.html')
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

/**
 * What the file leaves out and why, and the check that goes with a raised
 * fs.nr_open: units asking for more than it fail to start.
 */
function noteBlock(hw, params) {
  const notes = []
  if (hw.systemd === 'modern') {
    notes.push(
      '# fs.file-max is left out: systemd 240 and newer raise it to',
      '# 9223372036854775807, the maximum, at boot, and a value here would',
      '# lower it.',
    )
  }
  if (!isEmitted('nr_open', hw, params)) {
    if (notes.length) notes.push('#')
    notes.push(
      '# fs.nr_open is left out at the kernel default, 1048576, so systems',
      '# where systemd starts it higher (Debian 13, Fedora) keep their value.',
    )
  } else {
    if (notes.length) notes.push('#')
    notes.push(
      '# A unit asking for more than fs.nr_open with LimitNOFILE= gets less.',
      '# Where systemd raised fs.nr_open at boot (Debian 13, Fedora) and this',
      '# file lowers it, such a unit fails to start instead (status 205).',
      '# Check what your units ask for:',
      '#   grep -rs LimitNOFILE= /etc/systemd /usr/lib/systemd /lib/systemd',
    )
  }
  notes.push(
    '#',
    '# The inotify limits count per user ID: every process of one user,',
    '# containers running as that user included, shares them.',
  )
  return ['# NOTES', '#', ...notes, '#', rule(), '#']
}

/** @param {import('./profile.js').FilesystemSpec} hw */
function describeSystem(hw) {
  const label = (key) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === hw[key]).label
  return `${label('workload')}, ${hw.ramGiB} GiB RAM, systemd ${label('systemd')}`
}

/**
 * The inline comment for each value in the output file.
 *
 * @param {Object} def
 * @param {number} value
 */
function commentFor(def, value) {
  switch (def.key) {
    case 'file_max':
      return 'open files across all processes'
    case 'nr_open':
      return 'highest open-file limit a process may be given'
    case 'max_user_watches':
      return `inotify watches per user, up to about ${formatBytes(watchMemoryBytes(value))} of kernel memory`
    case 'max_user_instances':
      return 'inotify instances per user'
    case 'max_queued_events':
      return 'events queued per inotify instance before overflow'
    case 'aio_max_nr':
      return 'native AIO requests across all processes'
    default:
      return ''
  }
}
