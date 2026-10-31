/**
 * Cross-parameter and profile-aware notes. Every value offered is one the
 * kernel accepts, so nothing here blocks the output: weak settings are
 * warnings, and one-way or kernel-specific behaviour is an info note.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {boolean}  blocking  Always false here
 */

import { hasReversibleBpfOff, isApplicable } from './calculations.js'

/**
 * @param {import('./profile.js').SecuritySpec} hw
 * @param {import('./defs.js').SecurityValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message) => issues.push({ id, level: 'warn', blocking: false, params, message })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  if (p.kptr_restrict === 0 && p.perf_event_paranoid <= 1) {
    warn('kallsyms-exposed', ['kptr_restrict', 'perf_event_paranoid'],
      'With kptr_restrict 0 and perf_event_paranoid 1 or lower, /proc/kallsyms shows real kernel addresses to every user, which defeats KASLR.')
  }
  if (p.perf_event_paranoid === 3) {
    info('perf-3-patched', ['perf_event_paranoid'],
      '3 needs the Debian, Ubuntu or Android kernel patch; other kernels accept it but treat it as 2.')
  }

  if (p.ptrace_scope === 0) {
    warn('ptrace-classic', ['ptrace_scope'],
      'Any process can attach to every other process of the same user, so one compromised program can read the secrets of all the others.')
  }
  if (p.ptrace_scope === 3) {
    info('ptrace-locked', ['ptrace_scope'],
      'ptrace_scope 3 can\'t be lowered again until the next reboot, and it stops debuggers, strace and some crash reporters from attaching.')
  }

  if (p.randomize_va_space < 2) {
    warn('aslr-reduced', ['randomize_va_space'], p.randomize_va_space === 0
      ? 'ASLR is off: every program loads at predictable addresses, which makes memory-corruption exploits much easier.'
      : 'Partial ASLR leaves the heap unrandomised. Use 2 unless a very old binary needs it.')
  }

  const bpf = p.unprivileged_bpf_disabled
  if (bpf === 0 && hasReversibleBpfOff(hw)) {
    warn('bpf-unprivileged', ['unprivileged_bpf_disabled'],
      'Every user can load BPF programs, which exposes the BPF verifier, the source of several local privilege escalations.')
  }
  if (bpf === 0 && !hasReversibleBpfOff(hw)) {
    info('bpf-left-out', ['unprivileged_bpf_disabled'],
      'Kernels before 5.13 only accept 1 here, so the key is left out of the file and stays at the kernel default.')
  }
  if (bpf === 1) {
    info('bpf-locked', ['unprivileged_bpf_disabled'], hasReversibleBpfOff(hw)
      ? 'Value 1 can\'t be changed again until the next reboot. 2 gives the same protection and stays reversible.'
      : 'On kernels before 5.13 this can\'t be changed again until the next reboot.')
  }

  if (p.rp_filter === 1) {
    info('rp-strict-interfaces', ['rp_filter'],
      'The kernel applies the higher of conf.all and each interface\'s value, and systemd sets interfaces to 2 (loose). Lower them too, as the generated file explains, or strict mode has no effect.')
    if (hw.workload === 'router') {
      warn('rp-strict-router', ['rp_filter'],
        'Strict filtering drops legitimate traffic on asymmetric routes, which routers and VPN gateways often have. Loose (2) still drops unroutable sources.')
    }
    if (hw.workload === 'container') {
      warn('rp-strict-container', ['rp_filter'],
        'Some container network plugins route pod traffic asymmetrically and need loose (2) or off. Check what your CNI requires.')
    }
  }

  if (p.tcp_syncookies === 0) {
    warn('syncookies-off', ['tcp_syncookies'],
      'Without SYN cookies a SYN flood can fill the listen queue and lock out real clients.')
  }
  if (p.tcp_syncookies === 2) {
    warn('syncookies-always', ['tcp_syncookies'],
      '2 answers every connection with a cookie, even without a flood, which is meant for testing. Use 1.')
  }

  const redirects = ['accept_redirects', 'accept_redirects_v6'].filter((k) => p[k] === 1 && isApplicable(k, hw))
  if (redirects.length) {
    warn('redirects-accepted', redirects,
      'Accepting ICMP redirects lets anyone on the local network change this host\'s routes and put themselves in the middle.')
  }
  if (p.send_redirects === 1 && hw.workload !== 'router') {
    info('redirects-sent', ['send_redirects'], 'Only a router needs to send ICMP redirects.')
  }
  if (p.accept_source_route === 1) {
    warn('source-route', ['accept_source_route'],
      'Source-routed packets choose their own path through the network, which can get them around firewalls.')
  }

  for (const key of ['protected_symlinks', 'protected_hardlinks']) {
    if (p[key] === 0) {
      warn(`${key}-off`, [key],
        'Without this protection a user can plant links in shared directories such as /tmp and trick privileged programs into overwriting files.')
    }
  }

  if (p.suid_dumpable === 1) {
    warn('suid-dump-debug', ['suid_dumpable'],
      'Mode 1 writes core dumps of privileged processes that their user can read, which can leak password hashes and keys.')
  }
  if (p.suid_dumpable === 2) {
    info('suid-dump-pattern', ['suid_dumpable'],
      'Mode 2 only writes a dump when kernel.core_pattern is a pipe (such as systemd-coredump or apport) or an absolute path.')
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
