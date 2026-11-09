/**
 * Static metadata for every systemd resource-control parameter the tuner
 * exposes. Same shape as the swap tuner's defs.js (so ParameterCard /
 * InfoDrawer render it unchanged): key, group, control, descriptions, defaults,
 * ranges, unit, and a docs link.
 *
 * Sources (quoted defaults/ranges come from these man pages):
 *   - systemd-system.conf(5)      manager Default* directives
 *   - systemd.resource-control(5) slice/unit CPU/Memory/IO/Tasks controls
 *   - systemd.exec(5)             LimitNOFILE / LimitMEMLOCK semantics
 *
 * @typedef {'manager-defaults' | 'slice-resources'} SystemdGroup
 *
 * @typedef {Object} SystemdValues
 * @property {0|1}    default_cpu_accounting       DefaultCPUAccounting
 * @property {0|1}    default_memory_accounting    DefaultMemoryAccounting
 * @property {0|1}    default_io_accounting        DefaultIOAccounting
 * @property {0|1}    default_tasks_accounting     DefaultTasksAccounting
 * @property {0|1}    default_ip_accounting        DefaultIPAccounting
 * @property {number} default_tasks_max            DefaultTasksMax (absolute count)
 * @property {number} default_limit_nofile_soft    DefaultLimitNOFILE soft
 * @property {number} default_limit_nofile_hard    DefaultLimitNOFILE hard
 * @property {number} default_limit_memlock        DefaultLimitMEMLOCK (bytes)
 * @property {number} cpu_weight                   CPUWeight (1–10000)
 * @property {number} cpu_quota                    CPUQuota (% across cores; max = no limit)
 * @property {number} memory_high                  MemoryHigh (% of RAM; 100 = infinity)
 * @property {number} memory_max                   MemoryMax (% of RAM; 100 = infinity)
 * @property {number} memory_swap_max              MemorySwapMax (% of RAM; 100 = infinity, 0 = no swap)
 * @property {number} io_weight                    IOWeight (1–10000)
 * @property {number} tasks_max                    TasksMax (absolute count)
 */

const SYSTEM_CONF = 'https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html'
const RESOURCE_CONTROL = 'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html'

/** Source for the container/Kubernetes-specific guidance, shown as a "Source" link. */
export const SYSTEMD_RESOURCE_DOCS = RESOURCE_CONTROL

