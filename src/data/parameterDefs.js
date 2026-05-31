/**
 * Static metadata for every vm.* parameter the tuner exposes.
 *
 * Each entry is the single source of truth for the parameter's name, group, kernel
 * default, kernel range, UI step, plain-language description, and source link. The
 * UI (ParameterCard) and the output generator (ConfigOutput) both read from here.
 *
 * @typedef {'memory-reclaim' | 'dirty-writeback' | 'oom-overcommit'} ParameterGroup
 * @typedef {'slider' | 'segmented' | 'toggle'} ControlKind
 *
 * @typedef {Object} ParameterDef
 * @property {string}         key            Matches a key on ParameterValues
 * @property {string}         sysctlName     The dotted name as written to sysctl.conf
 * @property {ParameterGroup} group
 * @property {ControlKind}    control
 * @property {string}         shortDesc      One-line description for the card header
 * @property {string[]}       longDesc       Layered explanation as 2-3 short paragraphs
 *                                           (what it controls / when to raise or lower /
 *                                           danger zones). Rendered as separate <p>s.
 * @property {string}         tuningTip      Single "bump this when X, lower it when Y" line
 * @property {string}         kernelDocsUrl  Direct link to docs.kernel.org anchor
 * @property {string|null}    k8sNote        Kubernetes-specific guidance, no URL (null if N/A).
 *                                           A "Source" link to K8S_BLOG is rendered alongside it.
 * @property {number}         kernelDefault  Stock kernel default
 * @property {number}         kernelMin      Lowest value the kernel accepts
 * @property {number}         kernelMax      Highest value the kernel accepts
 * @property {number}         step           Slider step granularity
 * @property {string}         unit           Display unit (' ', 'kB', '%', 'cs', 'mode')
 * @property {string[]}       [zones]        Optional zone annotations for the slider track
 * @property {boolean}        [dangerousIfZero] Highlight zero as a danger value
 */

const KERNEL_VM_BASE = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'

/** Source for the Kubernetes-specific guidance; rendered as a plain "Source" link. */
export const K8S_BLOG = 'https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/'

