/**
 * What the hardening guide (learn.js) measures on each VM image: every setting
 * it explains and the real parts its figures name. Plain data in the frozen
 * probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and by the
 * guide contract suite. Ids are prefixed `security.`.
 */

export const PROBES = {
  // The eighteen settings, one per def (the `all` key where a def sets a twin).
  'security.kptrRestrict': { kind: 'sysctl', name: 'kernel.kptr_restrict' },
  'security.dmesgRestrict': { kind: 'sysctl', name: 'kernel.dmesg_restrict' },
  'security.perfParanoid': { kind: 'sysctl', name: 'kernel.perf_event_paranoid' },
  'security.ptraceScope': { kind: 'sysctl', name: 'kernel.yama.ptrace_scope' },
  'security.randomizeVaSpace': { kind: 'sysctl', name: 'kernel.randomize_va_space' },
  'security.bpfDisabled': { kind: 'sysctl', name: 'kernel.unprivileged_bpf_disabled' },
  'security.maxUserNamespaces': { kind: 'sysctl', name: 'user.max_user_namespaces' },
  'security.rpFilter': { kind: 'sysctl', name: 'net.ipv4.conf.all.rp_filter' },
  'security.synCookies': { kind: 'sysctl', name: 'net.ipv4.tcp_syncookies' },
  'security.acceptRedirects': { kind: 'sysctl', name: 'net.ipv4.conf.all.accept_redirects' },
  'security.acceptRedirectsV6': { kind: 'sysctl', name: 'net.ipv6.conf.all.accept_redirects' },
  'security.sendRedirects': { kind: 'sysctl', name: 'net.ipv4.conf.all.send_redirects' },
  'security.acceptSourceRoute': { kind: 'sysctl', name: 'net.ipv4.conf.all.accept_source_route' },
  'security.protectedSymlinks': { kind: 'sysctl', name: 'fs.protected_symlinks' },
  'security.protectedHardlinks': { kind: 'sysctl', name: 'fs.protected_hardlinks' },
  'security.protectedFifos': { kind: 'sysctl', name: 'fs.protected_fifos' },
  'security.protectedRegular': { kind: 'sysctl', name: 'fs.protected_regular' },
  'security.suidDumpable': { kind: 'sysctl', name: 'fs.suid_dumpable' },

  // The parts the figures name.
  'security.yama': { kind: 'file', path: '/proc/sys/kernel/yama', exists: true },
  'security.kallsyms': { kind: 'file', path: '/proc/kallsyms', exists: true },
  'security.ipv6': { kind: 'file', path: '/proc/sys/net/ipv6', exists: true },
  'security.threadsMax': { kind: 'sysctl', name: 'kernel.threads-max' },
  'security.rpFilterDefault': { kind: 'sysctl', name: 'net.ipv4.conf.default.rp_filter' },
  'security.ipForward': { kind: 'sysctl', name: 'net.ipv4.ip_forward' },
  'security.synBacklog': { kind: 'sysctl', name: 'net.ipv4.tcp_max_syn_backlog' },
}
