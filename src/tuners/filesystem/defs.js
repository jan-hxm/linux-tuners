/**
 * Static metadata for every fs.* sysctl the tuner exposes. Each entry is the
 * single source of truth for the key's name, group, kernel default, offered
 * range, description and source link.
 *
 * The ranges start at the kernel default wherever a lower value only makes
 * programs fail: below it, fs.nr_open stops units from starting and the
 * inotify and AIO limits refuse new watches and contexts. Behaviour that
 * depends on the distribution was measured on the VM images (vm/README.md).
 *
 * @typedef {'descriptors' | 'inotify' | 'aio'} FilesystemGroup
 *
 * @typedef {Object} FilesystemValues
 * @property {number} file_max            System-wide open files; left out on systemd 240+
 * @property {number} nr_open             Per-process descriptor ceiling; left out at 1048576
 * @property {number} max_user_watches    inotify watches per user
 * @property {number} max_user_instances  inotify instances per user
 * @property {number} max_queued_events   Queued events per inotify instance
 * @property {number} aio_max_nr          System-wide native AIO events
 */

const FS_DOCS = 'https://docs.kernel.org/admin-guide/sysctl/fs.html'
const INOTIFY_MAN = 'https://man7.org/linux/man-pages/man7/inotify.7.html'

/** Source for the Kubernetes notes; rendered as a plain "Source" link. */
export const KIND_KNOWN_ISSUES = 'https://kind.sigs.k8s.io/docs/user/known-issues/#pod-errors-due-to-too-many-open-files'

/** The kernel's fs.nr_open default. At this value the key is left out. */
export const NR_OPEN_DEFAULT = 1048576

/** The highest fs.nr_open a 64-bit kernel accepts. */
export const NR_OPEN_MAX = 2147483584

