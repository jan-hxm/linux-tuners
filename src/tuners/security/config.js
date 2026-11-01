/**
 * Generate the sysctl.d drop-in. Pure function over (hardware, params,
 * presetLabel). The ConfigOutput component renders the returned file verbatim
 * into the textarea; what's here is what the user copies.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { isEmitted } from './calculations.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'

const PATH = '/etc/sysctl.d/99-security-hardening.conf'

const SECTIONS = [
  { id: 'kernel', title: 'Kernel information and attack surface' },
  { id: 'network', title: 'Network' },
  { id: 'filesystem', title: 'Filesystem links and core dumps' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').SecuritySpec} opts.hardware
 * @param {import('./defs.js').SecurityValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []

  lines.push(rule())
  lines.push('# Linux security hardening sysctls')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/security`)
  lines.push(`# System: ${describeSystem(hardware)}`)
  lines.push(`# Profile: ${presetSummary(presetLabel, customised)}`)
  lines.push(rule())
  lines.push('#')
  lines.push('# HOW TO APPLY THESE SETTINGS')
  lines.push('#')
  lines.push('# 1. Persist them. Save this whole file as a drop-in (sysctl ignores')
  lines.push('#    the comment lines, and any *.conf in /etc/sysctl.d/ loads on boot):')
  lines.push(`#      sudo nano ${PATH}   # then paste this file`)
  lines.push('#')
  lines.push('# 2. Apply them now, without rebooting:')
  lines.push('#      sudo sysctl --system')
  lines.push('#    Test on one machine first: some values can break debuggers,')
  lines.push('#    profilers, VPNs or container networking (see the notes per key).')
  lines.push('#')
  lines.push('# 3. Verify a value took effect:')
  lines.push('#      sysctl kernel.kptr_restrict')
  lines.push('#')
  lines.push(...oneWayBlock(hardware, params))
  lines.push(...interfaceBlock(hardware, params))
  lines.push(...apportBlock(params))
  lines.push('# Sources:')
  lines.push('#   Kernel sysctl docs: https://docs.kernel.org/admin-guide/sysctl/')
  lines.push('#   IP sysctls: https://docs.kernel.org/networking/ip-sysctl.html')
  lines.push('#   KSPP recommended settings: https://kspp.github.io/Recommended_Settings')
  lines.push('')

  lines.push(...sysctlConfig({
    defs: PARAMETER_DEFS,
    sections: SECTIONS,
    params,
    comment: (def, value) => commentFor(def, value, hardware),
    include: (def) => isEmitted(def.key, hardware, params),
  }))

  return [configFile(PATH, lines)]
}

/** A warning block for values that can't be lowered again until reboot. */
function oneWayBlock(hw, params) {
  const locked = []
  if (params.ptrace_scope === 3) locked.push('kernel.yama.ptrace_scope = 3')
  if (params.unprivileged_bpf_disabled === 1) locked.push('kernel.unprivileged_bpf_disabled = 1')
  if (!locked.length) return []
  return [
    '# ONE-WAY SETTINGS',
    '#',
    '# These can\'t be changed again until the next reboot once applied:',
    ...locked.map((l) => `#   ${l}`),
    '# To undo them, remove the lines from this file and reboot.',
    '#',
    rule(),
    '#',
  ]
}

/** Ubuntu's crash reporter raises suid_dumpable again after boot. */
function apportBlock(params) {
  if (params.suid_dumpable !== 0) return []
  return [
    '# UBUNTU: apport sets fs.suid_dumpable to 2 each time it starts, which',
    '# is after this file is applied. To keep 0, turn apport off:',
    '#   sudo systemctl disable --now apport',
    '#',
    rule(),
    '#',
  ]
}

/**
 * The all/default caveat for the per-interface network keys. IPv4 copies a
 * conf.default write to existing interfaces whose own value was never set;
 * one that systemd or another tool set keeps it. IPv6 never copies, and for
 * accept_redirects it reads only the interface's own value.
 */
