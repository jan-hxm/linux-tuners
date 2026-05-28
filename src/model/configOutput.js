/**
 * Generate the formatted sysctl.conf output. Pure function over (hardware,
 * params, presetLabel). The ConfigOutput component renders the returned string
 * verbatim into the textarea — what's here is what the user copies.
 */

import { PARAMETER_DEFS_BY_KEY } from '@/data/parameterDefs.js'
import { watermarkLevelsMiB } from './calculations.js'

const SECTIONS = [
  { id: 'memory-reclaim', title: 'Memory reclaim & swap' },
  { id: 'dirty-writeback', title: 'Dirty page writeback' },
  { id: 'oom-overcommit', title: 'OOM & overcommit' },
]

/**
 * @param {Object} opts
 * @param {import('./parameters.js').HardwareSpec} opts.hardware
 * @param {import('./parameters.js').ParameterValues} opts.params
 * @param {string|null} [opts.presetLabel]   Human-readable preset label
 * @param {boolean}     [opts.customised]    Whether any param deviates from the preset
 * @param {Date}        [opts.now]           Date stamp (overridable for tests)
 * @returns {string}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []
  const date = (now ?? new Date()).toISOString().slice(0, 10)

  lines.push(`# sysctl swap tuner — generated ${date}`)
  lines.push(`# Hardware: ${describeHardware(hardware)}`)
  if (presetLabel) {
    lines.push(`# Profile: ${presetLabel}${customised ? ' (customised)' : ''}`)
  } else {
    lines.push('# Profile: custom')
  }
  lines.push('# Apply: sudo sysctl --system')
  lines.push('# Persist: /etc/sysctl.d/99-swap-tuning.conf')
  lines.push('#')
  lines.push('# Sources:')
  lines.push('#   https://docs.kernel.org/admin-guide/sysctl/vm.html')
  lines.push('#   https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/')
  lines.push('')

  for (const section of SECTIONS) {
    lines.push(sectionHeader(section.title))
    const defs = Object.values(PARAMETER_DEFS_BY_KEY).filter((d) => d.group === section.id)
    for (const def of defs) {
      // overcommit_ratio is only meaningful when overcommit_memory=2. Suppress
      // it from the output when it has no effect so the file isn't misleading.
      if (def.key === 'overcommit_ratio' && params.overcommit_memory !== 2) continue
      const value = params[def.key]
      lines.push(`# ${def.key}: ${value} — ${commentFor(def, value, hardware, params)}`)
      lines.push(`${def.sysctlName} = ${value}`)
      lines.push('')
    }
  }

  // Drop the trailing blank line for a tidier copy-paste.
  while (lines.at(-1) === '') lines.pop()
  return lines.join('\n')
}

/** @param {import('./parameters.js').HardwareSpec} hw */
function describeHardware(hw) {
  const swap = hw.swapGiB === 0 ? 'no swap' : `${hw.swapGiB} GiB ${describeDevice(hw.swapDevice)} swap`
  return `${hw.ramGiB} GiB RAM, ${swap}, ${describeWorkload(hw.workload)}`
}

function describeDevice(device) {
  switch (device) {
    case 'hdd': return 'HDD'
    case 'sata-ssd': return 'SATA SSD'
    case 'nvme-ssd': return 'NVMe'
    case 'zram': return 'zram'
    case 'zswap': return 'zswap'
    case 'network': return 'network'
    default: return device
  }
}

function describeWorkload(w) {
  switch (w) {
    case 'k8s': return 'Kubernetes node'
    case 'database': return 'database server'
    case 'general': return 'general-purpose server'
    case 'desktop': return 'desktop workstation'
    case 'embedded': return 'embedded / constrained'
    case 'custom': return 'custom'
    default: return w
  }
}

const SEP_WIDTH = 78
function sectionHeader(title) {
  const lead = `# ── ${title} `
  const dashes = '─'.repeat(Math.max(2, SEP_WIDTH - lead.length))
  return lead + dashes
}

/**
 * One-line description of what this value does in context. Used both as the
 * inline comment in the output file and as the "why this value" annotation.
 *
 * @param {*} def
 * @param {number} value
 * @param {import('./parameters.js').HardwareSpec} hw
 * @param {import('./parameters.js').ParameterValues} params
 */
function commentFor(def, value, hw, params) {
  switch (def.key) {
    case 'swappiness':
      if (hw.swapGiB === 0) return 'no swap configured — value has no effect'
      if (value <= 10) return 'low swap aggressiveness, prioritise latency'
      if (value <= 60) return 'balanced bias between page cache and swap'
      if (value <= 100) return 'swap-friendly — useful when swap is fast'
      return 'aggressive — only safe with in-memory swap (zram/zswap)'
    case 'min_free_kbytes': {
      const mib = Math.round(value / 1024)
      return `reserve ~${mib} MiB as the kernel free-memory floor`
    }
    case 'watermark_scale_factor': {
      const mib = watermarkLevelsMiB(hw.ramGiB, params.min_free_kbytes, value).highMiB
        - watermarkLevelsMiB(hw.ramGiB, params.min_free_kbytes, value).lowMiB
      return `kswapd reclaim window ~${mib} MiB wide`
    }
    case 'vfs_cache_pressure':
      if (value === 0) return 'DANGEROUS — kernel will not reclaim dentry/inode caches'
      if (value < 100) return 'prefer keeping filesystem metadata in cache'
      if (value === 100) return 'balanced dentry/inode vs page-cache reclaim'
      return 'aggressively reclaim filesystem metadata'
    case 'dirty_ratio':
      return `synchronous stall ceiling at ${value}% of RAM dirtied`
    case 'dirty_background_ratio':
      return `background flusher wakes at ${value}% of RAM dirtied`
    case 'dirty_expire_centisecs':
      return `dirty pages eligible for flush after ${(value / 100).toFixed(1)} s`
    case 'dirty_writeback_centisecs':
      if (value === 0) return 'periodic writeback disabled'
      return `flusher wakes every ${(value / 100).toFixed(1)} s`
    case 'overcommit_memory':
      return value === 0 ? 'heuristic — kernel default' : value === 1 ? 'always overcommit' : 'strict — no overcommit'
    case 'overcommit_ratio':
      return `CommitLimit = swap + RAM × ${value}/100`
    case 'panic_on_oom':
      return value === 1 ? 'PANIC on OOM (node reboots)' : 'invoke OOM killer (default)'
    default:
      return ''
  }
}