/**
 * Generate the huge pages output: a sysctl.d file for the vm.* keys and a
 * tmpfiles.d file whose `w` lines set the THP and KSM sysfs files at boot.
 * Each file opens with a banner naming its path, and the shared header sits
 * at the top of the first. Pure over (hardware, params, presetLabel).
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { isEmitted, poolBytes } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'
import { configFile } from '@/core/output/files.js'
import { fileBanner, isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'
import { tmpfilesConfig } from '@/core/output/tmpfilesFile.js'

const SYSCTL_PATH = '/etc/sysctl.d/99-hugepages-tuning.conf'
const TMPFILES_PATH = '/etc/tmpfiles.d/99-hugepages-tuning.conf'

const SYSCTL_SECTIONS = [
  { id: 'pool', title: 'Huge page pool' },
  { id: 'maps', title: 'Memory maps and NUMA' },
]
const TMPFILES_SECTIONS = [
  { id: 'thp', title: 'Transparent huge pages' },
  { id: 'ksm', title: 'Kernel samepage merging' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').HugepagesSpec} opts.hardware
 * @param {import('./defs.js').HugepagesValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const include = (def) => isEmitted(def.key, hardware, params)
  const comment = (def, value) => commentFor(def, value)
  const sysctlDefs = PARAMETER_DEFS.filter((d) => !d.sysfsPath)
  const sysfsDefs = PARAMETER_DEFS.filter((d) => d.sysfsPath)

  // ── File 1: shared header + vm.* sysctls ──────────────────────────────────
  const sysctl = []
  sysctl.push(rule())
  sysctl.push('# Linux huge pages, THP, KSM and memory map sysctls')
  sysctl.push(`# Generated ${isoDate(now)} by linux-tuners.dev/hugepages`)
  sysctl.push(`# System: ${describeSystem(hardware)}`)
  sysctl.push(`# Profile: ${presetSummary(presetLabel, customised)}`)
  sysctl.push(rule())
  sysctl.push('#')
  sysctl.push('# HOW TO APPLY THESE SETTINGS')
  sysctl.push('#')
  sysctl.push('# This output is two files. Each starts at its "# =====" banner.')
  sysctl.push('#')
  sysctl.push('# 1. Persist them. Save each part as its own file:')
  sysctl.push(`#      sudo nano ${SYSCTL_PATH}`)
  sysctl.push(`#      sudo nano ${TMPFILES_PATH}`)
  sysctl.push('#    The first loads with the sysctl files on boot; systemd-tmpfiles')
  sysctl.push('#    writes the second to /sys on boot.')
  sysctl.push('#')
  sysctl.push('# 2. Apply them now, without rebooting:')
  sysctl.push('#      sudo sysctl --system')
  sysctl.push(`#      sudo systemd-tmpfiles --create ${TMPFILES_PATH}`)
  sysctl.push('#')
  sysctl.push('# 3. Verify they took effect:')
  sysctl.push('#      grep HugePages_ /proc/meminfo')
  sysctl.push('#      cat /sys/kernel/mm/transparent_hugepage/enabled')
  sysctl.push('#')
  sysctl.push(...noteBlock(hardware, params))
  sysctl.push('# Sources:')
  sysctl.push('#   vm sysctls: https://docs.kernel.org/admin-guide/sysctl/vm.html')
  sysctl.push('#   THP: https://docs.kernel.org/admin-guide/mm/transhuge.html')
  sysctl.push('#   KSM: https://docs.kernel.org/admin-guide/mm/ksm.html')
  sysctl.push('#   tmpfiles.d: https://www.freedesktop.org/software/systemd/man/latest/tmpfiles.d.html')
  sysctl.push('')
  sysctl.push(fileBanner(SYSCTL_PATH))
  const body = sysctlConfig({ defs: sysctlDefs, sections: SYSCTL_SECTIONS, params, comment, include })
  sysctl.push(...(body.length ? body : ['# Every key here is at the kernel default, so this file sets nothing.']))

  // ── File 2: THP and KSM through tmpfiles.d ────────────────────────────────
  const tmpfiles = []
  tmpfiles.push(fileBanner(TMPFILES_PATH))
  tmpfiles.push('# Each "w" line writes its value to that /sys file when systemd-tmpfiles')
  tmpfiles.push('# runs at boot. A path the kernel lacks is skipped.')
  tmpfiles.push('')
  tmpfiles.push(...tmpfilesConfig({ defs: sysfsDefs, sections: TMPFILES_SECTIONS, params, comment, include }))

  return [configFile(SYSCTL_PATH, sysctl), configFile(TMPFILES_PATH, tmpfiles)]
}

/** What the output leaves out and why. */
function noteBlock(hw, params) {
  const groups = []
  if (!isEmitted('nr_hugepages', hw, params)) {
    groups.push([
      '# vm.nr_hugepages is left out at 0, so a pool set elsewhere (another',
      '# sysctl.d file, or hugepages= on the kernel command line) stays.',
    ])
  } else {
    groups.push([
      '# The huge page pool is taken from RAM when it is set, used or not.',
      '# Check that the kernel found every page: HugePages_Total above.',
    ])
  }
  if (!isEmitted('max_map_count', hw, params)) {
    groups.push([
      '# vm.max_map_count is left out at the kernel default, 65530, so systems',
      '# that start it higher (Debian 13, Ubuntu 24.04, Fedora 43) keep theirs.',
    ])
  }
  groups.push([
    '# Debian kernels start transparent_hugepage/enabled at always, Ubuntu and',
    '# Fedora at madvise; the second file sets it either way.',
  ])
  if (params.thp_enabled !== 'never') {
    groups.push([
      `# Setting it to ${params.thp_enabled} makes khugepaged raise vm.min_free_kbytes to its`,
      '# own floor if it is lower, and systemd-tmpfiles runs after the sysctl',
      '# files at boot. A lower vm.min_free_kbytes set elsewhere (such as the',
      '# swap tuner\'s file) only holds with transparent huge pages set to never.',
    ])
  }
  if (!isEmitted('ksm_run', hw, params)) {
    groups.push([
      '# ksm/run is left out while KSM is off, so a service that turns it on',
      '# (such as ksmtuned) keeps working.',
    ])
  }
  return ['# NOTES', '#', ...groups.flatMap((g, i) => (i ? ['#', ...g] : g)), '#', rule(), '#']
}

