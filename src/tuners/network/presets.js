/**
 * Built-in presets. Each is a partial NetworkValues: keys it doesn't name keep
 * the profile's starting value (store.applyPreset), so the buffers, which
 * depend on the link and path, stay sized for the profile. Every value must
 * work on every profile; the contract suite checks that.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').NetworkValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'Every key with a fixed upstream default back at that default. Buffers and the RAM-sized limits keep their profile values. A baseline to compare against.',
    source: 'docs.kernel.org networking/ip-sysctl, admin-guide/sysctl/net, networking/nf_conntrack-sysctl',
    values: {
      somaxconn: 4096,
      netdev_max_backlog: 1000,
      tcp_congestion_control: 'cubic',
      default_qdisc: 'pfifo_fast',
      tcp_slow_start_after_idle: 1,
      tcp_mtu_probing: 0,
      tcp_tw_reuse: 2,
      tcp_fin_timeout: 60,
      ip_local_port_range: [32768, 60999],
      nf_conntrack_tcp_timeout_established: 432000,
    },
  },
  {
    id: 'bbr',
    label: 'BBR with fq',
    description: 'BBR congestion control with the fq qdisc for pacing, and no slow restart after idle. For servers that send over long or lossy paths.',
    source: 'Google BBR documentation (github.com/google/bbr), ip-sysctl',
    values: {
      tcp_congestion_control: 'bbr',
      default_qdisc: 'fq',
      tcp_slow_start_after_idle: 0,
      tcp_mtu_probing: 1,
    },
  },
  {
    id: 'proxy',
    label: 'Busy proxy',
    description: 'Deep accept and SYN queues, a wide local port range and TIME_WAIT reuse, for load balancers and reverse proxies that make many short connections to backends.',
    source: 'ip-sysctl; common HAProxy and nginx tuning guidance',
    values: {
      somaxconn: 65535,
      tcp_max_syn_backlog: 65535,
      tcp_tw_reuse: 1,
      tcp_fin_timeout: 15,
      ip_local_port_range: [16384, 65535],
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
