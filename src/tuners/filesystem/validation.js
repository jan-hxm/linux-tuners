/**
 * Cross-parameter and profile-aware notes. The ranges start where lower
 * values would make programs fail, so nothing here blocks the output: costly
 * or surprising settings are warnings, and distribution behaviour is an info
 * note.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {string}   [fix]     What to change to resolve it, in one plain sentence
 * @property {boolean}  blocking  Always false here
 */

import { NR_OPEN_DEFAULT } from './defs.js'
import { isApplicable, kernelFileMax, kernelWatches, watchMemoryBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'

const GiB = 1024 ** 3

/**
 * @param {import('./profile.js').FilesystemSpec} hw
 * @param {import('./defs.js').FilesystemValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message, fix) => issues.push({ id, level: 'warn', blocking: false, params, message, fix })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  if (isApplicable('file_max', hw) && p.file_max < kernelFileMax(hw)) {
    warn('file-max-below-kernel', ['file_max'],
      `This is below the ${kernelFileMax(hw).toLocaleString()} the kernel picks for this much RAM. When the table is full, every unprivileged process fails to open files, SSH logins included.`,
      `Raise fs.file-max to ${kernelFileMax(hw).toLocaleString()} or more.`)
  }

  if (p.nr_open !== NR_OPEN_DEFAULT) {
    info('nr-open-units', ['nr_open'],
      'A unit asking for more than fs.nr_open with LimitNOFILE= gets less. Debian 13 and Fedora raise fs.nr_open at boot to 1073741816 and 2147483584; a smaller value here lowers it, and units asking for more than it then fail to start (status 205). The generated file shows how to check your units.')
  }

  const watchBytes = watchMemoryBytes(p.max_user_watches)
  if (watchBytes > hw.ramGiB * GiB * 0.1) {
    warn('watches-memory', ['max_user_watches'],
      `If one user filled every watch, the kernel would pin about ${formatBytes(watchBytes)} that can't be swapped, ${Math.round((watchBytes / (hw.ramGiB * GiB)) * 100)}% of RAM. The memory is only used by watches in use.`,
      'Lower fs.inotify.max_user_watches until a full set takes a tenth of RAM or less.')
  }
  if (p.max_user_watches < kernelWatches(hw)) {
    info('watches-below-kernel', ['max_user_watches'],
      `Kernel 5.11 and newer pick about ${kernelWatches(hw).toLocaleString()} for this much RAM, so this lowers the limit there.`)
  }

  if (hw.workload === 'container' && p.max_user_instances < 8192) {
    info('instances-container', ['max_user_instances'],
      'Every pod or container that watches files opens its own inotify instances, and they all count against the user they run as. Busy nodes run out below 8192.')
  }

  if (p.aio_max_nr > 65536 && hw.workload !== 'database') {
    info('aio-database-only', ['aio_max_nr'],
      'Only programs that use native AIO through io_setup(), mostly databases such as MySQL, ScyllaDB and Oracle, need more than the default.')
  }

  return issues
}

/**
 * @param {ValidationIssue[]} issues
 * @returns {boolean}
 */
export function hasBlockingIssue(issues) {
  return issues.some((i) => i.blocking)
}
