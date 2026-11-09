/**
 * The one list of tuners (Design.md §9 "Registry"). The router, routes-meta.js,
 * the landing cards, the header nav and the sitemap all derive from it.
 *
 * Plain data with no Vue imports: scripts/generate-static-routes.mjs reads it
 * under Node. Array order is the landing-card, header-nav and guided-setup
 * order: the settings every machine needs first, and each limit before the
 * settings it bounds (systemd after filesystem and kernel).
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
 * @property {string}  [question] The problem the tuner answers, as a question
 *                               (live only): the first column of the landing
 *                               page's tuner table
 * @property {string[]} keys     Example keys shown on the card
 * @property {number}  [settingCount] How many settings the tuner has (live
 *                               only): the domain's parameterKeys.length
 * @property {string[]} [writes] The files the tuner writes for its default
 *                               profile (live only), in generateConfig order.
 *                               Stored here so the landing table needs no
 *                               domain module; contract.test.js checks both
 *                               against the domain, so they can't drift
 * @property {string}  [path]    Route path (live only), e.g. '/swap'
 * @property {string}  [navLabel] Header nav label (live only)
 * @property {Object}  [route]   Route metadata (live only): title, description,
 *                               ogTitle, priority, changefreq, jsonLdType

 * @property {{ roles: 'all' | string[], why: string, defaultsFine: string }} [setup]
 *                               Guided setup (live only): the MACHINE_ROLES it is
 *                               recommended for, the line the landing card shows
 *                               for them, and when the defaults are fine (the
 *                               "Do I need this?" box on the tuner page)
 * @property {{ slug: string, status: 'draft' | 'live' }} [guide]
 *                               The tuner's study guide (live only), at
 *                               /learn/<slug> (Design.md §5 "Learning pages").
 *                               Its data is src/tuners/<id>/learn.js and its
 *                               loader is in src/learn/guides.js. Only a
 *                               `live` guide gets a route, the "How it works"
 *                               links and the header's Learn link; a `draft`
 *                               changes nothing on the site. Flip it only once
 *                               the guide's evidence is captured and a person
 *                               has read it as a beginner.
 */

