/**
 * The one list of tuners (Design.md §9 "Registry"). The router, routes-meta.js,
 * the landing cards, the header nav and the sitemap all derive from it.
 *
 * Plain data with no Vue imports: scripts/generate-static-routes.mjs reads it
 * under Node. Array order is the landing-card and header-nav order.
 *
 * A `planned` entry gets only a "Coming soon" card: no path, no route, no
 * sitemap entry. Flip it to `live` only once the tuner works (Design.md §6),
 * and add its lazy domain loader to TUNER_DOMAIN_LOADERS in src/router.js.
 */

/**
 * @typedef {Object} TunerEntry
 * @property {string}  id        kebab-case; matches the domain id for live tuners
 * @property {'live'|'planned'} status
 * @property {string}  title     Landing-card title
 * @property {string}  blurb     Landing-card text
 * @property {string[]} keys     Example keys shown on the card
 * @property {string}  [path]    Route path (live only), e.g. '/swap'
 * @property {string}  [navLabel] Header nav label (live only)
 * @property {Object}  [route]   Route metadata (live only): title, description,
 *                               ogTitle, priority, changefreq, jsonLdType
 */

/** @type {TunerEntry[]} */
export const TUNERS = [
  {
    id: 'swap',
    status: 'live',
    path: '/swap',
    navLabel: 'Swap & memory',
    title: 'Swap & memory',
    blurb: 'Hardware-aware tuning of vm.* sysctl parameters: swappiness, watermarks, dirty-page writeback, and OOM behaviour. Live graphs of swap pressure, watermark zones, and the dirty timeline.',
    keys: ['vm.swappiness', 'vm.min_free_kbytes', 'vm.watermark_scale_factor', 'vm.dirty_ratio', '…'],
    route: {
      title: 'Swap & memory tuner | linux-tuners.dev',
      description:
        'Tune Linux swap and memory sysctls from your hardware: swappiness, min_free_kbytes, watermarks and dirty writeback, with live graphs and a sysctl.d file.',
      ogTitle: 'Swap & memory tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'systemd',
    status: 'live',
    path: '/systemd',
    navLabel: 'systemd',
    title: 'systemd & resource limits',
    blurb: 'Tune systemd manager defaults and per-slice cgroup v2 resource control: accounting, task and FD limits, and CPU/memory/IO weights and caps for clustered and containerised Linux workloads.',
    keys: ['CPUWeight', 'MemoryMax', 'DefaultTasksMax', 'DefaultLimitNOFILE', '…'],
    route: {
      title: 'systemd & resource limits tuner | linux-tuners.dev',
      description:
        'Tune systemd resource control from your hardware: DefaultTasksMax, DefaultLimitNOFILE and per-slice CPU, memory and IO caps, with live graphs and drop-ins.',
      ogTitle: 'systemd & resource limits tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'security',
    status: 'live',
    path: '/security',
    navLabel: 'Security',
    title: 'Security hardening',
    blurb: 'A hardening profile (CIS-benchmark style) that pulls security-relevant sysctls together from kernel, net, and fs, covering pointer and dmesg restrictions, ptrace scope, reverse-path filtering, SYN cookies, and link protections.',
    keys: ['kernel.kptr_restrict', 'kernel.yama.ptrace_scope', 'net.ipv4.tcp_syncookies', 'fs.protected_symlinks', '…'],
    route: {
      title: 'Security hardening tuner | linux-tuners.dev',
      description:
        'Harden Linux with sysctls: kptr_restrict, ptrace_scope, ASLR, unprivileged BPF, rp_filter and SYN cookies. KSPP and CIS-style presets and a sysctl.d file.',
      ogTitle: 'Security hardening tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'network',
    status: 'live',
    path: '/network',
    navLabel: 'Network',
    title: 'Network stack',
    blurb: 'Tune net.core and net.ipv4 sysctls for throughput and latency, covering socket buffer sizes, the listen backlog, congestion control, TIME_WAIT reuse, and netfilter connection tracking.',
    keys: ['net.ipv4.tcp_rmem', 'net.ipv4.tcp_congestion_control', 'net.core.somaxconn', 'net.netfilter.nf_conntrack_max', '…'],
    route: {
      title: 'Network stack tuner | linux-tuners.dev',
      description:
        'Tune Linux network sysctls for your link: TCP buffers sized from the bandwidth-delay product, somaxconn, BBR with fq and conntrack, as a sysctl.d file.',
      ogTitle: 'Network stack tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'filesystem',
    status: 'live',
    path: '/filesystem',
    navLabel: 'Filesystem',
    title: 'Filesystem & file descriptors',
    blurb: 'Tune fs.* sysctls for file-heavy and event-driven workloads, covering the open-file ceilings, inotify watch limits for IDEs and Kubernetes nodes, and native AIO capacity for databases.',
    keys: ['fs.inotify.max_user_watches', 'fs.inotify.max_user_instances', 'fs.nr_open', 'fs.aio-max-nr', '…'],
    route: {
      title: 'Filesystem & file descriptors tuner | linux-tuners.dev',
      description:
        'Tune Linux fs.* sysctls for your workload: file-max, nr_open, inotify watches and instances, aio-max-nr, with their kernel memory cost and a sysctl.d file.',
      ogTitle: 'Filesystem & file descriptors tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'hugepages',
    status: 'live',
    path: '/hugepages',
    navLabel: 'Huge pages',
    title: 'Huge pages & memory layout',
    blurb: 'Tune huge page pools, Transparent Huge Pages and KSM for databases and VM hosts, plus the per-process memory map limit and NUMA zone reclaim. Writes a sysctl.d file and a tmpfiles.d file for the /sys settings.',
    keys: ['vm.nr_hugepages', 'transparent_hugepage/enabled', 'ksm/run', 'vm.max_map_count', '…'],
    route: {
      title: 'Huge pages & memory layout tuner | linux-tuners.dev',
      description:
        'Size Linux huge pages for your workload: nr_hugepages, Transparent Huge Pages, KSM for KVM hosts and max_map_count, with sysctl.d and tmpfiles.d files.',
      ogTitle: 'Huge pages & memory layout tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'sysv-ipc',
    status: 'live',
    path: '/sysv-ipc',
    navLabel: 'IPC',
    title: 'System V IPC & shared memory',
    blurb: 'Set the System V shared memory, semaphore and message queue limits that Oracle, Db2 and older middleware check, without values from old guides lowering the kernel defaults.',
    keys: ['kernel.sem', 'kernel.shmmni', 'kernel.msgmnb', 'kernel.msgmax', '…'],
    route: {
      title: 'System V IPC & shared memory tuner | linux-tuners.dev',
      description:
        'Tune Linux System V IPC limits: shmmni, kernel.sem, msgmni, msgmax and msgmnb, checked against the Oracle and Db2 minimums, with a commented sysctl.d file.',
      ogTitle: 'System V IPC & shared memory tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'kernel',
    status: 'live',
    path: '/kernel',
    navLabel: 'Kernel',
    title: 'Kernel limits & panics',
    blurb: 'Set the process and thread ceilings, the key quotas containers run into, whether a crashed machine reboots, and which kernel messages reach the console.',
    keys: ['kernel.threads-max', 'kernel.keys.maxkeys', 'kernel.panic', 'kernel.sysrq', '…'],
    route: {
      title: 'Kernel limits & panics tuner | linux-tuners.dev',
      description:
        'Tune Linux kernel.* sysctls: pid_max, threads-max, key quotas, panic and oops handling, SysRq and the console loglevel, with a commented sysctl.d file.',
      ogTitle: 'Kernel limits & panics tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  {
    id: 'block-io',
    status: 'live',
    path: '/block-io',
    navLabel: 'Block I/O',
    title: 'Block I/O & storage',
    blurb: 'Pick the I/O scheduler, request depth, read-ahead and merging for NVMe, SATA and virtual disks, written as udev rules that apply at boot and on hotplug.',
    keys: ['queue/scheduler', 'queue/nr_requests', 'queue/read_ahead_kb', 'queue/nomerges', '…'],
    route: {
      title: 'Block I/O & storage tuner | linux-tuners.dev',
      description:
        'Tune Linux block I/O for your disks: I/O scheduler, nr_requests, read_ahead_kb and nomerges for NVMe, SSDs, hard disks and virtio, as a udev rules file.',
      ogTitle: 'Block I/O & storage tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  // Roadmap toward the whole sysctl tree plus the key sysfs runtime tunables,
  // grouped by what an operator tunes together (e.g. hardening keys from
  // kernel/net/fs live in one "Security hardening" tuner).
  {
    id: 'cpu-power',
    status: 'planned',
    title: 'CPU frequency & power',
    blurb: 'Tune CPU frequency scaling and placement through sysfs, covering the cpufreq governor, min and max frequencies, the energy-vs-performance bias, and NUMA balancing.',
    keys: ['scaling_governor', 'scaling_max_freq', 'kernel.numa_balancing', '…'],
  },
]

export const LIVE_TUNERS = TUNERS.filter((t) => t.status === 'live')
export const PLANNED_TUNERS = TUNERS.filter((t) => t.status === 'planned')