function interfaceBlock(hw, params) {
  const strictRp = params.rp_filter === 1
  const v6Redirects = isEmitted('accept_redirects_v6', hw, params) && params.accept_redirects_v6 === 0
  const globs = []
  if (strictRp) globs.push('net.ipv4.conf.*.rp_filter = 1')
  if (v6Redirects) globs.push('net.ipv6.conf.*.accept_redirects = 0')
  const out = [
    '# NETWORK INTERFACES',
    '#',
    '# The conf.all and conf.default keys below don\'t reach every interface',
    '# that exists when this file is applied: an IPv4 interface whose own',
    '# value was set (systemd sets rp_filter on each one) keeps it, and IPv6',
    '# interfaces always keep theirs. For IPv4 redirects the kernel honours',
    '# either the conf.all or the interface value. Check the interfaces after',
    '# applying:',
    "#   sysctl -a 2>/dev/null | grep -E '\\.(rp_filter|accept_redirects|send_redirects)'",
  ]
  if (strictRp) {
    out.push(
      '#',
      '# Strict rp_filter: the kernel uses the higher of conf.all and the',
      '# interface value, and systemd sets every interface to 2 (loose).',
      '# NetworkManager also sets each interface it manages back to 2 when it',
      '# brings the connection up, so strict mode doesn\'t hold where it runs.',
    )
  }
  if (v6Redirects) {
    out.push(
      '#',
      '# IPv6 redirects: the kernel only reads each interface\'s own value, so',
      '# interfaces that exist before this file is applied (often the main one',
      '# at boot) keep accepting redirects.',
    )
  }
  if (globs.length) {
    out.push(
      '#',
      `# To cover every interface, add ${globs.length > 1 ? 'these lines' : 'this line'} to the end of this file:`,
      ...globs.map((g) => `#   ${g}`),
      '# systemd 245 and newer (systemctl --version) apply them at boot and to',
      '# each interface as it appears; apply them now with',
      '#   sudo systemctl restart systemd-sysctl',
      '# since sysctl from procps before 4.0 rejects them. Older systemd skips',
      '# them: name each interface instead, e.g. net.ipv4.conf.eth0.rp_filter.',
    )
  }
  out.push('#', rule(), '#')
  return out
}

/** @param {import('./profile.js').SecuritySpec} hw */
function describeSystem(hw) {
  const label = (key) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === hw[key]).label
  return `${label('workload')}, kernel ${label('kernel')}, IPv6 ${hw.ipv6}`
}

/**
 * The inline comment for each value in the output file.
 *
 * @param {Object} def
 * @param {number} value
 * @param {import('./profile.js').SecuritySpec} hw
 */
function commentFor(def, value, hw) {
  switch (def.key) {
    case 'kptr_restrict':
      return [
        hw.kernel === 'legacy' ? 'kernel pointers hashed on 4.15+, shown in full before' : 'kernel pointers hashed',
        'kernel pointers hidden without CAP_SYSLOG',
        'kernel pointers hidden from everyone',
      ][value]
    case 'dmesg_restrict':
      return value ? 'kernel log needs CAP_SYSLOG' : 'kernel log readable by every user'
    case 'perf_event_paranoid':
      return [
        'users may collect CPU-wide perf events',
        'users may profile their own processes, kernel included',
        'users may profile the user space of their own processes',
        'no unprivileged perf on Debian, Android and older Ubuntu kernels, otherwise same as 2',
        'no unprivileged perf on Debian, Ubuntu and Android kernels, otherwise same as 2',
      ][value]
    case 'ptrace_scope':
      return [
        'classic ptrace: same-user processes may attach',
        'ptrace only of descendants',
        'ptrace needs CAP_SYS_PTRACE',
        'ptrace disabled, locked until reboot',
      ][value]
    case 'randomize_va_space':
      return ['ASLR off', 'partial ASLR, heap not randomised', 'full ASLR'][value]
    case 'unprivileged_bpf_disabled':
      return ['unprivileged bpf() allowed', 'unprivileged bpf() off, locked until reboot', 'unprivileged bpf() off'][value]
    case 'rp_filter':
      return ['no reverse-path filtering', 'strict reverse-path filtering (RFC 3704)', 'loose reverse-path filtering'][value]
    case 'tcp_syncookies':
      return ['SYN cookies off', 'SYN cookies when the listen queue overflows', 'SYN cookies for every connection'][value]
    case 'accept_redirects':
    case 'accept_redirects_v6':
      return value ? 'accept ICMP redirects' : 'ignore ICMP redirects'
    case 'send_redirects':
      return value ? 'send ICMP redirects (routers only)' : 'never send ICMP redirects'
    case 'accept_source_route':
      return value ? 'accept source-routed packets' : 'drop source-routed packets'
    case 'protected_symlinks':
      return value ? 'restrict following symlinks in sticky dirs' : 'symlinks unrestricted'
    case 'protected_hardlinks':
      return value ? 'restrict hard links to others\' files' : 'hard links unrestricted'
    case 'protected_fifos':
      return ['FIFOs unrestricted', 'protect FIFOs in world-writable sticky dirs', 'protect FIFOs in group-writable sticky dirs too'][value]
    case 'protected_regular':
      return ['regular files unrestricted', 'protect files in world-writable sticky dirs', 'protect files in group-writable sticky dirs too'][value]
    case 'suid_dumpable':
      return ['no core dumps of privileged processes', 'privileged processes dump as the user (insecure)', 'privileged dumps readable by root only'][value]
    default:
      return ''
  }
}