/** @type {TunerEntry[]} */
export const TUNERS = [
  {
    id: 'swap',
    status: 'live',
    question: 'Does it swap too early, or freeze when memory runs out?',
    path: '/swap',
    navLabel: 'Swap & memory',
    title: 'Swap & memory',
    blurb: 'Hardware-aware tuning of vm.* sysctl parameters: swappiness, watermarks, dirty-page writeback, and OOM behaviour. Live graphs of swap pressure, watermark zones, and the dirty timeline.',
    keys: ['vm.swappiness', 'vm.min_free_kbytes', 'vm.watermark_scale_factor', 'vm.dirty_ratio', '…'],
    settingCount: 12,
    writes: ['/etc/sysctl.d/99-swap-tuning.conf'],
    route: {
      title: 'Swap & memory tuner | linux-tuners.dev',
      description:
        'Tune Linux swap and memory sysctls from your hardware: swappiness, min_free_kbytes, watermarks and dirty writeback, with live graphs and a sysctl.d file.',
      ogTitle: 'Swap & memory tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: 'How eagerly the kernel swaps, how much memory it keeps free, and when dirty pages reach the disk. Every machine has these, and the defaults ignore its RAM.',
      defaultsFine: 'A small desktop or a lightly loaded machine that never runs short of memory or writes large files.',
    },
    guide: { slug: 'memory', status: 'live' },
  },
  {
    id: 'security',
    status: 'live',
    question: 'Can any local user read kernel addresses or trace other processes?',
    path: '/security',
    navLabel: 'Security',
    title: 'Security hardening',
    blurb: 'A hardening profile (CIS-benchmark style) that pulls security-relevant sysctls together from kernel, net, and fs, covering pointer and dmesg restrictions, ptrace scope, reverse-path filtering, SYN cookies, and link protections.',
    keys: ['kernel.kptr_restrict', 'kernel.yama.ptrace_scope', 'net.ipv4.tcp_syncookies', 'fs.protected_symlinks', '…'],
    settingCount: 18,
    writes: ['/etc/sysctl.d/99-security-hardening.conf'],
    route: {
      title: 'Security hardening tuner | linux-tuners.dev',
      description:
        'Harden Linux with sysctls: kptr_restrict, ptrace_scope, ASLR, unprivileged BPF, rp_filter and SYN cookies. KSPP and CIS-style presets and a sysctl.d file.',
      ogTitle: 'Security hardening tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: 'Kernel pointer, ptrace and BPF restrictions plus network spoofing protections. Cheap, and most distributions leave some of them open.',
      defaultsFine: 'A throwaway or isolated test machine, or one whose distribution already ships a hardened profile you have reviewed.',
    },
  },
  {
    id: 'filesystem',
    status: 'live',
    question: 'Do you see "too many open files" or inotify limit errors?',
    path: '/filesystem',
    navLabel: 'Filesystem',
    title: 'Filesystem & file descriptors',
    blurb: 'Tune fs.* sysctls for file-heavy and event-driven workloads, covering the open-file ceilings, inotify watch limits for IDEs and Kubernetes nodes, and native AIO capacity for databases.',
    keys: ['fs.inotify.max_user_watches', 'fs.inotify.max_user_instances', 'fs.nr_open', 'fs.aio-max-nr', '…'],
    settingCount: 6,
    writes: ['/etc/sysctl.d/99-filesystem-tuning.conf'],
    route: {
      title: 'Filesystem & file descriptors tuner | linux-tuners.dev',
      description:
        'Tune Linux fs.* sysctls for your workload: file-max, nr_open, inotify watches and instances, aio-max-nr, with their kernel memory cost and a sysctl.d file.',
      ogTitle: 'Filesystem & file descriptors tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: "The open-file and inotify ceilings that file watchers, databases and container nodes hit first. It sets fs.nr_open, which bounds systemd's file limit.",
      defaultsFine: 'Machines that never hit a "too many open files" or inotify limit error, which covers most servers and desktops.',
    },
  },
  {
    id: 'kernel',
    status: 'live',
    question: 'Does it run out of processes, or hang after a crash?',
    path: '/kernel',
    navLabel: 'Kernel',
    title: 'Kernel limits & panics',
    blurb: 'Set the process and thread ceilings, the key quotas containers run into, whether a crashed machine reboots, and which kernel messages reach the console.',
    keys: ['kernel.threads-max', 'kernel.keys.maxkeys', 'kernel.panic', 'kernel.sysrq', '…'],
    settingCount: 9,
    writes: ['/etc/sysctl.d/99-kernel-tuning.conf'],
    route: {
      title: 'Kernel limits & panics tuner | linux-tuners.dev',
      description:
        'Tune Linux kernel.* sysctls: pid_max, threads-max, key quotas, panic and oops handling, SysRq and the console loglevel, with a commented sysctl.d file.',
      ogTitle: 'Kernel limits & panics tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: "The process and thread ceilings, key quotas, and whether a crashed machine reboots. It sets the limits that bound systemd's task caps.",
      defaultsFine: 'Machines that run a normal number of processes and few containers, and where a crash can wait for you to reboot by hand.',
    },
  },
  {
    id: 'systemd',
    status: 'live',
    question: 'Does one service take the CPU, memory or disk from the others?',
    path: '/systemd',
    navLabel: 'systemd',
    title: 'systemd & resource limits',
    blurb: 'Tune systemd manager defaults and per-slice cgroup v2 resource control: accounting, task and FD limits, and CPU/memory/IO weights and caps for clustered and containerised Linux workloads.',
    keys: ['CPUWeight', 'MemoryMax', 'DefaultTasksMax', 'DefaultLimitNOFILE', '…'],
    settingCount: 16,
    writes: ['/etc/systemd/system.conf.d/99-resource-tuning.conf', '/etc/systemd/system/system.slice.d/50-resources.conf'],
    route: {
      title: 'systemd & resource limits tuner | linux-tuners.dev',
      description:
        'Tune systemd resource control from your hardware: DefaultTasksMax, DefaultLimitNOFILE and per-slice CPU, memory and IO caps, with live graphs and drop-ins.',
      ogTitle: 'systemd & resource limits tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: 'Default task and file limits for every service, and CPU, memory and IO caps per slice. Comes after the filesystem and kernel limits it must stay under.',
      defaultsFine: 'A single-purpose machine whose services never compete for CPU, memory or IO and never hit the task or file limits.',
    },
    guide: { slug: 'systemd-resources', status: 'draft' },
  },
  {
    id: 'network',
    status: 'live',
    question: 'Does it drop connections under load, or fall short of the link speed?',
    path: '/network',
    navLabel: 'Network',
    title: 'Network stack',
    blurb: 'Tune net.core and net.ipv4 sysctls for throughput and latency, covering socket buffer sizes, the listen backlog, congestion control, TIME_WAIT reuse, and netfilter connection tracking.',
    keys: ['net.ipv4.tcp_rmem', 'net.ipv4.tcp_congestion_control', 'net.core.somaxconn', 'net.netfilter.nf_conntrack_max', '…'],
    settingCount: 17,
    writes: ['/etc/sysctl.d/99-network-tuning.conf'],
    route: {
      title: 'Network stack tuner | linux-tuners.dev',
      description:
        'Tune Linux network sysctls for your link: TCP buffers sized from the bandwidth-delay product, somaxconn, BBR with fq and conntrack, as a sysctl.d file.',
      ogTitle: 'Network stack tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: ['server', 'web', 'database', 'container-host', 'vm-host', 'router'],
      why: 'Socket buffers sized for the link, listen backlogs, congestion control and connection tracking, for machines that serve or forward traffic.',
      defaultsFine: 'A desktop, or a server with modest traffic on a 1 Gbit/s link or slower that never drops connections or logs a full conntrack table.',
    },
  },
  {
    id: 'block-io',
    status: 'live',
    question: 'Does each disk use a scheduler and read-ahead that suit it?',
    path: '/block-io',
    navLabel: 'Block I/O',
    title: 'Block I/O & storage',
    blurb: 'Pick the I/O scheduler, request depth, read-ahead and merging for NVMe, SATA and virtual disks, written as udev rules that apply at boot and on hotplug.',
    keys: ['queue/scheduler', 'queue/nr_requests', 'queue/read_ahead_kb', 'queue/nomerges', '…'],
    settingCount: 5,
    writes: ['/etc/udev/rules.d/99-block-tuning-nvme.rules'],
    route: {
      title: 'Block I/O & storage tuner | linux-tuners.dev',
      description:
        'Tune Linux block I/O for your disks: I/O scheduler, nr_requests, read_ahead_kb and nomerges for NVMe, SSDs, hard disks and virtio, as a udev rules file.',
      ogTitle: 'Block I/O & storage tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: 'all',
      why: 'The I/O scheduler and read-ahead for each kind of disk, where the kernel picks one default for all of them.',
      defaultsFine: "Machines with a single kind of disk where the kernel's default scheduler already suits the workload.",
    },
  },
  {
    id: 'hugepages',
    status: 'live',
    question: 'Does your database or VM host ask for huge pages?',
    path: '/hugepages',
    navLabel: 'Huge pages',
    title: 'Huge pages & memory layout',
    blurb: 'Tune huge page pools, Transparent Huge Pages and KSM for databases and VM hosts, plus the per-process memory map limit and NUMA zone reclaim. Writes a sysctl.d file and a tmpfiles.d file for the /sys settings.',
    keys: ['vm.nr_hugepages', 'transparent_hugepage/enabled', 'ksm/run', 'vm.max_map_count', '…'],
    settingCount: 9,
    writes: ['/etc/sysctl.d/99-hugepages-tuning.conf', '/etc/tmpfiles.d/99-hugepages-tuning.conf'],
    route: {
      title: 'Huge pages & memory layout tuner | linux-tuners.dev',
      description:
        'Size Linux huge pages for your workload: nr_hugepages, Transparent Huge Pages, KSM for KVM hosts and max_map_count, with sysctl.d and tmpfiles.d files.',
      ogTitle: 'Huge pages & memory layout tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: ['database', 'vm-host'],
      why: 'Huge page pools, Transparent Huge Pages and KSM, which databases and VM hosts depend on and other machines are better off leaving alone.',
      defaultsFine: 'Anything that is not a database or a VM host. Skip it unless your software documents huge pages or KSM.',
    },
  },
  {
    id: 'sysv-ipc',
    status: 'live',
    question: 'Does Oracle, Db2 or older middleware ask for higher IPC limits?',
    path: '/sysv-ipc',
    navLabel: 'IPC',
    title: 'System V IPC & shared memory',
    blurb: 'Set the System V shared memory, semaphore and message queue limits that Oracle, Db2 and older middleware check, without values from old guides lowering the kernel defaults.',
    keys: ['kernel.sem', 'kernel.shmmni', 'kernel.msgmnb', 'kernel.msgmax', '…'],
    settingCount: 6,
    writes: ['/etc/sysctl.d/99-sysv-ipc-tuning.conf'],
    route: {
      title: 'System V IPC & shared memory tuner | linux-tuners.dev',
      description:
        'Tune Linux System V IPC limits: shmmni, kernel.sem, msgmni, msgmax and msgmnb, checked against the Oracle and Db2 minimums, with a commented sysctl.d file.',
      ogTitle: 'System V IPC & shared memory tuner',
      priority: 0.9,
      changefreq: 'monthly',
      jsonLdType: 'SoftwareApplication',
    },
    setup: {
      roles: ['database'],
      why: 'The shared memory and semaphore limits that Oracle, Db2 and older middleware check before they install.',
      defaultsFine: 'Anything that is not Oracle, Db2 or older middleware asking for these limits. Modern kernel defaults are already large.',
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
