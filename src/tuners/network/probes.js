/**
 * What the networking guide (learn.js) measures on each VM image: every
 * setting it explains and every real part its figures name. Plain data in the
 * frozen probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and
 * by the guide contract suite. Ids are prefixed `network.`.
 *
 * The conntrack keys exist only with the nf_conntrack module loaded; the
 * capture loads it after boot, as the VM suite does (vm/capture.mjs).
 */

export const PROBES = {
  // The seventeen settings, one per def.
  'network.rmemMax': { kind: 'sysctl', name: 'net.core.rmem_max' },
  'network.wmemMax': { kind: 'sysctl', name: 'net.core.wmem_max' },
  'network.tcpRmem': { kind: 'sysctl', name: 'net.ipv4.tcp_rmem' },
  'network.tcpWmem': { kind: 'sysctl', name: 'net.ipv4.tcp_wmem' },
  'network.somaxconn': { kind: 'sysctl', name: 'net.core.somaxconn' },
  'network.synBacklog': { kind: 'sysctl', name: 'net.ipv4.tcp_max_syn_backlog' },
  'network.netdevBacklog': { kind: 'sysctl', name: 'net.core.netdev_max_backlog' },
  'network.congestionControl': { kind: 'sysctl', name: 'net.ipv4.tcp_congestion_control' },
  'network.defaultQdisc': { kind: 'sysctl', name: 'net.core.default_qdisc' },
  'network.slowStartAfterIdle': { kind: 'sysctl', name: 'net.ipv4.tcp_slow_start_after_idle' },
  'network.mtuProbing': { kind: 'sysctl', name: 'net.ipv4.tcp_mtu_probing' },
  'network.twReuse': { kind: 'sysctl', name: 'net.ipv4.tcp_tw_reuse' },
  'network.finTimeout': { kind: 'sysctl', name: 'net.ipv4.tcp_fin_timeout' },
  'network.portRange': { kind: 'sysctl', name: 'net.ipv4.ip_local_port_range' },
  'network.conntrackMax': { kind: 'sysctl', name: 'net.netfilter.nf_conntrack_max' },
  'network.conntrackBuckets': { kind: 'sysctl', name: 'net.netfilter.nf_conntrack_buckets' },
  'network.conntrackEstablished': { kind: 'sysctl', name: 'net.netfilter.nf_conntrack_tcp_timeout_established' },

  // The parts the figures name.
  'network.softnetStat': { kind: 'file', path: '/proc/net/softnet_stat', exists: true },
  'network.netstat': { kind: 'file', path: '/proc/net/netstat', exists: true },
  'network.sockstat': { kind: 'file', path: '/proc/net/sockstat', exists: true },
  'network.syncookies': { kind: 'sysctl', name: 'net.ipv4.tcp_syncookies' },
  'network.availableCc': { kind: 'sysctl', name: 'net.ipv4.tcp_available_congestion_control' },
  'network.baseMss': { kind: 'sysctl', name: 'net.ipv4.tcp_base_mss' },
  'network.conntrackCount': { kind: 'sysctl', name: 'net.netfilter.nf_conntrack_count' },
}
