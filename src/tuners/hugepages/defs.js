/**
 * Static metadata for every key the huge pages tuner exposes: vm.* sysctls
 * written to /etc/sysctl.d/, and THP and KSM sysfs files written at boot by a
 * tmpfiles.d `w` line (`sysfsPath`). Each entry is the single source of truth
 * for the key's name, group, kernel default, offered range, description and
 * source link. What the distributions start with was measured on the VM
 * images (vm/README.md).
 *
 * @typedef {'pool' | 'thp' | 'ksm' | 'maps'} HugepagesGroup
 *
 * @typedef {Object} HugepagesValues
 * @property {number} nr_hugepages             Pages reserved at boot; left out at 0
 * @property {number} nr_overcommit_hugepages  Surplus pages on demand; left out at 0
 * @property {'always'|'madvise'|'never'} thp_enabled
 * @property {'always'|'defer'|'defer+madvise'|'madvise'|'never'} thp_defrag
 * @property {0|1}    ksm_run                  Left out when off
 * @property {number} ksm_pages_to_scan        Only with KSM on
 * @property {number} ksm_sleep_millisecs      Only with KSM on
 * @property {number} max_map_count            Left out at 65530
 * @property {0|1}    zone_reclaim_mode        Only on NUMA machines
 */

const VM_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'
export const HUGETLB_DOCS = 'https://docs.kernel.org/admin-guide/mm/hugetlbpage.html'
export const THP_DOCS = 'https://docs.kernel.org/admin-guide/mm/transhuge.html'
export const KSM_DOCS = 'https://docs.kernel.org/admin-guide/mm/ksm.html'

/** Source for the database notes; rendered as a plain "Source" link. */
export const POSTGRES_HUGE_PAGES = 'https://www.postgresql.org/docs/current/kernel-resources.html#LINUX-HUGE-PAGES'

/** The default huge page size on x86-64, which the pool is counted in. */
export const HUGEPAGE_BYTES = 2 * 1024 * 1024

/** The most of RAM the pool sliders offer: the rest has to run the system. */
export const POOL_RAM_SHARE = 0.9

/** The kernel's vm.max_map_count default. At this value the key is left out. */
export const MAP_COUNT_DEFAULT = 65530

/** What Debian 13, Ubuntu 24.04 and Fedora 43 set vm.max_map_count to at boot. */
export const MAP_COUNT_DISTRO = 1048576

/** Highest pool the sliders offer on the largest RAM the profile takes (2304 TiB). */
const POOL_CEILING = Math.floor((2304 * 1024 ** 4 * POOL_RAM_SHARE) / HUGEPAGE_BYTES)

const THP_PATH = '/sys/kernel/mm/transparent_hugepage'
const KSM_PATH = '/sys/kernel/mm/ksm'

