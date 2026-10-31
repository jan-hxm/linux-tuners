import { PARAMETER_DEFS } from './defs.js'

/**
 * Built-in presets. Each is a partial SecurityValues: keys it doesn't name
 * keep the workload's starting value (store.applyPreset). Every value must
 * work on every kernel the profile offers; the contract suite checks that.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').SecurityValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'Every key at the upstream kernel default, before distribution or systemd changes. A baseline to compare against.',
    source: 'docs.kernel.org admin-guide/sysctl and networking/ip-sysctl',
    values: Object.fromEntries(PARAMETER_DEFS.map((d) => [d.key, d.kernelDefault])),
  },
  {
    id: 'cis',
    label: 'CIS-style server',
    description: 'The values CIS Linux benchmarks set for the keys covered here: full ASLR, restricted ptrace and core dumps, strict network filtering.',
    source: 'CIS Linux benchmarks (process hardening and network parameters)',
    values: {
      randomize_va_space: 2,
      ptrace_scope: 1,
      suid_dumpable: 0,
      rp_filter: 1,
      tcp_syncookies: 1,
      accept_redirects: 0,
      accept_redirects_v6: 0,
      send_redirects: 0,
      accept_source_route: 0,
    },
  },
  {
    id: 'kspp',
    label: 'Maximum (KSPP)',
    description: 'The Kernel Self Protection Project\'s strictest values. ptrace and unprivileged BPF stay locked off until the next reboot.',
    source: 'kspp.github.io Recommended Settings (sysctls)',
    values: {
      kptr_restrict: 2,
      dmesg_restrict: 1,
      perf_event_paranoid: 3,
      ptrace_scope: 3,
      randomize_va_space: 2,
      unprivileged_bpf_disabled: 1,
      protected_symlinks: 1,
      protected_hardlinks: 1,
      protected_fifos: 2,
      protected_regular: 2,
      suid_dumpable: 0,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
