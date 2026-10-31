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
        'Hardware-aware tuner for Linux vm.* sysctl parameters: swappiness, min_free_kbytes, watermark scaling, dirty-page writeback, OOM behaviour. Live simulation of swap pressure, watermark zones, and dirty timeline.',
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
        'Hardware-aware tuner for systemd resource control: manager defaults (accounting, DefaultTasksMax, DefaultLimitNOFILE/MEMLOCK) and per-slice cgroup v2 controls (CPUWeight, CPUQuota, MemoryHigh/Max, IOWeight, TasksMax). Live CPU-share, memory-budget and task-cap graphs with copy-pasteable drop-ins.',
      ogTitle: 'systemd & resource limits tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
  },
  // Roadmap toward the whole sysctl tree plus the key sysfs runtime tunables,
  // grouped by what an operator tunes together (e.g. hardening keys from
  // kernel/net/fs live in one "Security hardening" tuner).
  {
    id: 'network',
    status: 'planned',
    title: 'Network stack',
    blurb: 'Tune net.core and net.ipv4 sysctls for throughput and latency, covering socket buffer sizes, the listen backlog, congestion control, TIME_WAIT reuse, and netfilter connection tracking.',
    keys: ['net.core.rmem_max', 'net.ipv4.tcp_congestion_control', 'net.core.somaxconn', 'net.netfilter.nf_conntrack_max', '…'],
  },
  {
    id: 'filesystem',
    status: 'planned',
    title: 'Filesystem & file descriptors',
    blurb: 'Tune fs.* sysctls for file-heavy and event-driven workloads, covering the system-wide file-descriptor ceiling, inotify watch limits, and async I/O capacity.',
    keys: ['fs.file-max', 'fs.inotify.max_user_watches', 'fs.aio-max-nr', '…'],
  },
  {
    id: 'kernel',
    status: 'planned',
    title: 'Kernel & scheduler',
    blurb: 'Tune kernel.* sysctls for scheduling and system behaviour, covering CFS scheduler tunables, the PID and thread ceilings, panic and printk behaviour, and user-namespace limits.',
    keys: ['kernel.sched_*', 'kernel.pid_max', 'kernel.threads-max', 'user.max_user_namespaces', '…'],
  },
  {
    id: 'hugepages',
    status: 'planned',
    title: 'Huge pages & memory layout',
    blurb: 'Tune the rest of vm.* plus Transparent Huge Pages for large-memory workloads, covering hugepage pools, the mmap count limit, NUMA zone reclaim, and THP and KSM policy.',
    keys: ['vm.nr_hugepages', 'vm.max_map_count', 'vm.zone_reclaim_mode', '/sys/kernel/mm/transparent_hugepage', '…'],
  },
  {
    id: 'sysv-ipc',
    status: 'planned',
    title: 'System V IPC & shared memory',
    blurb: 'Tune System V IPC limits for databases and legacy middleware, covering shared-memory segment sizes, semaphore arrays, and message-queue limits.',
    keys: ['kernel.shmmax', 'kernel.shmall', 'kernel.sem', 'kernel.msgmni', '…'],
  },
  {
    id: 'security',
    status: 'planned',
    title: 'Security hardening',
    blurb: 'A hardening profile (CIS-benchmark style) that pulls security-relevant sysctls together from kernel, net, and fs, covering pointer and dmesg restrictions, ptrace scope, reverse-path filtering, SYN cookies, and link protections.',
    keys: ['kernel.kptr_restrict', 'kernel.yama.ptrace_scope', 'net.ipv4.tcp_syncookies', 'fs.protected_symlinks', '…'],
  },
  {
    id: 'block-io',
    status: 'planned',
    title: 'Block I/O & storage',
    blurb: 'Tune the block layer through sysfs for storage-bound workloads, covering the per-device I/O scheduler, queue depth, and read-ahead.',
    keys: ['/sys/block/<dev>/queue/scheduler', 'nr_requests', 'read_ahead_kb', '…'],
  },
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