export const PARAMETER_DEFS = [
  // ── File descriptors ──────────────────────────────────────────────────────
  {
    key: 'file_max',
    title: 'Open files, system-wide',
    tier: 'essential',
    sysctlName: 'fs.file-max',
    group: 'descriptors',
    control: 'slider',
    shortDesc: 'How many files all processes together may have open.',
    longDesc: {
      what: [
        'Every open file, socket, pipe and epoll instance takes an entry in one system-wide table. When it is full, every process without CAP_SYS_ADMIN gets ENFILE ("Too many open files in system") on its next open(), including the SSH session you would fix it from. fs.file-nr shows how many are in use.',
        'The kernel picks about 10% of RAM in KiB at boot, roughly 100 files per MiB. systemd 240 and newer raise it to 9223372036854775807, the largest value the key takes, before the sysctl files are applied, so on those systems it is left out of the file: any number written here would lower it.',
      ],
      when: [
        'Only machines with an older systemd, or none, need it raised. Keep it well above what fs.file-nr shows at peak, and above fs.nr_open, so one process can\'t take the whole table.',
      ],
    },
    tuningTip: 'Only for systemd older than 240: raise it to a few million on busy servers.',
    kernelDocsUrl: `${FS_DOCS}#file-max-file-nr`,
    k8sNote: null,
    kernelDefault: 1638400,
    kernelDefaultNote: 'About 10% of RAM in KiB (shown for 16 GiB); systemd 240 and newer raise it to 9223372036854775807 at boot.',
    kernelMin: 65536,
    kernelMax: 4294967296,
    step: 65536,
    unit: 'files',
  },
  {
    key: 'nr_open',
    title: 'Highest open-file limit',
    tier: 'essential',
    sysctlName: 'fs.nr_open',
    group: 'descriptors',
    control: 'slider',
    shortDesc: 'The highest open-file limit (RLIMIT_NOFILE) any process may be given.',
    longDesc: {
      what: [
        'Each process has an open-file limit, set by systemd\'s LimitNOFILE= for services and by ulimit -n in a shell. fs.nr_open caps that limit: nothing can raise its hard limit above it, root included. It costs nothing until a process actually opens that many files.',
      ],
      watch: [
        'A unit asking for more with LimitNOFILE= gets its limit cut down to fs.nr_open. But when fs.nr_open is below the limit systemd itself runs with, such units fail to start with status 205 instead, and below 1048576 that includes systemd\'s default of 524288. So it is never offered below the kernel default 1048576, and at 1048576 it is left out of the file.',
        'Leaving it out matters because distributions differ: Debian 13 and Fedora raise it at boot, to 1073741816 and 2147483584, and systemd runs with that value; Ubuntu 24.04 keeps 1048576. A smaller value written there makes units that ask for more than it stop starting. LimitNOFILE=infinity takes the value systemd read when it started or last re-executed.',
      ],
    },
    tuningTip: 'Leave it at 1048576 unless a service needs a LimitNOFILE above that.',
    kernelDocsUrl: `${FS_DOCS}#nr-open`,
    k8sNote: null,
    kernelDefault: NR_OPEN_DEFAULT,
    kernelDefaultNote: 'Debian 13 starts at 1073741816 and Fedora at 2147483584, raised by systemd at boot.',
    kernelMin: NR_OPEN_DEFAULT,
    kernelMax: NR_OPEN_MAX,
    step: 1048576,
    unit: 'files',
  },
  // ── inotify ───────────────────────────────────────────────────────────────
  {
    key: 'max_user_watches',
    title: 'inotify watches per user',
    tier: 'essential',
    sysctlName: 'fs.inotify.max_user_watches',
    group: 'inotify',
    control: 'slider',
    shortDesc: 'How many files and directories each user may watch for changes with inotify.',
    longDesc: {
      what: [
        'File watchers use one inotify watch per directory (or file) they follow: IDEs such as VS Code and JetBrains, webpack and other dev servers, Syncthing and Dropbox, and on Kubernetes nodes the kubelet and log shippers. When a user runs out, they fail with "ENOSPC: System limit for number of file watchers reached" even though the disk has space.',
      ],
      watch: [
        'The limit is per user ID, and each watch in use pins kernel memory that can\'t be swapped, about 1.3 KiB with the inode it holds. Kernel 5.11 and newer, and recent 5.10 updates, size the default from RAM: as many watches as fit in 1% of it, between 8192 and 1048576 (about 15000 at 2 GiB). Older kernels use 8192.',
      ],
    },
    tuningTip: 'Use 524288 on desktops and container hosts; the warning shows the worst-case memory.',
    kernelDocsUrl: INOTIFY_MAN,
    k8sNote: 'kind and the EKS node images raise it to 524288 so pods that watch files keep working.',
    kernelDefault: 8192,
    kernelDefaultNote: 'On 5.11 and newer it scales with RAM, from 8192 up to 1048576.',
    kernelMin: 8192,
    kernelMax: 4194304,
    step: 1024,
    unit: 'count',
  },
  {
    key: 'max_user_instances',
    title: 'inotify instances per user',
    tier: 'advanced',
    sysctlName: 'fs.inotify.max_user_instances',
    group: 'inotify',
    control: 'slider',
    shortDesc: 'How many inotify instances each user may create.',
    longDesc: {
      what: [
        'Every program that watches files opens at least one inotify instance, and each holds its own set of watches. systemd, editors, browsers and every container that tails its logs use some, so a busy desktop or a node with many pods passes the default of 128 and new watchers fail with "Too many open files".',
        'The limit is per user ID, and an idle instance costs little memory. Ubuntu 18.04 already raised it to 1024 for LXD.',
      ],
    },
    tuningTip: 'Use 1024 on desktops and 8192 on container hosts.',
    kernelDocsUrl: INOTIFY_MAN,
    k8sNote: 'Container hosts raise it to 8192 (the EKS node images do), since every pod that watches files needs its own instances.',
    kernelDefault: 128,
    kernelMin: 128,
    kernelMax: 65536,
    step: 128,
    unit: 'count',
  },
  {
    key: 'max_queued_events',
    title: 'inotify event queue',
    tier: 'advanced',
    sysctlName: 'fs.inotify.max_queued_events',
    group: 'inotify',
    control: 'slider',
    shortDesc: 'How many change events may wait in one inotify instance before they are dropped.',
    longDesc: {
      what: [
        'Events queue in the instance until the program reads them. When the queue is full, the kernel drops further events and sends IN_Q_OVERFLOW, and the program has to rescan everything it watches to catch up. A checkout of a large repository or a bulk copy can produce events faster than a watcher reads them.',
        'Queued events take a little kernel memory each, only while they wait.',
      ],
    },
    tuningTip: 'Raise it to 65536 or more where file sync or build tools watch large trees.',
    kernelDocsUrl: INOTIFY_MAN,
    k8sNote: null,
    kernelDefault: 16384,
    kernelMin: 16384,
    kernelMax: 1048576,
    step: 16384,
    unit: 'count',
  },
  // ── Asynchronous I/O ──────────────────────────────────────────────────────
  {
    key: 'aio_max_nr',
    title: 'Async I/O requests',
    tier: 'essential',
    sysctlName: 'fs.aio-max-nr',
    group: 'aio',
    control: 'slider',
    shortDesc: 'How many native asynchronous I/O requests all processes together may set up.',
    longDesc: {
      what: [
        'Programs that use Linux native AIO reserve request slots with io_setup(), and fs.aio-nr counts how many are reserved. When the total would pass this limit, io_setup() fails with EAGAIN. MySQL and MariaDB with InnoDB, ScyllaDB and Oracle Database use native AIO, and several instances on one host, or one instance with many disks, pass the default of 65536.',
        'io_uring doesn\'t count against this limit, and neither do ordinary reads and writes.',
      ],
    },
    tuningTip: 'Use 1048576 on database hosts; leave the default elsewhere.',
    kernelDocsUrl: `${FS_DOCS}#aio-nr-aio-max-nr`,
    k8sNote: null,
    kernelDefault: 65536,
    kernelMin: 65536,
    kernelMax: 67108864,
    step: 65536,
    unit: 'count',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
