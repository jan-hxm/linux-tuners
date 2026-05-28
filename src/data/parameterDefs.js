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
 * @property {string}         longDesc       Plain-language explanation for the drawer
 * @property {string}         kernelDocsUrl  Direct link to docs.kernel.org anchor
 * @property {string|null}    k8sNote        K8s-blog quote/citation (null if N/A)
 * @property {number}         kernelDefault  Stock kernel default
 * @property {number}         kernelMin      Lowest value the kernel accepts
 * @property {number}         kernelMax      Highest value the kernel accepts
 * @property {number}         step           Slider step granularity
 * @property {string}         unit           Display unit (' ', 'kB', '%', 'cs', 'mode')
 * @property {string[]}       [zones]        Optional zone annotations for the slider track
 * @property {boolean}        [dangerousIfZero] Highlight zero as a danger value
 */

const KERNEL_VM_BASE = 'https://docs.kernel.org/admin-guide/sysctl/vm.html'
const K8S_BLOG = 'https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/'

/** @type {ParameterDef[]} */
export const PARAMETER_DEFS = [
  {
    key: 'swappiness',
    sysctlName: 'vm.swappiness',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'Bias between reclaiming page cache and swapping anonymous pages.',
    longDesc:
      'Controls how aggressively the kernel will swap anonymous memory pages versus reclaiming the page cache. Lower values keep more anonymous pages in RAM (good for latency-sensitive workloads); higher values let the kernel swap earlier (good when swap is fast). Since kernel 5.8 the range extends to 200 to accommodate in-memory swap devices like zram.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#swappiness`,
    k8sNote: `K8s blog (Aug 2025) recommends swappiness=10 for nodes with disk-backed swap. See ${K8S_BLOG}.`,
    kernelDefault: 60,
    kernelMin: 0,
    kernelMax: 200,
    step: 1,
    unit: '',
    zones: ['0-10: latency-sensitive', '10-60: balanced', '60-100: swap-friendly', '100-200: fast swap only'],
  },
  {
    key: 'min_free_kbytes',
    sysctlName: 'vm.min_free_kbytes',
    group: 'memory-reclaim',
    control: 'slider',
    shortDesc: 'Floor of free memory the kernel tries to keep reserved.',
    longDesc:
      "Sets the minimum free memory (in kB) the kernel maintains across zones. This becomes the 'min' watermark — the floor that triggers direct reclaim and atomic allocation failures when crossed. Too low and atomic allocations can fail under load; too high and you waste memory on reserves that never get used.",
    kernelDocsUrl: `${KERNEL_VM_BASE}#min-free-kbytes`,
    k8sNote: `K8s blog highlights raising this (along with watermark_scale_factor) to widen the kswapd window. ${K8S_BLOG}`,
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
    shortDesc: 'Width of the kswapd reclaim window between low and high watermarks.',
    longDesc:
      'Expressed as tenths of a per-cent of total managed memory. Together with min_free_kbytes it shapes the min→low→high watermark chain that determines when kswapd wakes up (low) and when it goes back to sleep (high). A wider window gives kswapd more runway to reclaim memory before processes hit direct reclaim.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#watermark-scale-factor`,
    k8sNote: `K8s blog recommends 500–2000 to widen the kswapd window — example given goes from ~337 MiB to ~591 MiB. ${K8S_BLOG}`,
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
    shortDesc: 'Reclaim pressure on inode/dentry caches relative to page cache.',
    longDesc:
      'At 100 the kernel reclaims dentry/inode caches at the same rate as the page cache. Below 100 it prefers to keep filesystem metadata in memory (helpful for filesystem-heavy workloads). Above 100 it reclaims metadata more aggressively. Setting to 0 is documented as dangerous and can OOM the system.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#vfs-cache-pressure`,
    k8sNote: null,
    kernelDefault: 100,
    kernelMin: 0,
    kernelMax: 500,
    step: 1,
    unit: '',
    zones: ['<100: prefer metadata', '100: balanced', '>100: aggressive'],
    dangerousIfZero: true,
  },
  {
    key: 'dirty_ratio',
    sysctlName: 'vm.dirty_ratio',
    group: 'dirty-writeback',
    control: 'slider',
    shortDesc: 'Ceiling — process writes stall here until pages are flushed.',
    longDesc:
      'Expressed as a per-cent of available memory. When dirty (modified) pages exceed this fraction, the writing process is forced to synchronously help flush data to disk. Lowering this caps tail latency under write bursts; raising it improves throughput on sequential writes.',
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
    shortDesc: 'Background flush trigger — must stay below dirty_ratio.',
    longDesc:
      'Expressed as a per-cent of available memory. Crossing this threshold wakes the background flusher thread to start writing pages out asynchronously, before the dirty_ratio ceiling forces synchronous stalls. Must be strictly less than dirty_ratio.',
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
    shortDesc: 'Age at which a dirty page becomes eligible for flush.',
    longDesc:
      "In hundredths of a second. A dirty page must be older than this before the flusher will write it out during a periodic wake-up. Shorter expiry flushes data sooner (lower data-loss risk); longer expiry batches more I/O (better throughput).",
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
    shortDesc: 'Wake interval of the periodic background flusher.',
    longDesc:
      "In hundredths of a second. Controls how often the flusher thread wakes to write out expired dirty pages. Setting to 0 disables periodic writeback. Should generally be less than or equal to dirty_expire_centisecs, otherwise pages can outlive the expiry window without being flushed.",
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
    shortDesc: 'Kernel policy for allowing memory allocations beyond available RAM+swap.',
    longDesc:
      '0 = heuristic (default), 1 = always overcommit (the kernel never refuses an allocation), 2 = strict (refuse allocations beyond CommitLimit, calculated from overcommit_ratio). K8s nodes generally want 0 or 1; mode 2 can cause kubelet to mis-account memory.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#overcommit-memory`,
    k8sNote: `K8s blog notes kubelet relies on graceful allocation behaviour — modes 0 or 1 recommended. ${K8S_BLOG}`,
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
    shortDesc: 'Per-cent of RAM included in the strict overcommit limit.',
    longDesc:
      "Only meaningful when overcommit_memory = 2. The kernel's CommitLimit becomes (swap + RAM × overcommit_ratio/100). 50 is the documented default.",
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
    shortDesc: 'Panic (and reboot) instead of running the OOM killer.',
    longDesc:
      'When 1, the kernel panics on OOM instead of invoking the OOM killer to free memory. Useful for cluster nodes that prefer fast reboot over an unpredictable surviving state — but disastrous for Kubernetes worker nodes, where kubelet expects graceful OOM eviction.',
    kernelDocsUrl: `${KERNEL_VM_BASE}#panic-on-oom`,
    k8sNote: `K8s blog: keep 0 for K8s worker nodes — kubelet depends on graceful OOM. ${K8S_BLOG}`,
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