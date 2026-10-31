/**
 * Network-stack domain module. Bundles the defs and rules in this folder into
 * the generic TunerDomain shape. The first tuner with enum and tuple values:
 * congestion control and the qdisc are selects, the TCP buffers and the port
 * range are tuples.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE, LINK_BPS, RTT_SECONDS } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, KUBE_PROXY_DOCS } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable, bdpBytes, tcpBufferMax, windowLimitBps, WINDOW_SHARE } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue, formatBytes, formatRate } from './formatting.js'
import { PAGE, ABOUT } from './about.js'
import * as simulation from './simulation.js'
import ThroughputChart from './components/ThroughputChart.vue'

const SECTIONS = [
  {
    id: 'buffers',
    title: 'Socket buffers',
    summary: 'How much data one connection may have in flight, which caps its speed on long paths.',
    keys: ['tcp_rmem', 'tcp_wmem', 'rmem_max', 'wmem_max'],
  },
  {
    id: 'queues',
    title: 'Connection queues',
    summary: 'How many new connections and incoming packets may wait before the kernel drops them.',
    keys: ['somaxconn', 'tcp_max_syn_backlog', 'netdev_max_backlog'],
  },
  {
    id: 'tcp',
    title: 'TCP behaviour & queueing',
    summary: 'Congestion control, the qdisc, and how TCP restarts and probes the path.',
    keys: ['tcp_congestion_control', 'default_qdisc', 'tcp_slow_start_after_idle', 'tcp_mtu_probing'],
  },
  {
    id: 'ports',
    title: 'Connections & local ports',
    summary: 'Ports for outgoing connections, and how long closing sockets linger.',
    keys: ['ip_local_port_range', 'tcp_tw_reuse', 'tcp_fin_timeout'],
  },
  {
    id: 'conntrack',
    title: 'Connection tracking',
    summary: 'The netfilter table behind stateful firewalls, NAT, Docker and Kubernetes.',
    keys: ['nf_conntrack_max', 'nf_conntrack_buckets', 'nf_conntrack_tcp_timeout_established'],
  },
]

const GRAPH_TABS = [
  {
    id: 'throughput',
    label: 'Per-connection speed',
    component: ThroughputChart,
    blurb: 'The fastest one TCP connection can receive with this tcp_rmem max, as the round-trip time grows.',
  },
]

/**
 * Reference-drawer formula for the receive buffer, where the BDP arithmetic is
 * the whole point.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key !== 'tcp_rmem' && def.key !== 'rmem_max') return null
  const rtt = RTT_SECONDS[hardware.rtt]
  const link = LINK_BPS[hardware.link]
  return {
    title: 'Bandwidth-delay product and the window limit',
    lines: [
      'BDP = link speed / 8 × RTT',
      `needed max ≈ BDP / ${WINDOW_SHARE} (about half the buffer is advertised)`,
      'one connection ≤ max × 0.5 × 8 / RTT',
    ],
    values: [
      { label: 'BDP', v: formatBytes(bdpBytes(hardware)) },
      { label: 'suggested max', v: formatBytes(tcpBufferMax(hardware)) },
      { label: 'one connection now', v: formatRate(windowLimitBps(params.tcp_rmem[2], rtt, link)) },
    ],
  }
}

export const networkDomain = defineTuner({
  id: 'network',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  visibleKeys: (section, _params, hw) => section.keys.filter((k) => isApplicable(k, hw)),
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-network-tuning.conf',
  graphTabs: GRAPH_TABS,
  simulation,
  formula,
  workloads: ['web', 'bulk', 'container', 'router', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'K8s', label: 'Kubernetes', url: KUBE_PROXY_DOCS },
  contextApplies: (hw) => hw.workload === 'container',
  docsLabel: 'kernel.org docs',
  noteKey: 'k8sNote',
  page: PAGE,
  about: ABOUT,
})