/** @type {ParameterDef[]} */
export const PARAMETER_DEFS = [
  {
    key: 'swappiness',
    sysctlName: 'vm.swappiness',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'How readily the kernel swaps app memory instead of dropping file cache.',
    longDesc: [
      "Your RAM holds two kinds of pages: file-backed cache (copies of things already on disk) and anonymous pages (a process's private heap and stack, which only exist in memory). Under pressure the kernel must reclaim one or the other. Swappiness is the dial that biases that choice: low values drop cache first and keep apps in RAM, while high values push apps out to swap sooner.",
      "Keep it low (0–10) for latency-sensitive work where a swap-in stall would hurt, especially with slow disk-backed swap. Leave it mid-range (10–60) for general-purpose servers. Push it high (100–200) only when swap is genuinely fast (zram, zswap, or NVMe), so the kernel can lean on it without paying a stall penalty.",
      "Kernel 5.8 raised the maximum from 100 to 200 on any swap device, not just compressed swap. Anything above 100 weights swapping *more* heavily than dropping cache, which only makes sense when a swap-out is nearly as cheap as evicting a clean cache page, i.e. on fast in-memory swap like zram or zswap.",
    ],
    tuningTip: 'Bump it up when swap is fast and you want to keep cache; lower it when swap is slow and stalls hurt.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#swappiness`,
    k8sNote: 'For Kubernetes nodes with disk-backed swap, swappiness=10 is the common recommendation.',
    kernelDefault: 60,
    kernelMin: 0,
    kernelMax: 200,
    step: 1,
    unit: '',
    zones: ['0–10: latency-sensitive', '10–60: balanced', '60–100: swap-friendly', '100–200: fast swap only'],
  },
  {
    key: 'min_free_kbytes',
    sysctlName: 'vm.min_free_kbytes',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'The hard floor of free memory the kernel always keeps in reserve.',
    longDesc: [
      "This is the emergency reserve: the amount of free memory the kernel refuses to dip below across all memory zones. It sets the lowest 'min' watermark, the line that triggers slow synchronous direct reclaim once crossed, and protects the atomic allocations that drivers and the network stack make in contexts where they cannot afford to wait.",
      "Raise it to give the kernel a bigger safety buffer, and to widen the entire watermark window, since the low and high watermarks are built on top of this floor. It's commonly raised together with watermark_scale_factor to keep background reclaim comfortably ahead of demand.",
      "Set it too low and atomic allocations start failing under load; you'll see order-0 allocation failures in dmesg. Set it too high and you permanently hand usable RAM to a reserve that mostly sits idle.",
    ],
    tuningTip: 'Bump it up if you see atomic allocation failures under load; lower it if reserves are eating RAM you need.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#min-free-kbytes`,
    k8sNote: 'On Kubernetes nodes this is raised (along with watermark_scale_factor) to widen the kswapd reclaim window.',
    kernelDefault: 67584,
    kernelMin: 1024,
    kernelMax: 4194304,
    step: 1024,
    unit: 'kB',
  },
  {
    key: 'watermark_scale_factor',
    sysctlName: 'vm.watermark_scale_factor',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'How much head start background reclaim gets before apps stall.',
    longDesc: [
      "The kernel wakes its background reclaim thread (kswapd) when free memory falls to the 'low' watermark, and lets it sleep again once memory recovers to the 'high' watermark. This factor sets how far apart those two lines sit: the runway kswapd has to free memory quietly in the background before your processes are dragged into slow direct reclaim themselves.",
      "A wider window matters because it lets kswapd start earlier and reclaim more per pass, so a sudden burst of allocations gets absorbed in the background instead of stalling the workload. That's why latency-sensitive and high-allocation-rate services widen it; the only cost is the kernel keeps a little more memory free at all times.",
      "The value is in tenths of a percent of total managed memory, so 10 means 0.1%. Raising it to 500–2000 is a common aggressive setting for latency-sensitive nodes. On a 16 GiB host that widens the reclaim window from about 16 MiB at the default to roughly 3.2 GiB at 2000.",
    ],
    tuningTip: 'Bump it up when allocation bursts cause reclaim stalls; lower it to hand idle reserve memory back to apps.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#watermark-scale-factor`,
    k8sNote: 'For Kubernetes nodes, 500–2000 is the recommended range to widen the kswapd reclaim window.',
    kernelDefault: 10,
    kernelMin: 1,
    kernelMax: 3000,
    step: 1,
    unit: '',
  },
  {
    key: 'vfs_cache_pressure',
    sysctlName: 'vm.vfs_cache_pressure',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'How hard the kernel reclaims filesystem metadata vs ordinary cache.',
    longDesc: [
      'The kernel caches filesystem metadata so repeated lookups skip the disk: dentries (the results of directory-entry path lookups) and inodes (per-file metadata like size and permissions). This dial controls how aggressively that metadata cache is reclaimed relative to ordinary page cache. At the default 100 the two are reclaimed at the same rate.',
      'Drop it below 100 to make the kernel hold on to metadata longer, a clear win for workloads that walk huge directory trees or keep many files open, like build servers, file servers, and mail spools. Push it above 100 to evict metadata more eagerly when you would rather spend that memory on data page cache.',
      'Setting it to 0 tells the kernel to never reclaim this metadata, which can run the machine out of memory; the documentation flags this explicitly. Keep it at 1 or above.',
    ],
    tuningTip: 'Lower it when you re-walk the same files a lot; raise it when metadata crowds out data cache. Never set it to 0.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#vfs-cache-pressure`,
    k8sNote: null,
    kernelDefault: 100,
    kernelMin: 0,
    kernelMax: 500,
    step: 1,
    unit: '',
    zones: ['below 100: keep metadata', '100: balanced', 'above 100: reclaim aggressively'],
    dangerousIfZero: true,
  },
  {
    key: 'dirty_ratio',
    sysctlName: 'vm.dirty_ratio',
    group: 'dirty-writeback',
    control: 'slider',
    shortDesc: 'The ceiling where writers are forced to stop and flush to disk.',
    longDesc: [
      "As processes write, modified ('dirty') pages accumulate in memory before being flushed to disk. dirty_ratio is the ceiling: once dirty pages reach this percentage of available memory, any process that writes more is forced to stop and synchronously help flush data until the level drops back under the line.",
      'Lower it to cap tail latency: a smaller pool of dirty pages means no single write storm or fsync can stall everything at once. Raise it to favour throughput on large sequential writes, letting more data accumulate before the kernel insists on writing it out.',
      'It must stay above dirty_background_ratio, the asynchronous trigger. If the two values meet, background flushing never gets a head start and writers go straight into synchronous stalls.',
    ],
    tuningTip: 'Lower it for predictable latency under write bursts; raise it for sequential-write throughput.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#dirty-ratio`,
    k8sNote: null,
    kernelDefault: 20,
    kernelMin: 1,
    kernelMax: 90,
    step: 1,
    unit: '%',
  },
  {
    key: 'dirty_background_ratio',
    sysctlName: 'vm.dirty_background_ratio',
    group: 'dirty-writeback',
    control: 'slider',
    shortDesc: 'The earlier, gentler trigger that starts flushing in the background.',
    longDesc: [
      'This is the quieter, earlier trigger in the dirty-page pipeline. When dirty pages cross this percentage of available memory, the kernel wakes its background flusher to start writing pages out asynchronously, without blocking the processes that created them.',
      'Keep it comfortably below dirty_ratio so background flushing has room to drain dirty pages before they ever reach the synchronous ceiling. A common starting point is roughly half of dirty_ratio.',
      'Set it too close to dirty_ratio and the flusher starts too late to actually help; set it near zero and the disk is almost always being flushed, which costs throughput on bursty writers.',
    ],
    tuningTip: 'Lower it to start flushing sooner and smooth out bursts; raise it to batch writes, but keep it under dirty_ratio.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#dirty-background-ratio`,
    k8sNote: null,
    kernelDefault: 10,
    kernelMin: 1,
    kernelMax: 89,
    step: 1,
    unit: '%',
  },
  {
    key: 'dirty_expire_centisecs',
    sysctlName: 'vm.dirty_expire_centisecs',
    group: 'dirty-writeback',
    control: 'slider',
    shortDesc: 'How long a dirty page may sit in memory before it must be flushed.',
    longDesc: [
      'A dirty page is not flushed the instant it is written; it is allowed to linger in case it gets modified again or can be batched with neighbouring writes. This sets that maximum age, in hundredths of a second, after which a page is considered stale and becomes eligible for the next writeback pass.',
      'Shorten it to get data onto disk sooner, narrowing the window in which a crash would lose recent writes. Lengthen it to batch more I/O together, which is friendlier to throughput and to flash wear.',
    ],
    tuningTip: 'Lower it to shrink the data-loss window on a crash; raise it to batch I/O for throughput.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#dirty-expire-centisecs`,
    k8sNote: null,
    kernelDefault: 3000,
    kernelMin: 100,
    kernelMax: 60000,
    step: 100,
    unit: 'cs',
  },
  {
    key: 'dirty_writeback_centisecs',
    sysctlName: 'vm.dirty_writeback_centisecs',
    group: 'dirty-writeback',
    control: 'slider',
    shortDesc: 'How often the background flusher wakes up to look for expired pages.',
    longDesc: [
      'This is how often the background flusher thread wakes, in hundredths of a second, to look for dirty pages older than dirty_expire_centisecs and write them out. Where dirty_expire sets *when a page is due*, this sets *how often the kernel checks*.',
      'Setting it to 0 disables periodic writeback entirely; pages then only flush when a ratio threshold is hit or an fsync forces it. Keep it at or below dirty_expire_centisecs, otherwise pages can age past their expiry between checks and linger longer than you intended.',
    ],
    tuningTip: 'Lower it to flush expired pages more promptly; raise it to wake the flusher less often. Don’t exceed dirty_expire_centisecs.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#dirty-writeback-centisecs`,
    k8sNote: null,
    kernelDefault: 500,
    kernelMin: 0,
    kernelMax: 60000,
    step: 100,
    unit: 'cs',
  },
  {
    key: 'overcommit_memory',
    sysctlName: 'vm.overcommit_memory',
    group: 'oom-overcommit',
    control: 'segmented',
    shortDesc: 'Whether the kernel hands out more memory than physically exists.',
    longDesc: [
      'When a program asks for memory, the kernel can either trust that not all of it will actually be touched and hand it over, or carefully refuse any request that would exceed real RAM plus swap. This policy picks which behaviour you get, across three modes: 0 heuristic, 1 always, 2 strict.',
      'Mode 0 (default) lets most allocations through but rejects wildly unrealistic ones, which is the right choice for almost everyone. Mode 1 never refuses, which suits sparse-allocation workloads (some scientific code, certain in-memory databases) that reserve enormous address space they never fully use. Mode 2 refuses anything past the CommitLimit; use it on systems that must never invoke the OOM killer and would rather see an honest malloc() failure.',
      'On Kubernetes nodes stay on 0 or 1: mode 2 makes kubelet mis-account memory and can break pod eviction. Mode 2 also depends on overcommit_ratio being set sensibly, or it will start refusing allocations far too early.',
    ],
    tuningTip: 'Use 0 for general nodes, 1 for sparse huge-reservation workloads, 2 only when you’d rather malloc fail than risk the OOM killer.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#overcommit-memory`,
    k8sNote: 'On Kubernetes nodes kubelet relies on graceful allocation behaviour, so use mode 0 or 1.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'mode',
  },
  {
    key: 'overcommit_ratio',
    sysctlName: 'vm.overcommit_ratio',
    group: 'oom-overcommit',
    control: 'slider',
    shortDesc: 'How much RAM counts toward the strict-mode commit limit.',
    longDesc: [
      "This only matters when overcommit_memory is set to 2 (strict). It defines how much of physical RAM counts toward the kernel's CommitLimit, the hard cap on how much memory may be committed at once. The limit works out to swap + RAM × (overcommit_ratio ÷ 100).",
      'At the default 50 the kernel will commit up to half of RAM plus all of swap. Raise it to allow more commitment before allocations begin failing; lower it to keep a larger untouchable headroom. It has no effect at all in modes 0 or 1.',
    ],
    tuningTip: 'Under strict overcommit, raise it to allow more committed memory, lower it for a bigger safety margin. Ignored unless overcommit_memory = 2.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#overcommit-ratio`,
    k8sNote: null,
    kernelDefault: 50,
    kernelMin: 0,
    kernelMax: 200,
    step: 1,
    unit: '%',
  },
  {
    key: 'panic_on_oom',
    sysctlName: 'vm.panic_on_oom',
    group: 'oom-overcommit',
    control: 'toggle',
    shortDesc: 'Reboot the whole machine on OOM instead of killing one process.',
    longDesc: [
      'When the system runs out of memory, the kernel normally invokes the OOM killer to pick and terminate a process, freeing memory and keeping the box alive. Turn this on and it does the opposite: the kernel deliberately panics (and typically reboots) instead of killing anything.',
      'That trade makes sense for clustered nodes where a fast, clean reboot beats a machine limping along in an unpredictable half-killed state. It is the wrong choice for Kubernetes workers, where kubelet relies on graceful OOM eviction to reschedule pods, and a panic just takes the entire node down.',
    ],
    tuningTip: 'Enable it only when a reboot beats a survivor; keep it off (0) on Kubernetes nodes and anywhere graceful OOM matters.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#panic-on-oom`,
    k8sNote: 'Keep this at 0 on Kubernetes worker nodes, since kubelet depends on graceful OOM handling.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: '',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(
  PARAMETER_DEFS.map((p) => [p.key, p]),
)
