/**
 * Generate the formatted sysctl.conf output. Pure function over (hardware,
 * params, presetLabel). The ConfigOutput component renders the returned string
 * verbatim into the textarea — what's here is what the user copies.
 */

import { PARAMETER_DEFS_BY_KEY } from '@/data/parameterDefs.js'
import { watermarkLevelsMiB } from './calculations.js'
import { formatSizeGiB } from '@/utils/formatting.js'

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
  const isK8s = hardware.workload === 'k8s'

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(rule())
  lines.push('# Linux swap & VM sysctl tuning')
  lines.push(`# Generated ${date} by linux-tuners.dev/swap`)
  lines.push(`# Hardware: ${describeHardware(hardware)}`)
  if (presetLabel) {
    lines.push(`# Profile: ${presetLabel}${customised ? ' (customised)' : ''}`)
  } else {
    lines.push('# Profile: custom')
  }
  lines.push(rule())
  lines.push('#')

  // ── How to apply / persist the sysctl settings ──────────────────────────────
  lines.push('# HOW TO APPLY THESE SETTINGS')
  lines.push('#')
  lines.push('# 1. Persist them. Save this whole file as a drop-in (sysctl ignores')
  lines.push('#    the comment lines, and any *.conf in /etc/sysctl.d/ loads on boot):')
  lines.push('#      sudo nano /etc/sysctl.d/99-swap-tuning.conf   # then paste this file')
  lines.push('#')
  lines.push('# 2. Apply them now, without rebooting:')
  lines.push('#      sudo sysctl --system')
  lines.push('#')
  lines.push('# 3. Verify a value took effect:')
  lines.push('#      sysctl vm.swappiness')
  lines.push('#')

  // ── How to create / activate the swap device (device-aware) ─────────────────
  lines.push(...swapSetupBlock(hardware))

  // ── Sources ─────────────────────────────────────────────────────────────────
  lines.push('# Sources:')
  lines.push('#   Kernel vm docs: https://docs.kernel.org/admin-guide/sysctl/vm.html')
  if (isK8s) {
    lines.push('#   Kubernetes swap: https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/')
  }
  lines.push('')

  for (const section of SECTIONS) {
    lines.push(sectionHeader(section.title))
    const defs = Object.values(PARAMETER_DEFS_BY_KEY).filter((d) => d.group === section.id)
    for (const def of defs) {
      // overcommit_ratio is only meaningful when overcommit_memory=2. Suppress
      // it from the output when it has no effect so the file isn't misleading.
      if (def.key === 'overcommit_ratio' && params.overcommit_memory !== 2) continue
      const value = params[def.key]
      lines.push(`# ${def.key}: ${value} - ${commentFor(def, value, hardware, params)}`)
      lines.push(`${def.sysctlName} = ${value}`)
      lines.push('')
    }
  }

  // Drop the trailing blank line for a tidier copy-paste.
  while (lines.at(-1) === '') lines.pop()
  return lines.join('\n')
}

/**
 * Device-aware "how do I actually get swap running" block, returned as comment
 * lines. Swap files for disk-backed devices, zram-generator for zram, the zswap
 * runtime + kernel-cmdline dance for zswap, and a "you have none" note when
 * swapGiB is 0. Each block also covers persistence across reboots.
 *
 * @param {import('./parameters.js').HardwareSpec} hw
 * @returns {string[]}
 */
