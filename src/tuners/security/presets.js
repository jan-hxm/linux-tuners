/**
 * Built-in presets. Each is a partial SecurityValues: keys it doesn't name
 * keep the workload's starting value (store.applyPreset). Every value must
 * work on every kernel the profile offers; the contract suite checks that.
 *
 * There is no "kernel defaults" preset: the defaults of several keys depend
 * on the kernel version and the distribution build (unprivileged BPF is off
 * from 5.16, Ubuntu starts perf at 4), so one fixed set would loosen a modern
 * system. Each card's drawer shows its key's default instead.
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
    description: 'The Kernel Self Protection Project\'s strictest values. ptrace and unprivileged BPF stay locked off until the next reboot, and nothing can create user namespaces. perf_event_paranoid is 4 where KSPP lists 3, because Ubuntu kernels only block perf from 4.',
    source: 'kspp.github.io Recommended Settings (sysctls)',
    values: {
      kptr_restrict: 2,
      dmesg_restrict: 1,
      perf_event_paranoid: 4,
      ptrace_scope: 3,
      randomize_va_space: 2,
      unprivileged_bpf_disabled: 1,
      user_namespaces: 'blocked',
      protected_symlinks: 1,
      protected_hardlinks: 1,
      protected_fifos: 2,
      protected_regular: 2,
      suid_dumpable: 0,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