/** @type {Object[]} */
export const SYSTEMD_DEFS = [
  // ── Manager defaults (/etc/systemd/system.conf.d) ────────────────────────
  {
    key: 'default_cpu_accounting',
    title: 'CPU accounting',
    tier: 'advanced',
    sysctlName: 'DefaultCPUAccounting',
    group: 'manager-defaults',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Track per-unit CPU time for every service by default.',
    longDesc: {
      what: [
        'Turns on CPU usage accounting for all units that do not override it, so that `systemctl status` and `systemd-cgtop` report CPU time per service. It maps to the per-unit CPUAccounting= setting.',
      ],
      when: [
        'On the unified [[cgroup]] v2 hierarchy CPU accounting is essentially free because the cpu controller is always present, so enabling it system-wide costs almost nothing and gives you per-service CPU visibility. The main reason to leave it off is to keep the cgroup tree minimal on very constrained systems.',
      ],
      watch: [
        'On cgroup v2 with kernel 4.15 or newer systemd reports CPU time without this option and treats it as a no-op, and systemd 258 removed it. This tuner offers it only for cgroup v1.',
      ],
    },
    tuningTip: 'Turn it on for observability on servers; the overhead on cgroup v2 is negligible.',
    kernelDocsUrl: `${SYSTEM_CONF}#systemd%20258`,
    contextNote: 'On Kubernetes / container hosts enable this so kubelet and cgroup tooling can attribute CPU time to each workload.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
    toggleLabels: { on: 'CPU accounting ENABLED for all units', off: 'CPU accounting off (per-unit override still possible)' },
  },
  {
    key: 'default_memory_accounting',
    title: 'Memory accounting',
    tier: 'advanced',
    sysctlName: 'DefaultMemoryAccounting',
    group: 'manager-defaults',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Track per-unit memory usage for every service by default.',
    longDesc: {
      what: [
        'Enables memory accounting for all units, so `systemctl status` shows a Memory: line for each and `systemd-cgtop` can rank them. Maps to the per-unit MemoryAccounting= setting. A unit with a memory limit (MemoryHigh=, MemoryMax=, MemorySwapMax=) gets the memory controller turned on either way.',
      ],
      when: [
        'systemd defaults this to yes on modern systems. Keep it on: limits still apply without it, but you lose the per-unit numbers for every unit without one, and on [[cgroup]] v2 the memory controller is the one you most want telemetry from.',
      ],
    },
    tuningTip: 'Leave it on for per-unit memory figures; MemoryHigh/MemoryMax limits apply either way, since a limit turns the controller on for its unit.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultMemoryAccounting=`,
    contextNote: 'On container hosts it shows the memory of every container unit, including those without a limit.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
    toggleLabels: { on: 'Memory accounting ENABLED for all units', off: 'Memory accounting off (units with a limit still count)' },
  },
  {
    key: 'default_io_accounting',
    title: 'Disk I/O accounting',
    tier: 'advanced',
    sysctlName: 'DefaultIOAccounting',
    group: 'manager-defaults',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Track per-unit block-I/O bytes for every service by default.',
    longDesc: {
      what: [
        'Enables block I/O accounting for all units so `systemd-cgtop` and `systemctl status` can report bytes read/written per service. Maps to the per-unit IOAccounting= setting and is needed before IOWeight= shaping is observable.',
      ],
      when: [
        'systemd defaults this to no because the io controller adds a little more overhead than cpu/memory accounting. Turn it on when you care about per-service disk throughput, e.g. to find a noisy-neighbour service.',
      ],
    },
    tuningTip: 'Enable it when diagnosing disk contention or before relying on IOWeight shaping.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultMemoryAccounting=`,
    contextNote: 'Useful on container hosts to attribute disk I/O to individual containers competing for the same device.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
    toggleLabels: { on: 'I/O accounting ENABLED for all units', off: 'I/O accounting off (default)' },
  },
  {
    key: 'default_tasks_accounting',
    title: 'Task accounting',
    tier: 'advanced',
    sysctlName: 'DefaultTasksAccounting',
    group: 'manager-defaults',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Count tasks (processes + threads) per unit, enabling TasksMax.',
    longDesc: {
      what: [
        'Enables the pids controller for all units so the number of tasks (processes and threads) each unit has spawned is counted and `systemctl status` shows a Tasks: line. A unit with a TasksMax= (including the one DefaultTasksMax= gives it) gets the pids controller turned on either way.',
      ],
      when: [
        'systemd defaults this to yes. Keep it on to see the task count of every unit; the cap that stops a fork bomb from exhausting the system-wide PID space comes from TasksMax and DefaultTasksMax, which work with it off too.',
      ],
    },
    tuningTip: 'Keep it on for per-unit task counts; the fork-bomb cap itself is TasksMax.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultMemoryAccounting=`,
    contextNote: 'On container hosts it shows how many tasks each container unit runs, next to the TasksMax that caps it.',
    kernelDefault: 1,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
    toggleLabels: { on: 'Tasks accounting ENABLED for all units', off: 'Tasks accounting off (units with a TasksMax still count)' },
  },
  {
    key: 'default_ip_accounting',
    title: 'Network accounting',
    tier: 'advanced',
    sysctlName: 'DefaultIPAccounting',
    group: 'manager-defaults',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Track per-unit network traffic (requires eBPF) by default.',
    longDesc: {
      what: [
        'Enables IP accounting for all units, recording bytes and packets sent/received per service via an [[eBPF|bpf]] program attached to the unit [[cgroup]]. Maps to the per-unit IPAccounting= setting.',
      ],
      when: [
        'systemd defaults this to no. It is the heaviest of the accounting options and only works where the kernel supports the required eBPF hooks, so enable it deliberately when you need per-service network figures.',
      ],
    },
    tuningTip: 'Turn it on only when you specifically need per-service network byte counts; leave off otherwise.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultMemoryAccounting=`,
    contextNote: 'Rarely enabled host-wide on Kubernetes nodes; the CNI usually owns network metrics instead.',
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
    toggleLabels: { on: 'IP accounting ENABLED for all units', off: 'IP accounting off (default)' },
  },
  {
    key: 'default_tasks_max',
    title: 'Tasks per service',
    tier: 'essential',
    sysctlName: 'DefaultTasksMax',
    group: 'manager-defaults',
    control: 'slider',
    shortDesc: 'The default cap on tasks (processes + threads) per unit.',
    longDesc: {
      what: [
        'Sets the TasksMax= that every unit inherits unless it overrides it: the maximum number of tasks a single service may create. This is the per-service fork-bomb guard rail.',
        'systemd derives the default as 15% of the minimum of kernel.pid_max, kernel.threads-max, and the root [[cgroup]] pids.max. The kernel sizes threads-max from RAM, so below 512 GiB it is the smaller: about 19,660 tasks with 16 GiB. With pid_max = 32768, as before systemd 243, it is at most the well-known 4915.',
      ],
      when: [
        'Raise it for hosts that legitimately run many threads per service (databases, JVMs, container runtimes). Lower it to make the fork-bomb guard rail tighter on multi-tenant systems.',
      ],
    },
    tuningTip: 'Raise it for thread-heavy services; lower it to tighten the per-unit fork-bomb guard on shared hosts.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultTasksMax=`,
    contextNote: 'Container hosts often raise this so a busy container runtime is not throttled at the default 15% of the PID space.',
    kernelDefault: 19660,
    kernelDefaultNote: '15% of the smaller of kernel.pid_max and kernel.threads-max, which scales with RAM (shown for 16 GiB).',
    kernelMin: 64,
    kernelMax: 4194304,
    step: 1024,
    unit: 'tasks',
  },
  {
    key: 'default_limit_nofile_soft',
    title: 'Open files per process, soft',
    tier: 'essential',
    sysctlName: 'DefaultLimitNOFILE (soft)',
    group: 'manager-defaults',
    control: 'slider',
    shortDesc: 'Default soft open-file-descriptor limit (RLIMIT_NOFILE).',
    longDesc: {
      what: [
        'The soft half of the default RLIMIT_NOFILE every unit inherits: the open-file-descriptor ceiling a process gets out of the box. A process may raise its own soft limit up to the hard limit without privilege.',
        'systemd ships 1024 as the soft default deliberately. Some legacy software calls select(), which breaks above FD 1024, so the soft limit stays low while the hard limit is generous, and well-behaved daemons bump their own soft limit to the hard value at startup.',
      ],
      when: [
        'Leave the soft limit at 1024 unless you specifically need every process to start with a higher ceiling; prefer raising the hard limit and letting services opt in.',
      ],
    },
    tuningTip: 'Usually leave at 1024; raise the hard limit instead and let services lift their own soft limit.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultLimitCPU=`,
    contextNote: 'Connection-heavy services (proxies, databases) on container hosts raise their own soft limit toward the hard value.',
    kernelDefault: 1024,
    kernelMin: 256,
    kernelMax: 1048576,
    step: 256,
    unit: 'count',
  },
  {
    key: 'default_limit_nofile_hard',
    title: 'Open files per process, hard',
    tier: 'advanced',
    sysctlName: 'DefaultLimitNOFILE (hard)',
    group: 'manager-defaults',
    control: 'slider',
    shortDesc: 'Default hard open-file-descriptor ceiling (RLIMIT_NOFILE).',
    longDesc: {
      what: [
        'The hard half of the default RLIMIT_NOFILE: the absolute ceiling a unit may raise its soft limit to without privilege. systemd 240 and later default it to 524288; older releases used 4096.',
      ],
      when: [
        'This is the value connection-heavy daemons (web servers, proxies, databases) actually care about, because they raise their soft limit up to it at startup. Raise it on hosts that run such services; there is little downside since [[file descriptors|file-descriptor]] are cheap.',
      ],
      watch: [
        'It must be greater than or equal to the soft limit. The kernel hard ceiling is controlled separately by fs.nr_open.',
      ],
    },
    tuningTip: 'Raise it on hosts running many high-connection services; keep it ≥ the soft limit.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultLimitCPU=`,
    contextNote: 'Kubernetes nodes commonly raise this to 1048576 so the container runtime and busy pods do not hit the FD ceiling.',
    kernelDefault: 524288,
    kernelMin: 1024,
    kernelMax: 1048576,
    step: 1024,
    unit: 'count',
  },
  {
    key: 'default_limit_memlock',
    title: 'Locked memory per process',
    tier: 'advanced',
    sysctlName: 'DefaultLimitMEMLOCK',
    group: 'manager-defaults',
    control: 'slider',
    shortDesc: 'Default locked-in-memory ceiling (RLIMIT_MEMLOCK) per unit.',
    longDesc: {
      what: [
        'The default RLIMIT_MEMLOCK every unit inherits: how much memory a process may lock into RAM with mlock()/mlockall() so it can never be swapped out. systemd 253 and later default it to 8M; older releases used 64K, and Ubuntu 18.04 ships 64M.',
      ],
      when: [
        'Databases (to pin buffers/WAL), crypto daemons (to keep keys out of swap), and increasingly [[eBPF|bpf]] and RDMA workloads need this raised, otherwise their mlock() calls fail. Raise it for those; leave the small default in place elsewhere so a buggy process cannot lock arbitrary amounts of unswappable RAM.',
      ],
    },
    tuningTip: 'Raise it for databases, crypto, eBPF and RDMA workloads; keep it small otherwise.',
    kernelDocsUrl: `${SYSTEM_CONF}#DefaultLimitCPU=`,
    contextNote: 'Container hosts running databases or eBPF-heavy CNIs raise this well above the default (8M on systemd 253 and later).',
    kernelDefault: 8388608,
    kernelMin: 0,
    kernelMax: 1073741824,
    step: 1048576,
    unit: 'bytes',
  },

  // ── Slice resource control (slice drop-in) ───────────────────────────────
  {
    key: 'cpu_weight',
    title: 'CPU share',
    tier: 'essential',
    sysctlName: 'CPUWeight',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Proportional CPU share for this slice under contention.',
    longDesc: {
      what: [
        'Sets the [[cgroup]] v2 cpu.weight for the slice. When several siblings compete for a saturated CPU, available time is divided in proportion to their weights: a slice with weight 200 gets twice the CPU of a sibling with weight 100. When the CPU is not contended, weight does nothing and every unit runs at full speed.',
      ],
      when: [
        'The value runs from 1 to 10000 with a default of 100. Raise the weight of the slice whose latency matters most (e.g. system.slice on a server so daemons out-prioritise interactive user sessions); lower it to make a slice yield under load.',
      ],
      watch: [
        'Weight only redistributes spare capacity; it never caps a slice. Use CPUQuota for a hard ceiling.',
      ],
    },
    tuningTip: 'Raise it to prioritise this slice under CPU contention; it has no effect when the CPU is idle.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#CPUWeight=weight`,
    contextNote: 'On nodes that co-locate workloads, raise system.slice weight so critical daemons keep CPU when pods saturate the machine.',
    kernelDefault: 100,
    kernelMin: 1,
    kernelMax: 10000,
    step: 1,
    unit: 'weight',
    zones: [
      { label: '1–50: yields', min: 1, max: 50, note: 'This slice gives way to its siblings while the CPU is busy.' },
      { label: '100: default', min: 100, max: 100, note: 'The kernel default, the same share as any sibling left unset.' },
      { label: '200–1000: prioritised', min: 200, max: 1000, note: 'This slice gets a larger share of a busy CPU than its siblings at the default.' },
      { label: '10000: max', min: 10000, max: 10000, note: 'The largest weight: siblings at the default get very little while this slice keeps the CPU busy.' },
    ],
  },
  {
    key: 'cpu_quota',
    title: 'CPU cap',
    tier: 'advanced',
    sysctlName: 'CPUQuota',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Hard ceiling on CPU time for this slice, across all cores.',
    longDesc: {
      what: [
        'An absolute cap on CPU time via the [[cgroup]] v2 cpu controller, expressed as a percentage where 100% equals one full core. On a multi-core host you set it above 100%: 400% lets the slice burn up to four cores’ worth of CPU, even if more are idle.',
      ],
      when: [
        'Unlike CPUWeight (which only shares spare capacity), CPUQuota throttles the slice even on an otherwise idle machine. Use it to stop a batch/build slice from ever monopolising the box, or to make capacity predictable for billing.',
        'At the top of the slider the quota is removed entirely (no limit), which is the systemd default; units are bounded only by weight and the number of cores.',
      ],
    },
    tuningTip: 'Set it to cap a slice to N cores (N×100%); leave it at the top for no hard CPU limit.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#CPUQuota=`,
    contextNote: 'Used to reserve headroom for the host: cap user.slice or a batch slice so kubelet/system daemons always have CPU.',
    kernelDefault: 100,
    // systemd rejects CPUQuota=0% and ignores the line (= no limit). 10 keeps
    // every step-10 value, including each N×100%, reachable.
    kernelMin: 10,
    kernelMax: 25600,
    step: 10,
    unit: 'pct-cores',
  },
  {
    key: 'memory_high',
    title: 'Memory soft limit',
    tier: 'essential',
    sysctlName: 'MemoryHigh',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Soft memory limit: throttle (not kill) when the slice exceeds it.',
    longDesc: {
      what: [
        'The main memory-pressure mechanism in [[cgroup]] v2. When the slice’s usage rises above MemoryHigh the kernel does not kill anything; it aggressively [[reclaims|reclaim]] the slice’s pages and throttles its allocations, slowing it down so it backs off. Usage may briefly exceed the line when reclaim cannot keep up.',
      ],
      when: [
        'Expressed here as a percentage of total RAM. Set it below MemoryMax so a slice hits the gentle throttle first and only reaches the hard cap if it keeps climbing. This is the knob you reach for to keep one slice from starving the rest of the system of [[page cache]].',
        'At 100% the soft limit is removed (infinity): no throttling, only the hard MemoryMax (if any) applies.',
      ],
    },
    tuningTip: 'Set it a little below MemoryMax so the slice is throttled before it is ever OOM-killed.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#MemoryHigh=bytes`,
    contextNote: 'Set on system.slice to protect host daemons, or on user.slice to keep interactive sessions from swamping a node.',
    kernelDefault: 100,
    kernelMin: 1, // systemd ignores a 0% limit (= no limit)
    kernelMax: 100,
    step: 1,
    unit: 'pct',
    zones: [
      { label: 'below MemoryMax: throttle band' },
      { label: '100%: no soft limit', min: 100, max: 100, note: 'No soft limit: the slice is never slowed for its own memory use.' },
    ],
  },
  {
    key: 'memory_max',
    title: 'Memory hard limit',
    tier: 'essential',
    sysctlName: 'MemoryMax',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Hard memory limit: OOM-kill inside the slice when exceeded.',
    longDesc: {
      what: [
        'The absolute memory ceiling for the slice, enforced by the [[cgroup]] v2 memory controller. If usage cannot be brought under the limit by [[reclaim]], the [[OOM killer]] is invoked inside the slice and kills one of its processes, so the rest of the system is protected.',
      ],
      when: [
        'Expressed here as a percentage of total RAM. systemd recommends using MemoryHigh as the primary control and MemoryMax as the last line of defence a little above it, so the slice is throttled before anything is killed.',
      ],
      watch: [
        'At 100% the hard limit is removed (infinity). Setting it too low guarantees the slice’s processes are killed under load, so size it to the slice’s real working set plus headroom.',
      ],
    },
    tuningTip: 'Use it as a safety cap just above MemoryHigh; sizing it too tight guarantees OOM kills.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#MemoryMax=bytes`,
    contextNote: 'On Kubernetes nodes, MemoryMax on user.slice/system.slice reserves RAM that pods can never consume.',
    kernelDefault: 100,
    kernelMin: 1, // systemd ignores a 0% limit (= no limit)
    kernelMax: 100,
    step: 1,
    unit: 'pct',
    zones: [
      { label: '≥ MemoryHigh: safety cap' },
      { label: '100%: no hard limit', min: 100, max: 100, note: 'No hard limit: only the memory of the whole machine bounds the slice.' },
    ],
  },
  {
    key: 'memory_swap_max',
    title: 'Swap cap',
    tier: 'advanced',
    sysctlName: 'MemorySwapMax',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Cap on how much swap this slice may use.',
    longDesc: {
      what: [
        'Limits the swap (not RAM) the slice may consume, via the [[cgroup]] v2 memory controller. Set here as a percentage of total RAM for an at-a-glance budget, and written to the file as that many bytes: systemd reads a percentage here as a share of RAM, but its manual says of swap, so a byte size is the one form that means the same on every version.',
      ],
      when: [
        'Set it to 0 to forbid the slice from swapping at all: the classic database tuning, where you would rather the slice be reclaimed or [[OOM-killed|oom-killer]] than suffer the latency of paging buffers to disk. Leave it at 100% (infinity) to let the slice use swap freely.',
      ],
    },
    tuningTip: 'Set 0 to pin a latency-sensitive slice (e.g. a database) out of swap; leave at the top otherwise.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#MemorySwapMax=bytes`,
    contextNote: 'Pair with the swap tuner: a database slice often sets MemorySwapMax=0 even when the host has swap configured.',
    kernelDefault: 100,
    kernelMin: 0,
    kernelMax: 100,
    step: 1,
    unit: 'pct',
    zones: [
      { label: '0%: no swap for slice', min: 0, max: 0, note: 'The memory of this slice is never moved to swap.' },
      { label: '100%: unlimited swap', min: 100, max: 100, note: 'No swap limit: the slice may use swap freely.' },
    ],
  },
  {
    key: 'io_weight',
    title: 'Disk I/O share',
    tier: 'advanced',
    sysctlName: 'IOWeight',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Proportional block-I/O bandwidth share under contention.',
    longDesc: {
      what: [
        'Sets the [[cgroup]] v2 io.weight for the slice. When units compete for a saturated block device, bandwidth is split in proportion to their weights, exactly like CPUWeight does for CPU. Requires the io controller and is only observable with I/O accounting on.',
      ],
      when: [
        'The value runs from 1 to 10000 with a default of 100. Raise it for the slice whose disk latency matters (databases, the journal), lower it for bulk/batch slices so they yield the disk under contention.',
      ],
      watch: [
        'Weight only divides contended bandwidth; it never throttles a slice on an idle device. It also depends on a controller that supports weights (e.g. bfq / the cgroup v2 io controller).',
      ],
    },
    tuningTip: 'Raise it to give this slice priority on a contended disk; lower it to make batch slices yield.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#IOWeight=weight`,
    contextNote: 'On busy nodes, raise system.slice IOWeight so journald and critical daemons keep disk bandwidth under load.',
    kernelDefault: 100,
    kernelMin: 1,
    kernelMax: 10000,
    step: 1,
    unit: 'weight',
    zones: [
      { label: '1–50: yields', min: 1, max: 50, note: 'This slice gives way to its siblings while the disk is busy, where the disk splits time by weight.' },
      { label: '100: default', min: 100, max: 100, note: 'The default, the same share as any sibling left unset.' },
      { label: '200–1000: prioritised', min: 200, max: 1000, note: 'This slice gets a larger share of a busy disk, where the disk splits time by weight.' },
      { label: '10000: max', min: 10000, max: 10000, note: 'The largest weight: siblings at the default get very little disk time while this slice is busy.' },
    ],
  },
  {
    key: 'tasks_max',
    title: 'Tasks per slice',
    tier: 'advanced',
    sysctlName: 'TasksMax',
    group: 'slice-resources',
    control: 'slider',
    shortDesc: 'Hard cap on tasks (processes + threads) for this slice.',
    longDesc: {
      what: [
        'Caps the total number of tasks the slice and everything beneath it may run, via the [[cgroup]] v2 pids controller. Where DefaultTasksMax bounds a single unit, this bounds the whole slice hierarchy, useful for reserving PID-space headroom for the rest of the system.',
      ],
      when: [
        'Set it to contain a slice (e.g. user.slice) so logged-in users or a runaway workload cannot exhaust the host PID space and block the system daemons from forking. Size it to the slice’s legitimate peak task count plus margin.',
      ],
    },
    tuningTip: 'Cap a multi-tenant slice (e.g. user.slice) so it cannot exhaust the host PID space.',
    kernelDocsUrl: `${RESOURCE_CONTROL}#TasksMax=N`,
    contextNote: 'On shared nodes, cap user.slice TasksMax so interactive sessions leave PID headroom for kubelet and system services.',
    kernelDefault: 19660,
    kernelDefaultNote: '15% of the smaller of kernel.pid_max and kernel.threads-max, which scales with RAM (shown for 16 GiB).',
    kernelMin: 64,
    kernelMax: 4194304,
    step: 1024,
    unit: 'tasks',
  },
]

/** Quick lookup by key. */
export const SYSTEMD_DEFS_BY_KEY = Object.fromEntries(SYSTEMD_DEFS.map((d) => [d.key, d]))

/** All parameter keys, in display order. */
export const SYSTEMD_KEYS = /** @type {(keyof SystemdValues)[]} */ (SYSTEMD_DEFS.map((d) => d.key))