function swapSetupBlock(hw) {
  const gib = hw.swapGiB
  const mib = Math.round(gib * 1024)
  const size = formatSizeGiB(gib)
  const fsize = fallocateSize(gib)
  const out = []

  if (gib === 0) {
    out.push('# NO SWAP CONFIGURED')
    out.push('#')
    out.push('# You selected no swap, so vm.swappiness has no effect; the dirty-writeback')
    out.push('# and cache settings below still apply. To add swap later, create a swap file:')
    out.push('#   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile')
    out.push('#   sudo mkswap /swapfile && sudo swapon /swapfile')
    out.push("#   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist on reboot")
    out.push('#')
    out.push(rule())
    out.push('#')
    return out
  }

  if (hw.swapDevice === 'zram') {
    out.push(`# ACTIVATING SWAP: ${size} zram (compressed RAM-backed swap)`)
    out.push('#')
    out.push('# zram is a compressed block device that lives in RAM. The cleanest setup is')
    out.push("# systemd's zram-generator:")
    out.push('#   # Debian/Ubuntu: sudo apt install systemd-zram-generator')
    out.push('#   # Fedora: sudo dnf install zram-generator   Arch: sudo pacman -S zram-generator')
    out.push(`#   printf '[zram0]\\nzram-size = ${mib}\\ncompression-algorithm = zstd\\n' | sudo tee /etc/systemd/zram-generator.conf`)
    out.push('#   sudo systemctl daemon-reload')
    out.push('#   sudo systemctl restart systemd-zram-setup@zram0.service')
    out.push('#')
    out.push('# Confirm it is active:  zramctl && swapon --show')
    out.push('# Note: zram swap is cheap, so a high vm.swappiness (100-200) pays off here.')
    out.push('#')
    out.push(rule())
    out.push('#')
    return out
  }

  if (hw.swapDevice === 'zswap') {
    out.push('# ACTIVATING SWAP: zswap (compressed cache in front of disk swap)')
    out.push('#')
    out.push('# zswap is not a separate device: it compresses pages in RAM before they spill')
    out.push('# to real disk swap, which you still need. Create the backing swap first:')
    out.push(`#   sudo fallocate -l ${fsize} /swapfile && sudo chmod 600 /swapfile`)
    out.push('#   sudo mkswap /swapfile && sudo swapon /swapfile')
    out.push("#   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist on reboot")
    out.push('#')
    out.push('# Then turn zswap on at runtime:')
    out.push('#   echo 1    | sudo tee /sys/module/zswap/parameters/enabled')
    out.push('#   echo zstd | sudo tee /sys/module/zswap/parameters/compressor')
    out.push('#')
    out.push('# Persist it on the kernel command line (GRUB_CMDLINE_LINUX in /etc/default/grub):')
    out.push('#   zswap.enabled=1 zswap.compressor=zstd')
    out.push('#   then run: sudo update-grub   # or: sudo grub2-mkconfig -o /boot/grub2/grub.cfg')
    out.push('#')
    out.push(rule())
    out.push('#')
    return out
  }

  // Disk-backed: hdd / sata-ssd / nvme-ssd / network.
  out.push(`# ACTIVATING SWAP: ${size} on ${describeDevice(hw.swapDevice)}`)
  out.push('#')
  out.push('# If you do not have swap yet, a swap file is the simplest option:')
  out.push(`#   sudo fallocate -l ${fsize} /swapfile        # fallback: sudo dd if=/dev/zero of=/swapfile bs=1M count=${mib}`)
  out.push('#   sudo chmod 600 /swapfile')
  out.push('#   sudo mkswap /swapfile')
  out.push('#   sudo swapon /swapfile')
  out.push('#')
  out.push('# Persist it across reboots by adding it to /etc/fstab:')
  out.push("#   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab")
  if (hw.swapDevice === 'network') {
    out.push('#')
    out.push('# Network-backed swap (NFS/iSCSI) is fragile under memory pressure; prefer a')
    out.push('# local device and keep vm.swappiness low so the box leans on it as little as possible.')
  }
  out.push('#')
  out.push('# Confirm it is active:  swapon --show && free -h')
  out.push('#')
  out.push(rule())
  out.push('#')
  return out
}

/** @param {import('./parameters.js').HardwareSpec} hw */
function describeHardware(hw) {
  const swap = hw.swapGiB === 0 ? 'no swap' : `${formatSizeGiB(hw.swapGiB)} ${describeDevice(hw.swapDevice)} swap`
  return `${formatSizeGiB(hw.ramGiB)} RAM, ${swap}, ${describeWorkload(hw.workload)}`
}

/**
 * Size argument for `fallocate -l` / `mkswap`. Whole GiB keep the "8G" form so
 * the commands read naturally; sub-GiB sizes drop to MiB ("512M"), since
 * fallocate's size parser is happiest with integer-suffixed values.
 * @param {number} gib
 */
function fallocateSize(gib) {
  return Number.isInteger(gib) ? `${gib}G` : `${Math.round(gib * 1024)}M`
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

/** Full-width comment rule used to fence the header/setup blocks. */
function rule() {
  return '# ' + '─'.repeat(SEP_WIDTH - 2)
}

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
      if (hw.swapGiB === 0) return 'no swap configured, value has no effect'
      if (value <= 10) return 'low swap aggressiveness, prioritise latency'
      if (value <= 60) return 'balanced bias between page cache and swap'
      if (value <= 100) return 'swap-friendly, useful when swap is fast'
      return 'aggressive, only safe with in-memory swap (zram/zswap)'
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
      if (value === 0) return 'DANGEROUS, kernel will not reclaim dentry/inode caches'
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
      return value === 0 ? 'heuristic, kernel default' : value === 1 ? 'always overcommit' : 'strict, no overcommit'
    case 'overcommit_ratio':
      return `CommitLimit = swap + RAM × ${value}/100`
    case 'panic_on_oom':
      return value === 1 ? 'PANIC on OOM (node reboots)' : 'invoke OOM killer (default)'
    default:
      return ''
  }
}