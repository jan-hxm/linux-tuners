/**
 * Static metadata for every kernel.* sysctl the tuner exposes. Each entry is
 * the single source of truth for the key's name, group, kernel default,
 * offered range, description and source link.
 *
 * The defaults, accepted values and distribution files were measured on the
 * VM images (vm/README.md). The scheduler sysctls older guides set are not
 * offered: sched_min_granularity_ns and its siblings only exist before 5.13,
 * and sched_autogroup_enabled changes nothing for processes in a systemd
 * slice once systemd enables the cpu controller (about.js says more).
 *
 * @typedef {'procs' | 'keys' | 'panic' | 'console'} KernelGroup
 *
 * @typedef {Object} KernelValues
 * @property {number}   pid_max           Highest PID plus one
 * @property {number}   threads_max       Threads system-wide
 * @property {number}   maxkeys           Keys per non-root user
 * @property {number}   maxbytes          Key bytes per non-root user
 * @property {number}   panic             Seconds before rebooting after a panic; 0 never
 * @property {number}   panic_on_oops     Panic on an oops (0/1)
 * @property {number}   softlockup_panic  Panic on a soft lockup (0/1)
 * @property {'off'|'sync'|'reboot'|'debian'|'all'} sysrq  Magic SysRq functions; the option's sysctlValue is the bitmask
 * @property {number[]} printk            console, default message, minimum console, boot console loglevel
 */

const KERNEL_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const KEYS_DOCS = 'https://docs.kernel.org/security/keys/core.html'

/** LXD's server settings, the source for the container host key quotas. */
export const LXD_SERVER_SETTINGS = 'https://canonical.com/lxd/docs/en/latest/reference/server_settings/'

/** The highest kernel.pid_max on 64-bit (PID_MAX_LIMIT), which systemd 243+ sets. */
export const PID_MAX_LIMIT = 4194304

