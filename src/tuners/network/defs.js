/**
 * Static metadata for every network sysctl the tuner exposes, from net.core,
 * net.ipv4 and net.netfilter. Each entry is the single source of truth for the
 * key's name, group, kernel default, accepted values, description and source
 * link.
 *
 * Tuples (`type: 'tuple'`) hold each element to kernelMin..kernelMax and name
 * the elements in `tupleLabels`; enums offer only `options`. Several kernel
 * defaults scale with RAM; the def holds the value of a machine with more than
 * a few GiB, and its description says so.
 *
 * @typedef {'buffers' | 'queues' | 'tcp' | 'ports' | 'conntrack'} NetworkGroup
 *
 * @typedef {Object} NetworkValues
 * @property {number}   rmem_max
 * @property {number}   wmem_max
 * @property {number[]} tcp_rmem                  [min, default, max] bytes
 * @property {number[]} tcp_wmem                  [min, default, max] bytes
 * @property {number}   somaxconn
 * @property {number}   tcp_max_syn_backlog
 * @property {number}   netdev_max_backlog
 * @property {'cubic'|'bbr'|'reno'} tcp_congestion_control
 * @property {'fq_codel'|'fq'|'cake'|'pfifo_fast'} default_qdisc
 * @property {0|1}      tcp_slow_start_after_idle
 * @property {0|1|2}    tcp_mtu_probing
 * @property {0|1|2}    tcp_tw_reuse
 * @property {number}   tcp_fin_timeout           seconds
 * @property {number[]} ip_local_port_range       [low, high]
 * @property {number}   nf_conntrack_max
 * @property {number}   nf_conntrack_buckets
 * @property {number}   nf_conntrack_tcp_timeout_established  seconds
 */

const IP_DOCS = 'https://docs.kernel.org/networking/ip-sysctl.html'
const CORE_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/net.html'
const CT_DOCS = 'https://docs.kernel.org/networking/nf_conntrack-sysctl.html'

/** Source for the Kubernetes notes; rendered as a plain "Source" link. */
export const KUBE_PROXY_DOCS = 'https://kubernetes.io/docs/reference/command-line-tools-reference/kube-proxy/'

const MiB = 1024 * 1024

/** Highest socket buffer the sliders offer, whatever the profile. */
export const BUFFER_CEILING = 1024 * MiB