export const PARAMETER_DEFS = [
  // ── Huge page pool ────────────────────────────────────────────────────────
  {
    key: 'nr_hugepages',
    title: 'Huge page pool',
    tier: 'essential',
    sysctlName: 'vm.nr_hugepages',
    group: 'pool',
    control: 'slider',
    shortDesc: 'How many 2 MiB huge pages the kernel sets aside for programs that ask for them.',
    longDesc: {
      what: [
        'Programs that map memory with MAP_HUGETLB or from a hugetlbfs mount get it from this pool: PostgreSQL with huge_pages = on, Oracle Database, DPDK, and QEMU guests backed by huge pages. One 2 MiB page replaces 512 normal ones in the page tables and the TLB, which speeds up programs that touch a large shared memory area.',
      ],
      when: [
        'The pool is taken from RAM when it is set, whether a program uses it or not, and nothing else can use it. So size it to what the program needs, not more. At 0, the kernel default, it is left out of the file, so a pool set elsewhere (another sysctl.d file or the hugepages= boot option) stays.',
      ],
      watch: [
        'Set at boot, the kernel finds the pages easily. Raised later on a busy machine it may find fewer free 2 MiB blocks than asked for: check HugePages_Total in /proc/meminfo.',
      ],
    },
    tuningTip: 'Set it to what the program asks for, e.g. PostgreSQL\'s postgres -C shared_memory_size_in_huge_pages, plus a few spare pages.',
    kernelDocsUrl: `${VM_DOCS}#nr-hugepages`,
    dbNote: 'PostgreSQL uses the pool with huge_pages = on (or try); postgres -C shared_memory_size_in_huge_pages prints the pages it needs.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: POOL_CEILING,
    step: 1,
    unit: 'pages',
  },
  {
    key: 'nr_overcommit_hugepages',
    title: 'Surplus huge pages',
    tier: 'advanced',
    sysctlName: 'vm.nr_overcommit_hugepages',
    group: 'pool',
    control: 'slider',
    shortDesc: 'How many more huge pages the kernel may allocate on demand once the pool is used up.',
    longDesc: {
      what: [
        'Surplus pages are allocated from free memory when a program asks for more huge pages than the pool holds, and freed again when it lets go. Unlike the pool they cost nothing while unused, but they are only there if the kernel finds free 2 MiB blocks at that moment, so a program can still fail to get them.',
        'At 0, the kernel default, there are no surplus pages and the key is left out of the file.',
      ],
    },
    tuningTip: 'Leave it at 0 unless a program can fall back to normal pages when the surplus is not there.',
    kernelDocsUrl: `${VM_DOCS}#nr-overcommit-hugepages`,
    dbNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: POOL_CEILING,
    step: 1,
    unit: 'pages',
  },
  // ── Transparent huge pages ────────────────────────────────────────────────
  {
    key: 'thp_enabled',
    title: 'Transparent huge pages',
    tier: 'essential',
    sysctlName: 'transparent_hugepage/enabled',
    sysfsPath: `${THP_PATH}/enabled`,
    group: 'thp',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'madvise', label: 'madvise: only memory that asks for it' },
      { value: 'always', label: 'always: all large anonymous memory' },
      { value: 'never', label: 'never: off' },
    ],
    shortDesc: 'Whether the kernel backs program memory with 2 MiB pages on its own, without a pool.',
    longDesc: {
      what: [
        'Transparent huge pages (THP) give programs 2 MiB pages without a reserved pool or any change to the program. At always, any large enough anonymous mapping gets them, and khugepaged merges small pages in the background. At madvise, only memory a program marks with madvise(MADV_HUGEPAGE) does: the JVM with -XX:+UseTransparentHugePages, QEMU for guest RAM, and some allocators.',
      ],
      when: [
        'always can waste memory, since a program that touches a few bytes of a 2 MiB range gets the whole page, and makes some databases slower or less predictable. PostgreSQL, Oracle and Redis advise against it, and so did MongoDB before 8.0. madvise keeps the gain for programs that ask for it.',
        'Debian kernels start at always; Ubuntu and Fedora at madvise.',
      ],
      watch: [
        'Each time it is set to always or madvise, at boot included, khugepaged raises vm.min_free_kbytes to its own floor if it is lower (the kernel logs "raising min_free_kbytes"). The tmpfiles.d file runs after the sysctl files, so a lower min_free_kbytes from the swap tuner only holds with never.',
      ],
    },
    tuningTip: 'Use madvise; always only where the main program is known to gain from it.',
    kernelDocsUrl: `${THP_DOCS}#global-thp-controls`,
    dbNote: 'PostgreSQL, Oracle and Redis advise against THP always; madvise leaves them on normal pages.',
    kernelDefault: 'madvise',
    kernelDefaultNote: 'Set when the kernel is built: Debian kernels start at always, Ubuntu and Fedora at madvise.',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  {
    key: 'thp_defrag',
    title: 'THP defragmentation',
    tier: 'advanced',
    sysctlName: 'transparent_hugepage/defrag',
    sysfsPath: `${THP_PATH}/defrag`,
    group: 'thp',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'madvise', label: 'madvise: wait only for memory that asked' },
      { value: 'defer+madvise', label: 'defer+madvise: wait for madvise memory, defer the rest' },
      { value: 'defer', label: 'defer: never wait, compact in the background' },
      { value: 'always', label: 'always: wait to compact on every fault' },
      { value: 'never', label: 'never: take a huge page only if one is free' },
    ],
    shortDesc: 'How hard the kernel works to find a free 2 MiB block when a program faults in THP memory.',
    longDesc: {
      what: [
        'When no free 2 MiB block is there, the kernel can stop the faulting program and compact memory until one is (direct compaction), wake kswapd and kcompactd to do it in the background and use small pages for now (defer), or just use small pages.',
      ],
      when: [
        'Waiting gets programs their huge pages sooner but adds latency spikes to page faults. madvise, the default, waits only for memory that asked for huge pages; defer+madvise also starts background compaction for everything else.',
      ],
    },
    tuningTip: 'Keep madvise; use defer+madvise with THP always so other programs never wait.',
    kernelDocsUrl: `${THP_DOCS}#global-thp-controls`,
    dbNote: null,
    kernelDefault: 'madvise',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  // ── Kernel samepage merging ───────────────────────────────────────────────
  {
    key: 'ksm_run',
    title: 'Memory merging (KSM)',
    tier: 'essential',
    sysctlName: 'ksm/run',
    sysfsPath: `${KSM_PATH}/run`,
    group: 'ksm',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: merge identical pages', off: 'off: kernel default' },
    shortDesc: 'Whether ksmd scans memory for identical pages and merges them into one shared copy.',
    longDesc: {
      what: [
        'Kernel samepage merging (KSM) saves memory where many processes hold the same data, mostly virtual machines running the same guest OS. It only looks at memory a program has marked with madvise(MADV_MERGEABLE); QEMU marks guest RAM by default, other programs rarely do.',
      ],
      watch: [
        'The scanning costs CPU time, and a merged page is copied again when one side writes to it. Merging also lets one guest notice, through write timings, that another holds the same page, a known side channel between virtual machines.',
        'Off, the kernel default, it is left out of the file, so a service that turns it on (such as ksmtuned) keeps working.',
      ],
    },
    tuningTip: 'Turn it on for VM hosts that run many similar guests and are short on memory.',
    kernelDocsUrl: `${KSM_DOCS}#ksm-daemon-sysfs-interface`,
    dbNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'ksm_pages_to_scan',
    title: 'KSM pages per scan',
    tier: 'advanced',
    sysctlName: 'ksm/pages_to_scan',
    sysfsPath: `${KSM_PATH}/pages_to_scan`,
    group: 'ksm',
    control: 'slider',
    shortDesc: 'How many pages ksmd scans each time it wakes up.',
    longDesc: {
      what: [
        'With the default of 100 pages every 20 ms, ksmd scans about 20 MiB a second, so a pass over 64 GiB of guest memory takes close to an hour. More pages per wake-up find duplicates sooner at the cost of more CPU time for ksmd.',
      ],
    },
    tuningTip: 'Raise it towards 1000 when guests start often and memory is tight; watch ksmd in top.',
    kernelDocsUrl: `${KSM_DOCS}#ksm-daemon-sysfs-interface`,
    dbNote: null,
    kernelDefault: 100,
    kernelMin: 10,
    kernelMax: 10000,
    step: 10,
    unit: 'pages',
  },
  {
    key: 'ksm_sleep_millisecs',
    title: 'KSM scan interval',
    tier: 'advanced',
    sysctlName: 'ksm/sleep_millisecs',
    sysfsPath: `${KSM_PATH}/sleep_millisecs`,
    group: 'ksm',
    control: 'slider',
    shortDesc: 'How long ksmd sleeps between scans.',
    longDesc: {
      what: [
        'Together with pages_to_scan this sets the scan rate: pages_to_scan pages every sleep_millisecs. A longer sleep lowers ksmd\'s CPU use and finds duplicates more slowly.',
      ],
    },
    tuningTip: 'Keep 20 ms and change pages_to_scan instead.',
    kernelDocsUrl: `${KSM_DOCS}#ksm-daemon-sysfs-interface`,
    dbNote: null,
    kernelDefault: 20,
    kernelMin: 10,
    kernelMax: 1000,
    step: 10,
    unit: 'ms',
  },
  // ── Memory maps and NUMA ──────────────────────────────────────────────────
  {
    key: 'max_map_count',
    title: 'Memory mappings per process',
    tier: 'essential',
    sysctlName: 'vm.max_map_count',
    group: 'maps',
    control: 'slider',
    shortDesc: 'How many separate memory mappings one process may have.',
    longDesc: {
      what: [
        'Every mmap() region, shared library segment and thread stack of a process is one mapping. Programs that map many files or allocate in many small regions pass the kernel default of 65530: Elasticsearch and OpenSearch refuse to start below 262144, and games under Wine or Proton, Java heaps with many threads and some databases crash with out-of-memory errors when they hit it.',
      ],
      when: [
        'A mapping costs a couple of hundred bytes of kernel memory, and only while it exists, so a high limit costs nothing until a process uses it. Debian 13, Ubuntu 24.04 and Fedora 43 start it at 1048576; older releases keep 65530. At 65530 the key is left out of the file, and it is never offered lower: writing 0 stops every process from mapping memory, SSH logins included.',
      ],
    },
    tuningTip: 'Use 1048576, what current distributions already set.',
    kernelDocsUrl: `${VM_DOCS}#max-map-count`,
    dbNote: null,
    kernelDefault: MAP_COUNT_DEFAULT,
    kernelDefaultNote: 'Debian 13, Ubuntu 24.04 and Fedora 43 raise it to 1048576 at boot.',
    kernelMin: MAP_COUNT_DEFAULT,
    kernelMax: 2147483647,
    step: 65536,
    unit: 'count',
  },
  {
    key: 'zone_reclaim_mode',
    title: 'NUMA zone reclaim',
    tier: 'advanced',
    sysctlName: 'vm.zone_reclaim_mode',
    group: 'maps',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: reclaim on the local node first', off: 'off: use other nodes first' },
    shortDesc: 'Whether the kernel frees memory on the local NUMA node before it allocates from another node.',
    longDesc: {
      what: [
        'On a machine with several NUMA nodes, memory on a CPU\'s own node is faster to reach. With zone reclaim on, the kernel evicts page cache on the local node rather than allocate from a remote one. That helps workloads that fit within one node and stay there, and slows file servers and databases, which lose their cache while other nodes still have free memory.',
        'The kernel default is 0 (off). Only machines with more than one node have the key in the file.',
      ],
    },
    tuningTip: 'Keep it off unless the workload is partitioned per node.',
    kernelDocsUrl: `${VM_DOCS}#zone-reclaim-mode`,
    dbNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)

