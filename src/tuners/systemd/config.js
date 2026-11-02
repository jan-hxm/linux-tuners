/**
 * Generate the systemd resource-tuning output. Unlike the swap tuner (one
 * sysctl.d file) systemd splits across two drop-ins — a [Manager] file for the
 * Default* directives and a [Slice] file for the per-slice resource controls.
 * Each file opens with a banner naming its path, and the shared header sits at
 * the top of the first. Pure over (hardware, params, presetLabel).
 */

import { cpuQuotaNoLimit, hasCpuAccountingOption, hasSwapControl } from './calculations.js'
import { configFile } from '@/core/output/files.js'
import { commentLine, fileBanner, isoDate, presetSummary } from '@/core/output/comments.js'
import { iniDirective, iniSection } from '@/core/output/iniDropIn.js'
import { formatParams } from '@/core/valueTypes.js'
import { SYSTEMD_DEFS_BY_KEY } from './defs.js'

const SYSTEM_CONF_DOC = 'https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html'
const RESOURCE_DOC = 'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html'
const MANAGER_PATH = '/etc/systemd/system.conf.d/99-resource-tuning.conf'

/** Slice drop-in path. targetSlice is restored against a fixed list, so the path is one of three constants. */
function slicePath(slice) {
  return `/etc/systemd/system/${slice}.d/50-resources.conf`
}

/**
 * @param {Object} opts
 * @param {import('./profile.js').SystemdSpec} opts.hardware
 * @param {import('./defs.js').SystemdValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  // Every value as its type prints it; the ini syntax around it is added here.
  const t = formatParams(SYSTEMD_DEFS_BY_KEY, params)

  // ── File 1: shared header + manager defaults ──────────────────────────────
  const manager = []
  manager.push(`# systemd resource tuning (generated ${isoDate(now)})`)
  manager.push(`# Profile: ${describeProfile(hardware)}`)
  manager.push(`# Preset: ${presetSummary(presetLabel, customised)}`)
  manager.push('# Apply: sudo systemctl daemon-reload')
  manager.push('#        manager defaults also need: sudo systemctl daemon-reexec (or a reboot)')
  manager.push('# Sources:')
  manager.push(`#   ${SYSTEM_CONF_DOC}`)
  manager.push(`#   ${RESOURCE_DOC}`)
  manager.push('')
  manager.push(fileBanner(MANAGER_PATH))
  manager.push(iniSection('Manager'))
  if (hasCpuAccountingOption(hardware)) {
    manager.push(...iniDirective('DefaultCPUAccounting', yesNo(t.default_cpu_accounting), 'per-unit CPU time accounting'))
  } else {
    manager.push(commentLine('DefaultCPUAccounting: left out, cgroup v2 always accounts CPU time (systemd 258 removed the option)'))
  }
  manager.push(...iniDirective('DefaultMemoryAccounting', yesNo(t.default_memory_accounting), 'per-unit memory accounting (required for memory limits)'))
  manager.push(...iniDirective('DefaultIOAccounting', yesNo(t.default_io_accounting), 'per-unit block-I/O accounting'))
  manager.push(...iniDirective('DefaultTasksAccounting', yesNo(t.default_tasks_accounting), 'per-unit task counting (required for TasksMax)'))
  manager.push(...iniDirective('DefaultIPAccounting', yesNo(t.default_ip_accounting), 'per-unit network accounting (eBPF)'))
  manager.push(...iniDirective('DefaultTasksMax', t.default_tasks_max, `default per-unit task cap (~${pctOfPid(params.default_tasks_max, hardware.pidMax)} of pid_max)`))
  manager.push(...iniDirective('DefaultLimitNOFILE', `${t.default_limit_nofile_soft}:${t.default_limit_nofile_hard}`, 'default open-file-descriptor soft:hard limit'))
  manager.push(...iniDirective('DefaultLimitMEMLOCK', systemdSize(params.default_limit_memlock), 'default locked-in-memory ceiling'))

  // ── File 2: slice resource control ────────────────────────────────────────
  const path = slicePath(hardware.targetSlice)
  const slice = []
  slice.push(fileBanner(path))
  slice.push(iniSection('Slice'))
  slice.push(...iniDirective('CPUWeight', t.cpu_weight, `proportional CPU share under contention (default 100)`))

  if (params.cpu_quota < cpuQuotaNoLimit(hardware)) {
    slice.push(...iniDirective('CPUQuota', `${t.cpu_quota}%`, `hard CPU cap ≈ ${(params.cpu_quota / 100).toFixed(1)} cores`))
  } else {
    slice.push(commentLine('CPUQuota: unset (no hard CPU limit)'))
  }

  slice.push(...memoryLines('MemoryHigh', params.memory_high, t.memory_high, hardware, 'soft throttle limit'))
  slice.push(...memoryLines('MemoryMax', params.memory_max, t.memory_max, hardware, 'hard OOM limit'))
  slice.push(...swapLines(params.memory_swap_max, t.memory_swap_max, hardware))

  slice.push(...iniDirective('IOWeight', t.io_weight, 'proportional block-I/O share under contention (default 100)'))
  slice.push(...iniDirective('TasksMax', t.tasks_max, `hard task cap for the whole slice (~${pctOfPid(params.tasks_max, hardware.pidMax)} of pid_max)`))

  return [configFile(MANAGER_PATH, manager), configFile(path, slice)]
}

/** Memory % directive: `<v>%`, or a note that it is unset at 100% (infinity). */
function memoryLines(key, pct, text, hw, comment) {
  if (pct >= 100) {
    return [commentLine(`${key}: unset (infinity, no ${key === 'MemoryHigh' ? 'throttle' : 'limit'})`)]
  }
  const gib = ((hw.ramGiB * pct) / 100).toFixed(1)
  return iniDirective(key, `${text}%`, `${comment} ≈ ${gib} GiB of ${hw.ramGiB}`)
}