export const PARAMETER_DEFS = [
  // ── Socket buffers ────────────────────────────────────────────────────────
  {
    key: 'rmem_max',
    title: 'Largest receive buffer',
    tier: 'advanced',
    sysctlName: 'net.core.rmem_max',
    group: 'buffers',
    control: 'slider',
    shortDesc: 'The largest receive buffer a program may ask for with SO_RCVBUF.',
    longDesc: {
      what: [
        'Programs that size their own receive buffer with setsockopt(SO_RCVBUF), such as iperf, many UDP and QUIC servers, and some databases, are capped at this value. TCP sockets that let the kernel size the buffer (most of them) follow tcp_rmem instead, so raising this alone does not speed up ordinary TCP.',
      ],
      when: [
        'QUIC implementations (HTTP/3) commonly ask for 7 to 8 MiB of UDP buffer and log a warning when they get less. Newer kernels default to 4 MiB; older ones use 212992 bytes.',
      ],
    },
    tuningTip: 'Match the max of tcp_rmem, so programs that set their own buffer get as much as autotuning does.',
    kernelDocsUrl: `${CORE_DOCS}#rmem-max`,
    k8sNote: null,
    kernelDefault: 4 * MiB,
    kernelMin: 4096,
    kernelMax: BUFFER_CEILING,
    step: 4096,
    unit: 'bytes',
  },
  {
    key: 'wmem_max',
    title: 'Largest send buffer',
    tier: 'advanced',
    sysctlName: 'net.core.wmem_max',
    group: 'buffers',
    control: 'slider',
    shortDesc: 'The largest send buffer a program may ask for with SO_SNDBUF.',
    longDesc: {
      what: [
        'The send-side twin of rmem_max: programs that set setsockopt(SO_SNDBUF) are capped here, while TCP sockets the kernel sizes follow tcp_wmem.',
        'Newer kernels default to 4 MiB; older ones use 212992 bytes.',
      ],
    },
    tuningTip: 'Match the max of tcp_wmem.',
    kernelDocsUrl: `${CORE_DOCS}#wmem-max`,
    k8sNote: null,
    kernelDefault: 4 * MiB,
    kernelMin: 4096,
    kernelMax: BUFFER_CEILING,
    step: 4096,
    unit: 'bytes',
  },
  {
    key: 'tcp_rmem',
    title: 'TCP receive buffers',
    tier: 'essential',
    sysctlName: 'net.ipv4.tcp_rmem',
    group: 'buffers',
    type: 'tuple',
    length: 3,
    control: 'tuple',
    tupleLabels: ['min', 'default', 'max'],
    shortDesc: 'Receive buffer bounds for TCP sockets the kernel sizes itself.',
    longDesc: {
      what: [
        'Three byte counts: the buffer every socket keeps even under memory pressure, the size a new socket starts with, and the most receive autotuning may grow it to. The max decides how fast one connection can go: a sender can only have as much data in flight as the receiver advertises, and the kernel advertises roughly half its buffer (the rest covers bookkeeping overhead).',
      ],
      when: [
        'So one connection tops out near (max / 2) / round-trip time. With the common 6 MiB default that is about 250 Mbit/s at 100 ms, however fast the link. Long, fast paths need a larger max; local traffic rarely does.',
      ],
      watch: [
        'The kernel picks the max from RAM: up to 6 MiB on most kernels and 32 MiB on the newest, less on small machines. Each value must be at least 4096. Despite the name, the setting also covers IPv6 TCP.',
      ],
    },
    tuningTip: 'Set the max to about twice the bandwidth-delay product of your longest fast path; leave min and default alone.',
    kernelDocsUrl: `${IP_DOCS}#tcp-rmem`,
    k8sNote: null,
    kernelDefault: [4096, 131072, 6 * MiB],
    kernelMin: 4096,
    kernelMax: BUFFER_CEILING,
    step: 4096,
    unit: 'bytes',
  },
  {
    key: 'tcp_wmem',
    title: 'TCP send buffers',
    tier: 'essential',
    sysctlName: 'net.ipv4.tcp_wmem',
    group: 'buffers',
    type: 'tuple',
    length: 3,
    control: 'tuple',
    tupleLabels: ['min', 'default', 'max'],
    shortDesc: 'Send buffer bounds for TCP sockets the kernel sizes itself.',
    longDesc: {
      what: [
        'Three byte counts, like tcp_rmem: the reserved minimum, the starting size, and the most send autotuning may grow a buffer to. A sender needs at least one bandwidth-delay product of buffer to keep a long, fast path full.',
        'The kernel picks the max from RAM, up to 4 MiB. Each value must be at least 4096. The max is not limited by wmem_max.',
      ],
    },
    tuningTip: 'Raise the max together with tcp_rmem on machines that send bulk data over long paths.',
    kernelDocsUrl: `${IP_DOCS}#tcp-wmem`,
    k8sNote: null,
    kernelDefault: [4096, 16384, 4 * MiB],
    kernelMin: 4096,
    kernelMax: BUFFER_CEILING,
    step: 4096,
    unit: 'bytes',
  },

  // ── Connection queues ─────────────────────────────────────────────────────
  {
    key: 'somaxconn',
    title: 'Accept queue limit',
    tier: 'essential',
    sysctlName: 'net.core.somaxconn',
    group: 'queues',
    control: 'slider',
    shortDesc: 'The ceiling on a listening socket\'s accept queue.',
    longDesc: {
      what: [
        'A server\'s listen(fd, backlog) call is capped at this value. The queue holds connections that finished the handshake but that the program has not accepted yet; when it is full, new connections are dropped or retried, which shows up as latency spikes under bursts.',
      ],
      when: [
        'The default is 4096 since kernel 5.4 (128 before). Raising it only helps programs that ask for a larger backlog: nginx, HAProxy and most runtimes let you configure theirs.',
      ],
      watch: [
        'Values above 65535 are not offered: some kernels and programs store the backlog in 16 bits.',
      ],
    },
    tuningTip: '4096 is plenty for most servers; raise it for busy proxies, together with their own backlog setting.',
    kernelDocsUrl: `${IP_DOCS}#somaxconn`,
    k8sNote: null,
    kernelDefault: 4096,
    kernelMin: 128,
    kernelMax: 65535,
    step: 1,
    unit: 'count',
  },
  {
    key: 'tcp_max_syn_backlog',
    title: 'Half-open connection queue',
    tier: 'advanced',
    sysctlName: 'net.ipv4.tcp_max_syn_backlog',
    group: 'queues',
    control: 'slider',
    shortDesc: 'How many half-open connections (SYN received) each listener remembers.',
    longDesc: {
      what: [
        'Before the handshake completes, a connection waits in the SYN queue. When a burst of new clients, or a SYN flood, fills it, the kernel falls back to SYN cookies (if tcp_syncookies allows) or drops the SYN.',
        'The kernel sets this from RAM: 128 on very small machines, a few thousand on typical servers. It is a per-listener limit.',
      ],
    },
    tuningTip: 'Raise it alongside somaxconn on servers that take bursts of new connections.',
    kernelDocsUrl: `${IP_DOCS}#tcp-max-syn-backlog`,
    k8sNote: null,
    kernelDefault: 1024,
    kernelMin: 128,
    kernelMax: 262144,
    step: 1,
    unit: 'count',
  },
  {
    key: 'netdev_max_backlog',
    title: 'Incoming packet queue',
    tier: 'advanced',
    sysctlName: 'net.core.netdev_max_backlog',
    group: 'queues',
    control: 'slider',
    shortDesc: 'Packets queued per CPU when they arrive faster than the kernel processes them.',
    longDesc: {
      what: [
        'Received packets wait in a per-CPU backlog before the network stack handles them. When it overflows, packets are dropped and counted in the second column of /proc/net/softnet_stat.',
      ],
      when: [
        'The default of 1000 suits 1 Gbit/s. At 10 Gbit/s and above, short bursts can overflow it, so it is commonly raised to several thousand. A deeper queue costs memory and adds latency only while it is full.',
      ],
    },
    tuningTip: 'Raise it when the drop counter in /proc/net/softnet_stat grows.',
    kernelDocsUrl: `${CORE_DOCS}#netdev-max-backlog`,
    k8sNote: null,
    kernelDefault: 1000,
    kernelMin: 100,
    kernelMax: 262144,
    step: 100,
    unit: 'packets',
  },

  // ── TCP behaviour ─────────────────────────────────────────────────────────
  {
    key: 'tcp_congestion_control',
    title: 'Congestion control',
    tier: 'essential',
    sysctlName: 'net.ipv4.tcp_congestion_control',
    group: 'tcp',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'cubic', label: 'cubic (kernel default)' },
      { value: 'bbr', label: 'bbr (needs the tcp_bbr module)' },
      { value: 'reno', label: 'reno (always built in)' },
    ],
    shortDesc: 'The congestion control algorithm new TCP connections use.',
    longDesc: {
      what: [
        'Congestion control decides how fast a connection may send. CUBIC, the default, backs off when packets are lost. BBR instead models the path\'s bandwidth and round-trip time, which keeps throughput up on long paths with some random loss (cloud, mobile, intercontinental links) and keeps queues short.',
        'BBR ships as the tcp_bbr module on the major distributions, and the kernel loads it when this key names it. Check what your kernel has with sysctl net.ipv4.tcp_available_congestion_control. A listening socket\'s choice is inherited by the connections it accepts.',
      ],
      watch: [
        'BBR can take bandwidth from CUBIC flows on a shared bottleneck, so it fits servers better than a busy shared office link.',
      ],
    },
    tuningTip: 'Try bbr on servers that send over long or lossy paths; keep cubic elsewhere.',
    kernelDocsUrl: `${IP_DOCS}#tcp-congestion-control`,
    k8sNote: null,
    kernelDefault: 'cubic',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  {
    key: 'default_qdisc',
    title: 'Default queueing discipline',
    tier: 'essential',
    sysctlName: 'net.core.default_qdisc',
    group: 'tcp',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'fq_codel', label: 'fq_codel (systemd default)' },
      { value: 'fq', label: 'fq (fair queueing with pacing)' },
      { value: 'cake', label: 'cake (needs the sch_cake module)' },
      { value: 'pfifo_fast', label: 'pfifo_fast (kernel default)' },
    ],
    shortDesc: 'The queueing discipline new network interfaces get.',
    longDesc: {
      what: [
        'The qdisc orders packets waiting to leave an interface. The kernel default, pfifo_fast, is a plain queue that lets one bulk flow delay everyone else. systemd sets fq_codel, which gives each flow its own queue and keeps latency low under load.',
      ],
      when: [
        'fq adds per-flow pacing, which BBR was designed around and which also helps any server sending many flows. cake is aimed at home routers with shaping.',
      ],
      watch: [
        'It applies to interfaces created after the setting, so existing ones keep their qdisc until a reboot or tc qdisc replace. Multi-queue NICs get it per hardware queue.',
      ],
    },
    tuningTip: 'Keep fq_codel, or use fq on servers that run BBR.',
    kernelDocsUrl: `${CORE_DOCS}#default-qdisc`,
    k8sNote: null,
    kernelDefault: 'pfifo_fast',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  {
    key: 'tcp_slow_start_after_idle',
    title: 'Slow start after idle',
    tier: 'advanced',
    sysctlName: 'net.ipv4.tcp_slow_start_after_idle',
    group: 'tcp',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: restart slowly after an idle pause', off: 'off: resume at full speed after a pause' },
    shortDesc: 'Whether a connection falls back to slow start after it has been idle.',
    longDesc: {
      what: [
        'After an idle period of about one retransmission timeout, TCP shrinks its congestion window and ramps up again, as RFC 2861 suggests, in case the path changed meanwhile.',
      ],
      when: [
        'For long-lived connections that send in bursts (HTTP/2, gRPC, database clients) this means each burst starts slowly. Turning it off lets a burst go at the speed the connection had reached.',
      ],
    },
    tuningTip: 'Turn it off on servers with long-lived, bursty connections.',
    kernelDocsUrl: `${IP_DOCS}#tcp-slow-start-after-idle`,
    k8sNote: null,
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'tcp_mtu_probing',
    title: 'Path MTU probing',
    tier: 'advanced',
    sysctlName: 'net.ipv4.tcp_mtu_probing',
    group: 'tcp',
    control: 'segmented',
    segmentLabels: ['0: off', '1: on black hole', '2: always'],
    shortDesc: 'Whether TCP probes for the path MTU itself instead of trusting ICMP.',
    longDesc: {
      what: [
        'Path MTU discovery relies on ICMP "fragmentation needed" messages. When a firewall drops them, large packets vanish and connections hang after the handshake: a PMTU black hole, common with tunnels, VPNs and overlay networks.',
        'At 1 TCP starts probing smaller segment sizes once it detects such a black hole; at 2 it always probes, starting from tcp_base_mss. The kernel default is 0.',
      ],
    },
    tuningTip: 'Use 1 on hosts behind tunnels or overlays; it only acts when a black hole is detected.',
    kernelDocsUrl: `${IP_DOCS}#tcp-mtu-probing`,
    k8sNote: 'Overlay networks (VXLAN, Geneve, WireGuard) shrink the MTU, so 1 is a common node setting.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },

  // ── Connections and ports ─────────────────────────────────────────────────
  {
    key: 'tcp_tw_reuse',
    title: 'Reuse TIME_WAIT ports',
    tier: 'advanced',
    sysctlName: 'net.ipv4.tcp_tw_reuse',
    group: 'ports',
    control: 'segmented',
    segmentLabels: ['0: off', '1: all', '2: loopback'],
    shortDesc: 'Whether new outgoing connections may reuse ports still in TIME_WAIT.',
    longDesc: {
      what: [
        'A closed connection lingers in TIME_WAIT for 60 seconds so late packets can\'t confuse a new one. A host that opens many short outgoing connections to the same destination (a proxy, a client of a database or API) can run out of local ports while thousands sit there.',
        'At 1 the kernel may reuse a TIME_WAIT port for a new outgoing connection when TCP timestamps prove it safe. It never affects incoming connections. At 2, the default since kernel 4.18, it only does so for loopback traffic.',
      ],
      watch: [
        'The kernel docs advise changing it only on expert advice. Widening ip_local_port_range is the gentler fix.',
      ],
    },
    tuningTip: 'Keep 2; use 1 on proxies and clients that run out of local ports.',
    kernelDocsUrl: `${IP_DOCS}#tcp-tw-reuse`,
    k8sNote: null,
    kernelDefault: 2,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'segment',
  },
  {
    key: 'tcp_fin_timeout',
    title: 'FIN_WAIT_2 timeout',
    tier: 'advanced',
    sysctlName: 'net.ipv4.tcp_fin_timeout',
    group: 'ports',
    control: 'slider',
    shortDesc: 'How long an orphaned connection waits in FIN_WAIT_2 for the peer to close.',
    longDesc: {
      what: [
        'When a program closes a connection and the peer acknowledges but never sends its own FIN, the socket sits in FIN_WAIT_2. This sets how long the kernel keeps such orphaned sockets before dropping them.',
      ],
      when: [
        'It is often described as the TIME_WAIT timeout, but it is not: TIME_WAIT is fixed at 60 seconds. Lowering it frees memory on servers whose clients disappear without closing.',
      ],
    },
    tuningTip: 'Lower it to 15 to 30 on busy servers facing unreliable clients.',
    kernelDocsUrl: `${IP_DOCS}#tcp-fin-timeout`,
    k8sNote: null,
    kernelDefault: 60,
    kernelMin: 5,
    kernelMax: 300,
    step: 1,
    unit: 'seconds',
  },
  {
    key: 'ip_local_port_range',
    title: 'Outgoing port range',
    tier: 'essential',
    sysctlName: 'net.ipv4.ip_local_port_range',
    group: 'ports',
    type: 'tuple',
    length: 2,
    control: 'tuple',
    tupleLabels: ['low', 'high'],
    shortDesc: 'The ports the kernel picks from for outgoing connections.',
    longDesc: {
      what: [
        'Every outgoing TCP connection or unconnected UDP socket gets a local port from this range. One local port serves one connection to each destination address and port, so a host making many connections to the same backend runs out after about (high - low) of them within a TIME_WAIT period.',
      ],
      when: [
        'The default 32768 to 60999 gives 28232 ports. A wider range must stay clear of ports your services listen on, since the kernel may hand them out first. The kernel rejects a low end above the high end or below ip_unprivileged_port_start (1024).',
      ],
      watch: [
        'The kernel docs suggest the two ends have different parity (one even, one odd), which lets it spread connect() and bind() over separate halves.',
      ],
    },
    tuningTip: 'Widen it on proxies and API clients; keep it clear of your listening ports.',
    kernelDocsUrl: `${IP_DOCS}#ip-local-port-range`,
    k8sNote: 'Keep it clear of the NodePort range (30000 to 32767 by default); the default range already is.',
    kernelDefault: [32768, 60999],
    kernelMin: 1024,
    kernelMax: 65535,
    step: 1,
    unit: 'ports',
  },

  // ── Connection tracking ───────────────────────────────────────────────────
  {
    key: 'nf_conntrack_max',
    title: 'Connection tracking limit',
    tier: 'essential',
    sysctlName: 'net.netfilter.nf_conntrack_max',
    group: 'conntrack',
    control: 'slider',
    shortDesc: 'How many connections netfilter tracks at once.',
    longDesc: {
      what: [
        'Stateful firewall rules, NAT, Docker and Kubernetes services all rely on [[connection tracking|conntrack]]. When the table is full, the kernel drops new connections and logs "nf_conntrack: table full, dropping packet", which looks like random timeouts.',
      ],
      when: [
        'The default equals nf_conntrack_buckets, which the kernel sizes from RAM: 262144 on 64-bit machines with more than 4 GiB. Each entry takes roughly 300 bytes, so a million entries cost about 300 MiB.',
        'Compare the current count with sysctl net.netfilter.nf_conntrack_count.',
      ],
    },
    tuningTip: 'Raise it on NAT gateways and container hosts until the peak count stays well below it.',
    kernelDocsUrl: `${CT_DOCS}#nf-conntrack-max`,
    k8sNote: 'kube-proxy sets this itself at start-up, to 32768 per CPU core and at least 131072, unless configured not to.',
    kernelDefault: 262144,
    kernelMin: 1024,
    kernelMax: 8388608,
    step: 1024,
    unit: 'count',
  },
  {
    key: 'nf_conntrack_buckets',
    title: 'Connection tracking hash size',
    tier: 'advanced',
    sysctlName: 'net.netfilter.nf_conntrack_buckets',
    group: 'conntrack',
    control: 'slider',
    shortDesc: 'The size of the connection tracking hash table.',
    longDesc: {
      what: [
        'Lookups walk a hash chain, so a table with too few buckets for nf_conntrack_max makes every packet slower once the table fills. Each entry is hashed twice (original and reply direction), so with the default of one bucket per allowed entry, a full table averages chains of two.',
      ],
      watch: [
        'The kernel sizes it from RAM, between 1024 and 262144. It can be changed at runtime since kernel 4.8, but only in the initial network [[namespace]]: inside a container the write fails.',
      ],
    },
    tuningTip: 'Keep it near nf_conntrack_max.',
    kernelDocsUrl: `${CT_DOCS}#nf-conntrack-buckets`,
    k8sNote: null,
    kernelDefault: 262144,
    kernelMin: 1024,
    kernelMax: 4194304,
    step: 1024,
    unit: 'count',
  },
  {
    key: 'nf_conntrack_tcp_timeout_established',
    title: 'Idle TCP tracking timeout',
    tier: 'advanced',
    sysctlName: 'net.netfilter.nf_conntrack_tcp_timeout_established',
    group: 'conntrack',
    control: 'slider',
    shortDesc: 'How long an idle, established TCP connection stays in the tracking table.',
    longDesc: {
      what: [
        'An established connection that carries no packets keeps its entry for this long, 5 days by default. Clients that vanish without closing leave entries behind that only expire after it, which can fill the table on busy NAT hosts.',
      ],
      watch: [
        'Too low a value drops the entry of a connection that is merely quiet. The next packet then doesn\'t match, and behind NAT or a stateful firewall the connection breaks. Keep it above the longest idle period your applications use, or above their TCP keepalive interval.',
      ],
    },
    tuningTip: 'Lower it to a day on NAT gateways and container hosts.',
    kernelDocsUrl: `${CT_DOCS}#nf-conntrack-tcp-timeout-established`,
    k8sNote: 'kube-proxy sets this to 86400 (one day) at start-up by default.',
    kernelDefault: 432000,
    kernelMin: 600,
    kernelMax: 432000,
    step: 60,
    unit: 'seconds',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
