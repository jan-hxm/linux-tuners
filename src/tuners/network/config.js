/**
 * Generate the sysctl.d drop-in. Pure function over (hardware, params,
 * presetLabel). The ConfigOutput component renders the returned file verbatim
 * into the textarea; what's here is what the user copies.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE, RTT_SECONDS } from './profile.js'
import { isApplicable, CONNTRACK_ENTRY_BYTES } from './calculations.js'
import { formatBytes } from './formatting.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { sysctlConfig } from '@/core/output/sysctlFile.js'

const PATH = '/etc/sysctl.d/99-network-tuning.conf'

const SECTIONS = [
  { id: 'buffers', title: 'Socket buffers' },
  { id: 'queues', title: 'Connection queues' },
  { id: 'tcp', title: 'TCP behaviour and queueing' },
  { id: 'ports', title: 'Connections and local ports' },
  { id: 'conntrack', title: 'Connection tracking (netfilter)' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').NetworkSpec} opts.hardware
 * @param {import('./defs.js').NetworkValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  const lines = []

  lines.push(rule())
  lines.push('# Linux network stack sysctls')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/network`)
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
  lines.push('#')
  lines.push('# 3. Verify a value took effect:')
  lines.push('#      sysctl net.ipv4.tcp_rmem')
  lines.push('#')
  lines.push(...noteBlock(hardware, params))
  lines.push('# Sources:')
  lines.push('#   IP sysctls: https://docs.kernel.org/networking/ip-sysctl.html')
  lines.push('#   net.core sysctls: https://docs.kernel.org/admin-guide/sysctl/net.html')
  if (hardware.conntrack === 'on') {
    lines.push('#   Conntrack sysctls: https://docs.kernel.org/networking/nf_conntrack-sysctl.html')
  }
  lines.push('')

  lines.push(...sysctlConfig({
    defs: PARAMETER_DEFS,
    sections: SECTIONS.filter((s) => s.id !== 'conntrack' || hardware.conntrack === 'on'),
    params,
    comment: (def, value) => commentFor(def, value),
    include: (def) => isApplicable(def.key, hardware),
  }))

  return [configFile(PATH, lines)]
}

/**
 * Caveats that depend on the chosen values: the qdisc only reaches new
 * interfaces, BBR needs its module, and the conntrack keys only exist once
 * nf_conntrack is loaded, which at boot happens after systemd-sysctl runs
 * unless the module is listed in modules-load.d.
 */
function noteBlock(hw, params) {
  const notes = []
  notes.push(
    '# default_qdisc reaches interfaces created after it is set. Existing',
    '# ones keep theirs until a reboot, or apply it now per interface',
    '# (replace eth0 with each interface name from ip link):',
    `#   sudo tc qdisc replace dev eth0 root ${params.default_qdisc}`,
  )
  if (params.tcp_congestion_control !== 'cubic' && params.tcp_congestion_control !== 'reno') {
    notes.push(
      '#',
      `# ${params.tcp_congestion_control} is a module. Check that the kernel has it:`,
      '#   sysctl net.ipv4.tcp_available_congestion_control',
      `#   sudo modprobe tcp_${params.tcp_congestion_control}   # if it is missing from the list`,
    )
  }
  if (hw.conntrack === 'on') {
    notes.push(
      '#',
      '# The net.netfilter keys exist only once nf_conntrack is loaded. At boot',
      '# that can happen after this file is applied, and the keys are then',
      '# skipped. Load the module first:',
      "#   echo nf_conntrack | sudo tee /etc/modules-load.d/nf_conntrack.conf",
      '# Before kernel 4.19 the TCP timeout keys come with nf_conntrack_ipv4:',
      "#   echo nf_conntrack_ipv4 | sudo tee -a /etc/modules-load.d/nf_conntrack.conf",
      '# nf_conntrack_buckets can only be written from the host, not from',
      '# inside a container.',
    )
  }
  return ['# NOTES', '#', ...notes, '#', rule(), '#']
}

/** @param {import('./profile.js').NetworkSpec} hw */
function describeSystem(hw) {
  const label = (key) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === hw[key]).label
  return `${label('workload')}, ${label('link')}, paths up to ${RTT_SECONDS[hw.rtt] * 1000} ms, ${hw.ramGiB} GiB RAM, conntrack ${hw.conntrack}`
}

/**
 * The inline comment for each value in the output file.
 *
 * @param {Object} def
 * @param {*} value
 */
function commentFor(def, value) {
  switch (def.key) {
    case 'rmem_max':
      return `SO_RCVBUF requests capped at ${formatBytes(value)}`
    case 'wmem_max':
      return `SO_SNDBUF requests capped at ${formatBytes(value)}`
    case 'tcp_rmem':
      return `TCP receive buffer ${value.map(formatBytes).join(' / ')} (min / start / autotune max)`
    case 'tcp_wmem':
      return `TCP send buffer ${value.map(formatBytes).join(' / ')} (min / start / autotune max)`
    case 'somaxconn':
      return 'accept queue ceiling per listener'
    case 'tcp_max_syn_backlog':
      return 'half-open connections per listener'
    case 'netdev_max_backlog':
      return 'received packets queued per CPU'
    case 'tcp_congestion_control':
      return 'congestion control for new connections'
    case 'default_qdisc':
      return 'qdisc for interfaces created from now on'
    case 'tcp_slow_start_after_idle':
      return value ? 'slow start again after idle (RFC 2861)' : 'keep the congestion window across idle pauses'
    case 'tcp_mtu_probing':
      return ['no packetization-layer MTU probing', 'probe the MTU once a black hole is detected', 'always probe the MTU'][value]
    case 'tcp_tw_reuse':
      return ['never reuse TIME_WAIT ports', 'reuse TIME_WAIT ports for outgoing connections', 'reuse TIME_WAIT ports for loopback only'][value]
    case 'tcp_fin_timeout':
      return 'seconds an orphaned socket waits in FIN_WAIT_2'
    case 'ip_local_port_range':
      return `${value[1] - value[0] + 1} local ports for outgoing connections`
    case 'nf_conntrack_max':
      return `tracked connections, about ${formatBytes(value * CONNTRACK_ENTRY_BYTES)} when full`
    case 'nf_conntrack_buckets':
      return 'conntrack hash table size'
    case 'nf_conntrack_tcp_timeout_established':
      return 'seconds an idle established connection stays tracked'
    default:
      return ''
  }
}