export const PARAMETER_DEFS = [
  // ── Processes & threads ───────────────────────────────────────────────────
  {
    key: 'pid_max',
    sysctlName: 'kernel.pid_max',
    group: 'procs',
    control: 'slider',
    shortDesc: 'The highest process ID plus one, which caps how many processes and threads exist.',
    longDesc: [
      'Every process and every thread takes a PID, so this is also a ceiling on threads. When all are taken, fork() and clone() fail with EAGAIN.',
      'The kernel starts at 32768, or 1024 per possible CPU when that is more. systemd 243 and newer raise it to 4194304, the most the kernel takes on 64-bit, from /usr/lib/sysctl.d/50-pid-max.conf, so this card only shows for older systemd.',
    ],
    tuningTip: 'Raise it to 4194304, as newer systemd does.',
    kernelDocsUrl: `${KERNEL_DOCS}#pid-max`,
    containerNote: null,
    kernelDefault: 32768,
    kernelDefaultNote: '1024 per possible CPU when that is more than 32768; systemd 243 and newer set 4194304.',
    kernelMin: 32768,
    kernelMax: PID_MAX_LIMIT,
    step: 32768,
    unit: 'count',
  },
  {
    key: 'threads_max',
    sysctlName: 'kernel.threads-max',
    group: 'procs',
    control: 'slider',
    shortDesc: 'How many threads (and processes) may exist at once, system-wide.',
    longDesc: [
      'The kernel sizes it at boot so that the threads\' kernel stacks fit in an eighth of RAM: about one thread per 128 KiB, 131072 on 16 GiB. Past it, fork() and clone() fail with EAGAIN.',
      'systemd sets each service\'s default TasksMax to 15% of the smaller of this and kernel.pid_max when it starts, so on small machines this is what caps a service at a few thousand threads. Raising it raises that cap after a reboot or systemctl daemon-reexec.',
      'Never set it below the threads already running: the kernel accepts the value, and from then on nothing can fork, SSH logins included.',
    ],
    tuningTip: 'Leave it unless services hit their TasksMax on a small machine.',
    kernelDocsUrl: `${KERNEL_DOCS}#threads-max`,
    containerNote: null,
    kernelDefault: 131072,
    kernelDefaultNote: 'About RAM / 128 KiB: 131072 on 16 GiB.',
    kernelMin: 2048,
    kernelMax: PID_MAX_LIMIT,
    step: 1024,
    unit: 'count',
  },
  // ── Key quotas ────────────────────────────────────────────────────────────
  {
    key: 'maxkeys',
    sysctlName: 'kernel.keys.maxkeys',
    group: 'keys',
    control: 'slider',
    shortDesc: 'How many kernel keys each non-root user may hold.',
    longDesc: [
      'The kernel keyring stores credentials such as Kerberos tickets, filesystem encryption keys and the session keyrings systemd creates for services. Each user ID other than root has its own quota; past it, add_key() fails with EDQUOT ("Disk quota exceeded"). cat /proc/key-users shows what each user holds.',
      'Containers with user namespaces run as non-root host user IDs, so every service in them counts against this quota rather than root\'s 1000000. LXD suggests 2000, more than the number of containers on the host.',
    ],
    tuningTip: 'Raise it to 2000 on container hosts; leave it elsewhere.',
    kernelDocsUrl: `${KEYS_DOCS}#new-procfs-files`,
    containerNote: 'LXD suggests 2000, more than the number of containers.',
    kernelDefault: 200,
    kernelMin: 200,
    kernelMax: 1000000,
    step: 100,
    unit: 'count',
  },
  {
    key: 'maxbytes',
    sysctlName: 'kernel.keys.maxbytes',
    group: 'keys',
    control: 'slider',
    shortDesc: 'How many bytes of key descriptions and payloads each non-root user may hold.',
    longDesc: [
      'The second half of the quota: a key counts its description and payload. The default allows 100 bytes per key at the default count, and a Kerberos ticket alone is larger, so raise it along with kernel.keys.maxkeys.',
      'LXD suggests 2000000 on container hosts. Root\'s own quota is 25000000.',
    ],
    tuningTip: 'Raise it to 2000000 with kernel.keys.maxkeys on container hosts.',
    kernelDocsUrl: `${KEYS_DOCS}#new-procfs-files`,
    containerNote: 'LXD suggests 2000000.',
    kernelDefault: 20000,
    kernelMin: 20000,
    kernelMax: 25000000,
    step: 10000,
    unit: 'bytes',
  },
  // ── Panics ────────────────────────────────────────────────────────────────
  {
    key: 'panic',
    sysctlName: 'kernel.panic',
    group: 'panic',
    control: 'slider',
    shortDesc: 'Seconds the kernel waits after a panic before it reboots; 0 never reboots.',
    longDesc: [
      'After a panic the kernel stops. At 0 it stays stopped, showing the panic on the console, until someone resets the machine; a server in a data centre or a cloud VM stays down until then. Above 0 it reboots after that many seconds.',
      'This is what makes the other panic switches reboot: kernel.panic_on_oops, kernel.softlockup_panic and vm.panic_on_oom (on the swap tuner) only panic, and the reboot comes from here. With kdump set up, the crash kernel saves a dump first.',
    ],
    tuningTip: 'Use 10 on servers so a crash ends in a reboot; 0 on desktops to read the message.',
    kernelDocsUrl: `${KERNEL_DOCS}#panic`,
    containerNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 600,
    step: 1,
    unit: 'seconds',
  },
  {
    key: 'panic_on_oops',
    sysctlName: 'kernel.panic_on_oops',
    group: 'panic',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: an oops panics the kernel', off: 'off: the kernel kills the task and carries on' },
    shortDesc: 'Turn a kernel oops into a panic instead of killing the task and carrying on.',
    longDesc: [
      'An oops is a kernel bug caught at run time, often a bad pointer in a driver. By default the kernel kills the task that hit it and keeps running, but that task may have held locks or left kernel data half changed, so the machine can hang or corrupt data later.',
      'On, the kernel panics instead, and with kernel.panic above 0 reboots into a clean state. That suits servers that something else watches; on a desktop it loses open work for a fault that might only have broken one device.',
    ],
    tuningTip: 'Turn it on for servers, together with kernel.panic.',
    kernelDocsUrl: `${KERNEL_DOCS}#panic-on-oops`,
    containerNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'softlockup_panic',
    sysctlName: 'kernel.softlockup_panic',
    group: 'panic',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'on: a soft lockup panics the kernel', off: 'off: a soft lockup is only logged' },
    shortDesc: 'Panic when a CPU is stuck in the kernel for 20 seconds (a soft lockup).',
    longDesc: [
      'The kernel watchdog reports a soft lockup when a CPU runs kernel code for twice kernel.watchdog_thresh (20 seconds) without letting anything else run. By default it logs "BUG: soft lockup" with a backtrace and carries on.',
      'On, it panics instead. In a virtual machine a host too busy to run the guest can look like a lockup, so turn it on only where the host is not overcommitted.',
    ],
    tuningTip: 'Leave it off unless lockups have hung this machine before.',
    kernelDocsUrl: `${KERNEL_DOCS}#softlockup-panic`,
    containerNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  {
    key: 'sysrq',
    sysctlName: 'kernel.sysrq',
    group: 'panic',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'off', sysctlValue: '0', label: '0: off' },
      { value: 'sync', sysctlValue: '16', label: '16: sync only (Fedora)' },
      { value: 'reboot', sysctlValue: '176', label: '176: sync, remount read-only, reboot (Ubuntu)' },
      { value: 'debian', sysctlValue: '438', label: '438: also keyboard, loglevel and nice keys (Debian)' },
      { value: 'all', sysctlValue: '1', label: '1: everything, including killing all processes' },
    ],
    shortDesc: 'Which Magic SysRq functions the keyboard and serial console may trigger.',
    longDesc: [
      'Alt+SysRq with a letter (or a break on a serial console) reaches the kernel even when the system is hung: S syncs the disks, U remounts them read-only and B reboots, so 176 is enough to restart a hung machine without damaging its filesystems. Other functions kill every process, show memory and register dumps, or crash the kernel.',
      'This is a bitmask: 1 allows everything, 0 nothing. It only covers the keyboard and serial console; root can trigger every function at any setting by writing to /proc/sysrq-trigger.',
    ],
    tuningTip: 'Use 176 to recover a hung machine; 0 where untrusted people reach the console.',
    kernelDocsUrl: `${KERNEL_DOCS}#sysrq`,
    containerNote: null,
    kernelDefault: 'all',
    kernelDefaultNote: 'Distributions change it: Debian starts at 438, Ubuntu at 176 and Fedora at 16.',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  // ── Console ───────────────────────────────────────────────────────────────
  {
    key: 'printk',
    sysctlName: 'kernel.printk',
    group: 'console',
    type: 'tuple',
    length: 4,
    control: 'tuple',
    tupleLabels: ['console', 'default message', 'minimum console', 'boot console'],
    elementLimits: [
      { min: 1, max: 8 },
      { min: 0, max: 7 },
      { min: 1, max: 8 },
      { min: 1, max: 8 },
    ],
    shortDesc: 'Which kernel messages are printed on the console, by log level.',
    longDesc: [
      'Kernel messages have a level from 0 (emergency) to 7 (debug). The first number is the console loglevel: messages below it are printed on the console, the screen or serial port. At 4 only errors and worse are; at 7 everything but debug messages, which spills driver chatter over a text login.',
      'The other three are the level a message that names none gets (4), the lowest console loglevel a program may set with dmesg -n (1), and the default console loglevel (7); keep them. The kernel keeps every message whatever the console shows: dmesg and the journal still have them.',
    ],
    tuningTip: 'Use 4 4 1 7, as Ubuntu does, so only errors reach the console.',
    kernelDocsUrl: `${KERNEL_DOCS}#printk`,
    containerNote: null,
    kernelDefault: [7, 4, 1, 7],
    kernelDefaultNote: 'Ubuntu sets 4 4 1 7 in /etc/sysctl.d/10-console-messages.conf.',
    kernelMin: 0,
    kernelMax: 8,
    step: 1,
    unit: 'count',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