function swapLines(pct, text, hw) {
  if (!hasSwapControl(hw)) return [commentLine('MemorySwapMax: left out, it needs cgroup v2')]
  if (pct >= 100) return [commentLine('MemorySwapMax: unset (infinity, slice may swap freely)')]
  if (pct === 0) return iniDirective('MemorySwapMax', '0', 'slice forbidden from using swap (systemd 239+)')
  const gib = ((hw.ramGiB * pct) / 100).toFixed(1)
  return iniDirective('MemorySwapMax', `${text}%`, `swap budget ≈ ${gib} GiB`)
}

function describeProfile(hw) {
  return `${describeWorkload(hw.workload)}, ${hw.targetSlice}, ${hw.ramGiB} GiB RAM, ${hw.cpuCores} cores, cgroup ${hw.cgroupVersion}`
}

function describeWorkload(w) {
  switch (w) {
    case 'container-host': return 'container host'
    case 'kubernetes': return 'Kubernetes node'
    case 'database': return 'database server'
    case 'desktop': return 'desktop workstation'
    case 'general': return 'general-purpose server'
    default: return 'custom'
  }
}

/** A bool param's printed '0'/'1' as systemd's no/yes. */
function yesNo(text) {
  return text === '1' ? 'yes' : 'no'
}

/** One decimal, so systemd's default on a 16 GiB machine shows as 0.5%, not 0%. */
function pctOfPid(value, pidMax) {
  return `${Math.round((value / pidMax) * 1000) / 10}%`
}

/** Render a byte count using systemd's size suffixes (8388608 → "8M"). */
export function systemdSize(bytes) {
  const G = 1024 * 1024 * 1024
  const M = 1024 * 1024
  const K = 1024
  if (bytes === 0) return '0'
  if (bytes % G === 0) return `${bytes / G}G`
  if (bytes % M === 0) return `${bytes / M}M`
  if (bytes % K === 0) return `${bytes / K}K`
  return String(bytes)
}
