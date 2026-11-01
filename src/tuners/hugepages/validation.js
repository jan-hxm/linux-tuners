/**
 * Cross-parameter and profile-aware notes. The kernel accepts every value the
 * cards offer, so nothing here blocks the output: settings that cost memory
 * or latency are warnings, and distribution behaviour is an info note.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {boolean}  blocking  Always false here
 */

import { MAP_COUNT_DEFAULT, MAP_COUNT_DISTRO } from './defs.js'
import { poolBytes, ramBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'

/** A pool above this share of RAM leaves little for page cache and programs. */
const POOL_WARN_SHARE = 0.75

/**
 * @param {import('./profile.js').HugepagesSpec} hw
 * @param {import('./defs.js').HugepagesValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message) => issues.push({ id, level: 'warn', blocking: false, params, message })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  const pool = poolBytes(p.nr_hugepages)
  if (pool > ramBytes(hw) * POOL_WARN_SHARE) {
    warn('pool-ram', ['nr_hugepages'],
      `The pool takes ${formatBytes(pool)}, ${Math.round((pool / ramBytes(hw)) * 100)}% of RAM, at boot whether a program uses it or not. Only ${formatBytes(ramBytes(hw) - pool)} is left for the kernel, the page cache and every other program.`)
  }
  if (p.nr_hugepages > 0) {
    info('pool-check', ['nr_hugepages'],
      'Check after applying that the kernel found every page: HugePages_Total in /proc/meminfo. On a busy machine set it at boot rather than at runtime.')
  }

  if (p.thp_enabled === 'always' && hw.workload === 'database') {
    warn('thp-always-database', ['thp_enabled'],
      'PostgreSQL, Oracle and Redis advise against THP always: it can waste memory and add latency spikes. madvise gives huge pages only to programs that ask for them.')
  }
  if (p.thp_defrag === 'always') {
    warn('thp-defrag-always', ['thp_defrag'],
      'Every program that faults in THP memory waits while the kernel compacts memory, which shows up as latency spikes. madvise or defer+madvise limit the waiting to programs that asked for huge pages.')
  }

  if (p.ksm_run === 1) {
    info('ksm-side-channel', ['ksm_run'],
      'Merged pages let one virtual machine tell, through write timings, that another holds the same data. Leave KSM off where the guests don\'t trust each other.')
  }

  if (p.max_map_count !== MAP_COUNT_DEFAULT && p.max_map_count < MAP_COUNT_DISTRO) {
    info('map-count-lowers', ['max_map_count'],
      'Debian 13, Ubuntu 24.04 and Fedora 43 start at 1048576, so this lowers the limit there.')
  }

  if (hw.numa === 'multi' && p.zone_reclaim_mode === 1) {
    warn('zone-reclaim-on', ['zone_reclaim_mode'],
      'The kernel now evicts page cache on the local node before it uses free memory on another. File servers and databases lose their cache this way; keep it on only for workloads partitioned per node.')
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
