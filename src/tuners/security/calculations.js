import { PARAMETER_DEFS_BY_KEY } from './defs.js'

/**
 * Workload-aware starting values. They follow the KSPP and CIS recommendations
 * where those fit the workload, and relax only what the workload needs: ptrace
 * and perf for people who debug, loose reverse-path filtering where routes can
 * be asymmetric, and redirects on a router. Opinionated starting points, not
 * kernel constants.
 *
 * @param {import('./profile.js').SecuritySpec} hw
 * @returns {import('./defs.js').SecurityValues}
 */
export function deriveDefaults(hw) {
  const w = hw.workload
  const debugs = w === 'desktop' || w === 'container'
  return {
    kptr_restrict: w === 'router' ? 2 : 1,
    dmesg_restrict: 1,
    // 4, not KSPP's 3: Ubuntu's patch blocks perf only from 4 and starts there.
    perf_event_paranoid: debugs ? 2 : 4,
    ptrace_scope: debugs ? 1 : 2,
    randomize_va_space: 2,
    // 2 is reversible but needs 5.13; older kernels only have the one-way 1.
    unprivileged_bpf_disabled: hasReversibleBpfOff(hw) ? 2 : 1,
    // Strict filtering breaks asymmetric routes: routers, CNIs, VPN clients.
    rp_filter: w === 'server' ? 1 : 2,
    tcp_syncookies: 1,
    accept_redirects: 0,
    accept_redirects_v6: 0,
    send_redirects: w === 'router' ? 1 : 0,
    accept_source_route: 0,
    protected_symlinks: 1,
    protected_hardlinks: 1,
    protected_fifos: 1,
    protected_regular: 1,
    suid_dumpable: 0,
  }
}

/**
 * The values the kernel accepts for each key on the chosen kernel.
 *
 * @param {string} key
 * @param {import('./profile.js').SecuritySpec} hw
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown security parameter: ${key}`)
  if (key === 'unprivileged_bpf_disabled' && !hasReversibleBpfOff(hw)) {
    // Before 5.13 the key takes only the one-way 1; 0 means "leave it out".
    return { min: 0, max: 1 }
  }
  return { min: def.kernelMin, max: def.kernelMax }
}

/** Kernel 5.13 added unprivileged_bpf_disabled = 2. */
export function hasReversibleBpfOff(hw) {
  return hw.kernel === 'current'
}

/** fs.protected_fifos and fs.protected_regular arrived in 4.19. */
export function hasProtectedFifos(hw) {
  return hw.kernel !== 'legacy'
}

/**
 * Whether a key is written to the file. Keys the chosen system doesn't have
 * are left out, and so is unprivileged_bpf_disabled = 0 before 5.13, which
 * those kernels reject (it is their default anyway).
 *
 * @param {string} key
 * @param {import('./profile.js').SecuritySpec} hw
 * @param {import('./defs.js').SecurityValues} params
 */
export function isEmitted(key, hw, params) {
  if (key === 'protected_fifos' || key === 'protected_regular') return hasProtectedFifos(hw)
  if (key === 'accept_redirects_v6') return hw.ipv6 === 'on'
  if (key === 'unprivileged_bpf_disabled') return hasReversibleBpfOff(hw) || params.unprivileged_bpf_disabled !== 0
  return true
}

/** Whether a key has a card: those the chosen system has. */
export function isApplicable(key, hw) {
  if (key === 'protected_fifos' || key === 'protected_regular') return hasProtectedFifos(hw)
  if (key === 'accept_redirects_v6') return hw.ipv6 === 'on'
  return true
}