/** @param {import('./profile.js').HugepagesSpec} hw */
function describeSystem(hw) {
  const label = (key) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === hw[key]).label
  return `${label('workload')}, ${hw.ramGiB} GiB RAM, ${label('numa')} NUMA ${hw.numa === 'single' ? 'node' : 'nodes'}`
}

/**
 * The inline comment for each value in the output.
 *
 * @param {Object} def
 * @param {number|string} value
 */
function commentFor(def, value) {
  switch (def.key) {
    case 'nr_hugepages':
      return `2 MiB pages reserved, ${formatBytes(poolBytes(value))} of RAM`
    case 'nr_overcommit_hugepages':
      return `more 2 MiB pages on demand, up to ${formatBytes(poolBytes(value))}`
    case 'max_map_count':
      return 'memory mappings per process'
    case 'zone_reclaim_mode':
      return value === 1 ? 'reclaim on the local NUMA node first' : 'allocate from other NUMA nodes before reclaiming'
    case 'thp_enabled':
      return 'which memory gets transparent huge pages'
    case 'thp_defrag':
      return 'how long a fault waits for a free 2 MiB block'
    case 'ksm_run':
      return 'merge identical pages that programs marked mergeable'
    case 'ksm_pages_to_scan':
      return 'pages ksmd scans per wake-up'
    case 'ksm_sleep_millisecs':
      return 'milliseconds ksmd sleeps between scans'
    default:
      return ''
  }
}
