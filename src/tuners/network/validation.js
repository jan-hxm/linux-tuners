/**
 * Cross-parameter and profile-aware rules. Two settings block the output:
 * buffer bounds out of order (clearly broken) and a port range whose low end
 * is above its high end (the kernel rejects it). Everything else is legal and
 * gets a warning or an info note.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'error' | 'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {string}   [fix]     What to change to resolve it, in one plain sentence
 * @property {boolean}  blocking
 */

import { bdpBytes, windowLimitBps, CONNTRACK_ENTRY_BYTES, isApplicable } from './calculations.js'
import { LINK_BPS, RTT_SECONDS } from './profile.js'
import { PARAMETER_DEFS_BY_KEY } from './defs.js'
import { formatBytes, formatRate } from './formatting.js'

const GiB = 1024 * 1024 * 1024

/**
 * @param {import('./profile.js').NetworkSpec} hw
 * @param {import('./defs.js').NetworkValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const error = (id, params, message, fix) => issues.push({ id, level: 'error', blocking: true, params, message, fix })
  const warn = (id, params, message, fix) => issues.push({ id, level: 'warn', blocking: false, params, message, fix })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  for (const key of ['tcp_rmem', 'tcp_wmem']) {
    const [min, def, max] = p[key]
    if (min > def || def > max) {
      error(`${key}-order`, [key], 'The values must not decrease: min, then default, then max.',
        `Make the ${PARAMETER_DEFS_BY_KEY[key].sysctlName} min no larger than the default, and the default no larger than the max.`)
    }
  }

  const rttMs = RTT_SECONDS[hw.rtt] * 1000
  const linkBps = LINK_BPS[hw.link]
  const reach = windowLimitBps(p.tcp_rmem[2], RTT_SECONDS[hw.rtt], linkBps)
  if (reach < linkBps * 0.9) {
    warn('rmem-below-bdp', ['tcp_rmem'],
      `At ${rttMs} ms one connection can receive at most about ${formatRate(reach)} with this max. Filling the link needs about ${formatBytes(2 * bdpBytes(hw))}.`,
      'Raise the net.ipv4.tcp_rmem max toward that size.')
  }
  for (const key of ['tcp_rmem', 'tcp_wmem']) {
    if (p[key][2] > (hw.ramGiB * GiB) / 8) {
      warn(`${key}-vs-ram`, [key],
        `A single connection may grow its buffer to more than an eighth of RAM. A few fast connections could then crowd out other memory; the kernel's tcp_mem limit is the last line of defence.`,
        `Lower the ${PARAMETER_DEFS_BY_KEY[key].sysctlName} max to ${formatBytes((hw.ramGiB * GiB) / 8)} or less.`)
    }
  }
  if (p.rmem_max < p.tcp_rmem[2]) {
    info('rmem-max-below-tcp', ['rmem_max'],
      'Programs that set SO_RCVBUF themselves get less than autotuning would give them, since the request is capped here.')
  }

  if (p.tcp_congestion_control === 'bbr' && p.default_qdisc !== 'fq') {
    info('bbr-without-fq', ['tcp_congestion_control', 'default_qdisc'],
      'BBR paces its own packets, but it was designed around the fq qdisc, which paces them more cheaply and precisely.')
  }
  if (p.tcp_congestion_control === 'bbr' && hw.workload === 'desktop') {
    info('bbr-shared', ['tcp_congestion_control'],
      'On a shared home or office link, BBR uploads can take bandwidth from other people\'s CUBIC flows.')
  }
  if (p.default_qdisc === 'pfifo_fast') {
    warn('qdisc-fifo', ['default_qdisc'],
      'One bulk transfer can fill the queue and delay every other flow.',
      'Set net.core.default_qdisc to fq_codel or fq, which keep latency low under load.')
  }

  if (p.somaxconn < p.tcp_max_syn_backlog / 4) {
    info('accept-queue-small', ['somaxconn', 'tcp_max_syn_backlog'],
      'The accept queue is much smaller than the SYN queue, so a burst that completes its handshakes can still overflow it.')
  }

  if (p.tcp_tw_reuse === 1) {
    info('tw-reuse-global', ['tcp_tw_reuse'],
      'Applies only to outgoing connections and relies on TCP timestamps (tcp_timestamps = 1). The kernel docs advise changing it only on expert advice.')
  }
  if (p.tcp_fin_timeout < 10) {
    warn('fin-timeout-low', ['tcp_fin_timeout'],
      'Under 10 seconds a slow peer may not get to send its FIN before the socket is dropped, so it sees a reset.',
      'Raise net.ipv4.tcp_fin_timeout to 10 seconds or more.')
  }

  const [low, high] = p.ip_local_port_range
  if (low > high) {
    error('port-range-order', ['ip_local_port_range'], 'The kernel rejects a low end above the high end.',
      `Lower the low end of net.ipv4.ip_local_port_range to ${high} or less, or raise the high end to ${low} or more.`)
  } else {
    if (high - low < 10000) {
      warn('port-range-narrow', ['ip_local_port_range'],
        `Only ${(high - low + 1).toLocaleString()} local ports: a busy client of one backend can run out within a TIME_WAIT period.`,
        'Widen the range so the high end is at least 10000 above the low end.')
    }
    if (low % 2 === high % 2) {
      info('port-range-parity', ['ip_local_port_range'],
        'The kernel docs suggest one even and one odd end, so it can split connect() and bind() over separate halves.')
    }
    if (hw.workload === 'container' && low <= 32767 && high >= 30000) {
      warn('port-range-nodeport', ['ip_local_port_range'],
        'The range overlaps the Kubernetes NodePort range (30000 to 32767), so an outgoing connection can take a port a Service needs.',
        'Start the range at 32768 or above, or end it below 30000.')
    }
  }

  if (isApplicable('nf_conntrack_max', hw)) {
    const tableBytes = p.nf_conntrack_max * CONNTRACK_ENTRY_BYTES
    if (tableBytes > hw.ramGiB * GiB * 0.1) {
      warn('conntrack-memory', ['nf_conntrack_max'],
        `A full table takes about ${formatBytes(tableBytes)}, more than a tenth of RAM.`,
        `Lower net.netfilter.nf_conntrack_max to ${Math.floor((hw.ramGiB * GiB * 0.1) / CONNTRACK_ENTRY_BYTES).toLocaleString()} or less.`)
    }
    if (p.nf_conntrack_max > 4 * p.nf_conntrack_buckets) {
      warn('conntrack-chains', ['nf_conntrack_max', 'nf_conntrack_buckets'],
        'More than four entries per bucket: lookups slow down as the table fills.',
        `Raise net.netfilter.nf_conntrack_buckets to ${Math.ceil(p.nf_conntrack_max / 4).toLocaleString()} or more, or lower net.netfilter.nf_conntrack_max.`)
    }
    if (p.nf_conntrack_buckets > 2 * p.nf_conntrack_max) {
      info('conntrack-buckets-unused', ['nf_conntrack_buckets'],
        'Far more buckets than allowed entries: the extra ones use memory without speeding anything up.')
    }
    if (hw.workload === 'container') {
      info('conntrack-kube-proxy', ['nf_conntrack_max', 'nf_conntrack_tcp_timeout_established'],
        'kube-proxy writes nf_conntrack_max and the established timeout when it starts, overriding this file unless its conntrack settings are set to 0.')
    }
    if (p.nf_conntrack_tcp_timeout_established < 3600) {
      warn('conntrack-timeout-low', ['nf_conntrack_tcp_timeout_established'],
        'Connections idle for longer than this lose their entry and break behind NAT or a stateful firewall, unless their keepalive is shorter.',
        'Raise net.netfilter.nf_conntrack_tcp_timeout_established to 3600 seconds (one hour) or more.')
    }
    if (hw.workload === 'router' && p.nf_conntrack_max <= 262144 && hw.ramGiB >= 8) {
      info('conntrack-router', ['nf_conntrack_max'],
        'A NAT gateway tracks every connection of every client behind it; watch nf_conntrack_count at peak.')
    }
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
