/**
 * Generate the systemd resource-tuning output. Unlike the swap tuner (one
 * sysctl.d file) systemd splits across two drop-ins — a [Manager] file for the
 * Default* directives and a [Slice] file for the per-slice resource controls —
 * so the output is one annotated document with both files clearly delimited.
 * Pure over (hardware, params, presetLabel).
 */

import { cpuQuotaNoLimit } from './calculations.js'

const SYSTEM_CONF_DOC = 'https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html'
const RESOURCE_DOC = 'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html'

/**
 * @param {Object} opts
 * @param {import('./parameters.js').SystemdSpec} opts.hardware
 * @param {import('./parameters.js').SystemdValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {string}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const date = (now ?? new Date()).toISOString().slice(0, 10)
  const lines = []

  lines.push(`# systemd resource tuning (generated ${date})`)
  lines.push(`# Profile: ${describeProfile(hardware)}`)
  if (presetLabel) {
    lines.push(`# Preset: ${presetLabel}${customised ? ' (customised)' : ''}`)
  } else {
    lines.push('# Preset: custom')
  }
  lines.push('# Apply: sudo systemctl daemon-reload')
  lines.push('#        manager defaults also need: sudo systemctl daemon-reexec (or a reboot)')
  lines.push('# Sources:')
  lines.push(`#   ${SYSTEM_CONF_DOC}`)
  lines.push(`#   ${RESOURCE_DOC}`)
  lines.push('')

  // ── File 1: manager defaults ──────────────────────────────────────────────
  lines.push(fileHeader('/etc/systemd/system.conf.d/99-resource-tuning.conf'))
  lines.push('[Manager]')
  emit(lines, 'DefaultCPUAccounting', bool(params.default_cpu_accounting), 'per-unit CPU time accounting')
  emit(lines, 'DefaultMemoryAccounting', bool(params.default_memory_accounting), 'per-unit memory accounting (required for memory limits)')
  emit(lines, 'DefaultIOAccounting', bool(params.default_io_accounting), 'per-unit block-I/O accounting')
  emit(lines, 'DefaultTasksAccounting', bool(params.default_tasks_accounting), 'per-unit task counting (required for TasksMax)')
  emit(lines, 'DefaultIPAccounting', bool(params.default_ip_accounting), 'per-unit network accounting (eBPF)')
  emit(lines, 'DefaultTasksMax', String(params.default_tasks_max), `default per-unit task cap (~${pctOfPid(params.default_tasks_max, hardware.pidMax)} of pid_max)`)
  emit(lines, 'DefaultLimitNOFILE', `${params.default_limit_nofile_soft}:${params.default_limit_nofile_hard}`, 'default open-file-descriptor soft:hard limit')
  emit(lines, 'DefaultLimitMEMLOCK', systemdSize(params.default_limit_memlock), 'default locked-in-memory ceiling')
  lines.push('')

  // ── File 2: slice resource control ────────────────────────────────────────
  const sliceFile = `/etc/systemd/system/${hardware.targetSlice}.d/50-resources.conf`
  lines.push(fileHeader(sliceFile))
  lines.push('[Slice]')
  emit(lines, 'CPUWeight', String(params.cpu_weight), `proportional CPU share under contention (default 100)`)

  if (params.cpu_quota < cpuQuotaNoLimit(hardware)) {
    emit(lines, 'CPUQuota', `${params.cpu_quota}%`, `hard CPU cap ≈ ${(params.cpu_quota / 100).toFixed(1)} cores`)
  } else {
    lines.push('# CPUQuota: unset (no hard CPU limit)')
  }

  emitMemory(lines, 'MemoryHigh', params.memory_high, hardware, 'soft throttle limit')
  emitMemory(lines, 'MemoryMax', params.memory_max, hardware, 'hard OOM limit')
  emitSwap(lines, params.memory_swap_max, hardware)

  emit(lines, 'IOWeight', String(params.io_weight), 'proportional block-I/O share under contention (default 100)')
  emit(lines, 'TasksMax', String(params.tasks_max), `hard task cap for the whole slice (~${pctOfPid(params.tasks_max, hardware.pidMax)} of pid_max)`)

  while (lines.at(-1) === '') lines.pop()
  return lines.join('\n')
}

function emit(lines, key, value, comment) {
  lines.push(`# ${key}: ${comment}`)
  lines.push(`${key}=${value}`)
}

/** Memory % directive: emit `<v>%`, or note that it is unset at 100% (infinity). */
function emitMemory(lines, key, pct, hw, comment) {
  if (pct >= 100) {
    lines.push(`# ${key}: unset (infinity, no ${key === 'MemoryHigh' ? 'throttle' : 'limit'})`)
    return
  }
  const gib = ((hw.ramGiB * pct) / 100).toFixed(1)
  emit(lines, key, `${pct}%`, `${comment} ≈ ${gib} GiB of ${hw.ramGiB}`)
}

function emitSwap(lines, pct, hw) {
  if (pct >= 100) {
    lines.push('# MemorySwapMax: unset (infinity, slice may swap freely)')
    return
  }
  if (pct === 0) {
    emit(lines, 'MemorySwapMax', '0', 'slice forbidden from using swap')
    return
  }
  const gib = ((hw.ramGiB * pct) / 100).toFixed(1)
  emit(lines, 'MemorySwapMax', `${pct}%`, `swap budget ≈ ${gib} GiB`)
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
    default: return w
  }
}

function bool(v) {
  return v === 1 ? 'yes' : 'no'
}

function pctOfPid(value, pidMax) {
  return `${Math.round((value / pidMax) * 100)}%`
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

const SEP_WIDTH = 78
function fileHeader(path) {
  const lead = `# ===== ${path} `
  const eq = '='.repeat(Math.max(2, SEP_WIDTH - lead.length))
  return lead + eq
}
