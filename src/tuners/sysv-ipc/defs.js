/**
 * Static metadata for every System V IPC sysctl the tuner exposes. Each entry
 * is the single source of truth for the key's name, group, kernel default,
 * offered range, description and source link.
 *
 * Since kernel 3.19 the defaults are far above what database guides ask for,
 * so every range starts at the kernel default: a lower value only makes
 * programs fail. kernel.shmmax and kernel.shmall are not offered, since their
 * default (18446744073692774399) is no limit and every value lowers it. The
 * defaults, limits and namespace behaviour were measured on the VM images
 * (vm/README.md).
 *
 * @typedef {'shm' | 'sem' | 'msg'} IpcGroup
 *
 * @typedef {Object} IpcValues
 * @property {number}   shmmni           Shared memory segments system-wide
 * @property {number}   shm_rmid_forced  Remove orphaned segments (0/1)
 * @property {number[]} sem              SEMMSL, SEMMNS, SEMOPM, SEMMNI
 * @property {number}   msgmni           Message queues system-wide
 * @property {number}   msgmax           Largest message in bytes
 * @property {number}   msgmnb           Default queue size in bytes
 */

const KERNEL_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/kernel.html'
const SEM_MAN = 'https://man7.org/linux/man-pages/man5/proc_sys_kernel.5.html'

/** Source for the Db2 minimums; rendered as a plain "Source" link. */
export const DB2_KERNEL_PARAMS = 'https://www.ibm.com/docs/en/db2/11.5.x?topic=unix-kernel-parameter-requirements-linux'
export const ORACLE_KERNEL_PARAMS = 'https://docs.oracle.com/en/database/oracle/oracle-database/23/cwlin/minimum-parameter-settings-for-installation.html'

/** The most IPC identifiers of one kind the kernel accepts (IPCMNI). */
export const IPC_ID_MAX = 32768

const INT_MAX = 2147483647

/** kernel.sem as the kernel sets it: SEMMSL, SEMMNS, SEMOPM, SEMMNI. */
export const SEM_DEFAULT = [32000, 1024000000, 500, 32000]

