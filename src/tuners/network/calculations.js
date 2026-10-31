import { PARAMETER_DEFS_BY_KEY, BUFFER_CEILING } from './defs.js'
import { LINK_BPS, RTT_SECONDS } from './profile.js'

const MiB = 1024 * 1024
const GiB = 1024 * MiB

/** The tcp_rmem/tcp_wmem max most kernels pick on a machine with a few GiB. */
const KERNEL_TCP_RMEM_MAX = 6 * MiB

/** Rough size of one conntrack entry, for the memory estimates. */
export const CONNTRACK_ENTRY_BYTES = 320

/** Share of a TCP buffer the kernel advertises as window (tcp_adv_win_scale = 1). */
export const WINDOW_SHARE = 0.5

/**
 * Bandwidth-delay product of the profile's link and path, in bytes: how much
 * data must be in flight to keep the link full.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 */
export function bdpBytes(hw) {
  return Math.round((LINK_BPS[hw.link] / 8) * RTT_SECONDS[hw.rtt])
}

/** The smallest power of two at or above n. */
function nextPow2(n) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, n)))
}

/** The largest power of two at or below n. */
function prevPow2(n) {
  return 2 ** Math.floor(Math.log2(Math.max(1, n)))
}

/**
 * The highest buffer the sliders offer on this profile: four BDPs, at least
 * 64 MiB, at most 1 GiB. Keeps the slider usable on short paths.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 */
export function bufferCeiling(hw) {
  return Math.min(BUFFER_CEILING, Math.max(64 * MiB, nextPow2(4 * bdpBytes(hw))))
}

/**
 * The autotuning max that lets one connection fill the link: twice the BDP
 * (the kernel advertises about half the buffer), rounded up to a power of two.
 * Never below the usual kernel default, and at most a 16th of RAM.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 */
export function tcpBufferMax(hw) {
  const ramCap = prevPow2((hw.ramGiB * GiB) / 16)
  const wanted = nextPow2(bdpBytes(hw) / WINDOW_SHARE)
  return Math.max(KERNEL_TCP_RMEM_MAX, Math.min(wanted, ramCap, bufferCeiling(hw)))
}

/**
 * nf_conntrack_buckets as the kernel sizes it from RAM on a 64-bit machine:
 * 262144 above 4 GiB, 65536 above 1 GiB, otherwise RAM / 16384 / 8 (at least
 * 1024). nf_conntrack_max defaults to the same number.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 */
export function kernelConntrackDefault(hw) {
  if (hw.ramGiB > 4) return 262144
  if (hw.ramGiB > 1) return 65536
  return Math.max(1024, Math.round((hw.ramGiB * GiB) / 16384 / 8))
}

/**
 * The receive backlog for the link speed: the kernel's 1000 suits 1 Gbit/s,
 * faster links take bursts that overflow it. Opinionated.
 */
const NETDEV_BACKLOG = { '1g': 1000, '10g': 8192, '25g': 16384, '100g': 32768 }

/**
 * Profile-aware starting values. Buffers follow the bandwidth-delay product,
 * queues and ports follow the workload, and conntrack is sized for NAT and
 * container hosts. Opinionated starting points, not kernel constants.
 *
 * @param {import('./profile.js').NetworkSpec} hw
 * @returns {import('./defs.js').NetworkValues}
 */
export function deriveDefaults(hw) {
  const w = hw.workload
  const busy = w === 'web' || w === 'container'
  const natHost = w === 'container' || w === 'router'
  const bufMax = tcpBufferMax(hw)
  // BBR pays off on long paths; on a LAN cubic is as good and the safer default.
  const bbr = w === 'bulk' && hw.rtt !== 'lan'
  // NAT and container hosts get 16384 entries per GiB, about 0.5% of RAM.
  const conntrackMax = natHost
    ? Math.min(4194304, Math.max(kernelConntrackDefault(hw), prevPow2(hw.ramGiB * 16384)))
    : kernelConntrackDefault(hw)
  return {
    rmem_max: bufMax,
    wmem_max: bufMax,
    tcp_rmem: [4096, 131072, bufMax],
    tcp_wmem: [4096, 16384, bufMax],
    somaxconn: busy ? 16384 : 4096,
    tcp_max_syn_backlog: busy ? 16384 : 4096,
    netdev_max_backlog: w === 'desktop' ? 1000 : NETDEV_BACKLOG[hw.link],
    tcp_congestion_control: bbr ? 'bbr' : 'cubic',
    default_qdisc: bbr ? 'fq' : 'fq_codel',
    tcp_slow_start_after_idle: w === 'web' || w === 'bulk' ? 0 : 1,
    tcp_mtu_probing: w === 'container' ? 1 : 0,
    tcp_tw_reuse: 2,
    tcp_fin_timeout: w === 'web' ? 30 : 60,
    // Containers keep the default: it stays clear of the NodePort range.
    ip_local_port_range: w === 'web' ? [16384, 65535] : [32768, 60999],
    nf_conntrack_max: conntrackMax,
    nf_conntrack_buckets: conntrackMax,
    nf_conntrack_tcp_timeout_established: natHost ? 86400 : 432000,
  }
}

/**
 * The values the sliders and tuple fields offer. A tuple's range holds each
 * element; buffer ranges grow with the profile's BDP.
 *
 * @param {string} key
 * @param {import('./profile.js').NetworkSpec} hw
 * @returns {{ min: number, max: number }}
 */
export function rangeFor(key, hw) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown network parameter: ${key}`)
  if (def.group === 'buffers') return { min: def.kernelMin, max: bufferCeiling(hw) }
  return { min: def.kernelMin, max: def.kernelMax }
}

/** Whether a key exists on the profile's system: the netfilter keys need conntrack. */
export function isApplicable(key, hw) {
  return PARAMETER_DEFS_BY_KEY[key].group !== 'conntrack' || hw.conntrack === 'on'
}

/**
 * The fastest one connection can go with this receive buffer max and RTT, in
 * bit/s: the advertised window per round trip, capped at the link speed.
 *
 * @param {number} bufferMax  tcp_rmem max in bytes
 * @param {number} rttSeconds
 * @param {number} linkBps
 */
export function windowLimitBps(bufferMax, rttSeconds, linkBps) {
  return Math.min(linkBps, (bufferMax * WINDOW_SHARE * 8) / rttSeconds)
}
