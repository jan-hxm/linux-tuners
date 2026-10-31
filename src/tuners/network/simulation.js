/**
 * Teaching-model simulations for the network tuner: pure functions over
 * hardware + params, consumed reactively by the chart and the impact bar
 * (ui/useTunerSimulation). The throughput model is the window limit, one
 * advertised window per round trip, with no loss and no competing traffic,
 * so it shows the ceiling the buffers set, not a prediction.
 */

import { bdpBytes, windowLimitBps, CONNTRACK_ENTRY_BYTES, isApplicable } from './calculations.js'
import { LINK_BPS, RTT_SECONDS } from './profile.js'
import { formatBytes, formatRate } from './formatting.js'

/** RTTs the throughput chart samples, in ms. */
export const RTT_SAMPLES_MS = [1, 2, 5, 10, 20, 50, 100, 150, 200, 300]

/** The tcp_rmem max the chart compares against: the usual kernel default. */
const DEFAULT_RMEM_MAX = 6 * 1024 * 1024

/**
 * One connection's throughput ceiling over a range of RTTs, for the tuned
 * receive buffer and for the kernel default, capped at the link speed.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 * @param {import('./defs.js').NetworkValues} p
 */
export function throughputCurve(hw, p) {
  const linkBps = LINK_BPS[hw.link]
  const bufMax = p.tcp_rmem[2]
  const rttSeconds = RTT_SECONDS[hw.rtt]
  return {
    points: RTT_SAMPLES_MS.map((ms) => ({
      rttMs: ms,
      tunedGbps: windowLimitBps(bufMax, ms / 1000, linkBps) / 1e9,
      defaultGbps: windowLimitBps(DEFAULT_RMEM_MAX, ms / 1000, linkBps) / 1e9,
    })),
    linkGbps: linkBps / 1e9,
    rttMs: rttSeconds * 1000,
    reachBps: windowLimitBps(bufMax, rttSeconds, linkBps),
    linkBps,
    bdp: bdpBytes(hw),
    bufMax,
  }
}

/**
 * Metrics for the mobile impact bar.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 * @param {import('./defs.js').NetworkValues} p
 */
export function impactSummary(hw, p) {
  const { reachBps, linkBps, rttMs, bdp } = throughputCurve(hw, p)
  const share = reachBps / linkBps
  const metrics = [
    {
      id: 'reach',
      label: `One connection at ${rttMs} ms`,
      value: formatRate(reachBps),
      band: share >= 0.9 ? 'low' : share >= 0.5 ? 'med' : 'high',
    },
    { id: 'bdp', label: 'Bandwidth-delay product', value: formatBytes(bdp), band: 'none' },
  ]
  if (isApplicable('nf_conntrack_max', hw)) {
    const bytes = p.nf_conntrack_max * CONNTRACK_ENTRY_BYTES
    const ramShare = bytes / (hw.ramGiB * 1024 ** 3)
    metrics.push({
      id: 'conntrack',
      label: 'Conntrack table when full',
      value: formatBytes(bytes),
      band: ramShare > 0.1 ? 'high' : ramShare > 0.02 ? 'med' : 'none',
    })
  }
  return metrics
}