export const PARAMETER_DEFS = [
  // ── Shared memory ─────────────────────────────────────────────────────────
  {
    key: 'shmmni',
    title: 'Shared memory segments',
    sysctlName: 'kernel.shmmni',
    group: 'shm',
    control: 'slider',
    shortDesc: 'How many System V shared memory segments may exist at once.',
    longDesc: {
      what: [
        'Every shmget() that creates a segment takes one, and it stays until it is removed, even when no process has it attached. When all are taken, shmget() fails with ENOSPC. ipcs -m lists what exists now.',
      ],
      when: [
        'The kernel default is 4096. Oracle Database asks for 4096, and Db2 for 256 per GB of RAM, so Db2 hosts with more than 16 GB need it raised. The kernel takes at most 32768.',
      ],
      watch: [
        'How large a segment may be (kernel.shmmax) and how much they may take together (kernel.shmall) default to 18446744073692774399, no limit, since kernel 3.16, so they are not offered: a value from an installation guide only lowers them.',
      ],
    },
    tuningTip: 'Leave it at 4096 unless Db2 or another product asks for more.',
    kernelDocsUrl: `${KERNEL_DOCS}#shmmni`,
    dbNote: 'Db2 asks for 256 × GB of RAM, and raises it itself when an instance starts.',
    kernelDefault: 4096,
    kernelMin: 4096,
    kernelMax: IPC_ID_MAX,
    step: 256,
    unit: 'count',
  },
  {
    key: 'shm_rmid_forced',
    title: 'Remove unused segments',
    sysctlName: 'kernel.shm_rmid_forced',
    group: 'shm',
    type: 'bool',
    control: 'toggle',
    shortDesc: 'Remove a shared memory segment once no process uses it any more.',
    longDesc: {
      what: [
        'A System V segment normally outlives every process that used it, until something removes it with ipcrm or shmctl(IPC_RMID). A program that crashes, or a user who logs out, can leave segments behind that hold memory until reboot.',
      ],
      watch: [
        'At 1 the kernel removes a segment as soon as no process has it attached and the process that created it has exited. That frees leaked segments, but breaks software that creates a segment for a later process to pick up, such as a tool that sets one up and exits.',
      ],
    },
    tuningTip: 'Leave it off on database hosts; turn it on for multi-user machines where segments leak.',
    kernelDocsUrl: `${KERNEL_DOCS}#shm-rmid-forced`,
    dbNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  // ── Semaphores ────────────────────────────────────────────────────────────
  {
    key: 'sem',
    title: 'Semaphore limits',
    sysctlName: 'kernel.sem',
    group: 'sem',
    type: 'tuple',
    length: 4,
    control: 'tuple',
    tupleLabels: ['SEMMSL', 'SEMMNS', 'SEMOPM', 'SEMMNI'],
    elementLimits: [
      { min: SEM_DEFAULT[0], max: 65536 },
      { min: SEM_DEFAULT[1], max: INT_MAX },
      { min: SEM_DEFAULT[2], max: 32768 },
      { min: SEM_DEFAULT[3], max: IPC_ID_MAX },
    ],
    shortDesc: 'Semaphore limits: per array, system-wide, per call, and how many arrays.',
    longDesc: {
      what: [
        'Four numbers: SEMMSL, the most semaphores in one array (semget() fails above it); SEMMNS, the most semaphores in all arrays together; SEMOPM, the most operations one semop() call may do; and SEMMNI, how many arrays may exist. The kernel default since 3.19 is 32000 1024000000 500 32000.',
      ],
      when: [
        'Installation guides still give the old values: Oracle lists 250 32000 100 128 as its minimum, and Db2 250 256000 32 with SEMMNI at 256 per GB of RAM. Those are below the kernel default, so pasting them lowers the limits, SEMMNI from 32000 to 128. Write all four numbers: with fewer, the missing ones keep whatever they were.',
      ],
      watch: [
        'SEMMNI takes at most 32768, the other three up to 2147483647.',
      ],
    },
    tuningTip: 'Keep the kernel default; raise SEMMNI only for Db2 above 125 GB of RAM.',
    kernelDocsUrl: SEM_MAN,
    dbNote: 'Oracle and Db2 minimums are all at or below the kernel default, except Db2\'s SEMMNI above 125 GB of RAM.',
    kernelDefault: SEM_DEFAULT,
    kernelMin: SEM_DEFAULT[2],
    kernelMax: INT_MAX,
    step: 1,
    unit: 'count',
  },
  // ── Message queues ────────────────────────────────────────────────────────
  {
    key: 'msgmni',
    title: 'Message queues',
    sysctlName: 'kernel.msgmni',
    group: 'msg',
    control: 'slider',
    shortDesc: 'How many System V message queues may exist at once.',
    longDesc: {
      what: [
        'Every msgget() that creates a queue takes one, and it stays until it is removed. When all are taken, msgget() fails with ENOSPC. ipcs -q lists what exists now.',
      ],
      when: [
        'The kernel default is 32000 and the kernel takes at most 32768, so there is little room either way. Db2 asks for 1024 per GB of RAM, which passes the default at 32 GB.',
      ],
    },
    tuningTip: 'Leave it at 32000 unless Db2 on 32 GB or more asks for 32768.',
    kernelDocsUrl: `${KERNEL_DOCS}#msgmni`,
    dbNote: 'Db2 asks for 1024 × GB of RAM, and raises it itself when an instance starts.',
    kernelDefault: 32000,
    kernelMin: 32000,
    kernelMax: IPC_ID_MAX,
    step: 128,
    unit: 'count',
  },
  {
    key: 'msgmax',
    title: 'Largest message',
    sysctlName: 'kernel.msgmax',
    group: 'msg',
    control: 'slider',
    shortDesc: 'The largest message, in bytes, one msgsnd() may send.',
    longDesc: {
      what: [
        'A larger message fails with EINVAL. The kernel default is 8192 bytes; Db2 asks for 65536.',
      ],
      watch: [
        'A message also has to fit in the queue it is sent to, whose size starts at kernel.msgmnb. Keep this at or below that.',
      ],
    },
    tuningTip: 'Raise it to 65536 for Db2; leave it elsewhere.',
    kernelDocsUrl: `${KERNEL_DOCS}#msgmax-msgmnb-and-msgmni`,
    dbNote: 'Db2 asks for 65536.',
    kernelDefault: 8192,
    kernelMin: 8192,
    kernelMax: 4194304,
    step: 8192,
    unit: 'bytes',
  },
  {
    key: 'msgmnb',
    title: 'Bytes per message queue',
    sysctlName: 'kernel.msgmnb',
    group: 'msg',
    control: 'slider',
    shortDesc: 'How many bytes of messages a new queue may hold before senders wait.',
    longDesc: {
      what: [
        'A queue starts with this size, and msgsnd() waits (or fails with EAGAIN) while the queue is full. The owner can lower its own queue\'s size; only root can raise it above this value.',
      ],
      watch: [
        'Queued messages are kernel memory that can\'t be swapped. Any local user may create queues, so the worst case is every queue full: kernel.msgmni × this value, about 500 MiB at the defaults.',
      ],
    },
    tuningTip: 'Raise it to 65536 for Db2; the formula shows the worst-case memory.',
    kernelDocsUrl: `${KERNEL_DOCS}#msgmax-msgmnb-and-msgmni`,
    dbNote: 'Db2 asks for 65536.',
    kernelDefault: 16384,
    kernelMin: 16384,
    kernelMax: 16777216,
    step: 16384,
    unit: 'bytes',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
