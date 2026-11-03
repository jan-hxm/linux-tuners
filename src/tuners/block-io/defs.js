/**
 * Static metadata for every block queue attribute the block I/O tuner
 * exposes. Each is a file under /sys/block/<dev>/queue/, written per device
 * by a udev rule (`udevAttr`). Defs are listed in the order the rules have to
 * run: rotational before the scheduler (BFQ reads it when it starts), the
 * scheduler before nr_requests (switching the scheduler resets it). What the
 * distributions start with was measured on the VM images (vm/README.md).
 *
 * @typedef {'device' | 'sched' | 'reads'} BlockIoGroup
 *
 * @typedef {Object} BlockIoValues
 * @property {0|1}    rotational     Virtual disks only; left out at 1
 * @property {'none'|'mq-deadline'|'bfq'|'kyber'} scheduler
 * @property {number} nr_requests    0 leaves the kernel's own value
 * @property {number} read_ahead_kb  Left out at 128
 * @property {0|1|2}  nomerges       Left out at 0
 */

const ABI_DOCS = 'https://docs.kernel.org/admin-guide/abi-stable.html'
export const BFQ_DOCS = 'https://docs.kernel.org/block/bfq-iosched.html'

/** The kernel's read-ahead when the device doesn't ask for more. At this value the key is left out. */
export const READ_AHEAD_DEFAULT = 128

/** What nr_requests takes with a scheduler: 4 to 2048 on every kernel measured. */
export const SCHED_REQUESTS_MAX = 2048

export const PARAMETER_DEFS = [
  // ── Device type ───────────────────────────────────────────────────────────
  {
    key: 'rotational',
    title: 'Spinning disk or flash',
    tier: 'essential',
    sysctlName: 'queue/rotational',
    udevAttr: 'queue/rotational',
    group: 'device',
    type: 'bool',
    control: 'toggle',
    toggleLabels: { on: 'rotating: as the hypervisor reports it', off: 'flash: tell the kernel it does not seek' },
    shortDesc: 'Whether the kernel treats the virtual disk as a spinning disk or as flash.',
    longDesc: {
      what: [
        'QEMU reports a virtio disk as rotational, whatever storage is behind it. BFQ reads the flag to decide when idling for one process pays off, and lsblk shows it as ROTA.',
        'Writeback throttling picks its latency target (75 ms rotating, 2 ms flash) when the disk appears, before udev runs, so this rule doesn\'t change it: on every image tested it stayed at 75 ms.',
      ],
      when: [
        'Set it to flash when the host stores the disk on SSDs. At 1, as reported, it is left out of the file.',
      ],
    },
    tuningTip: 'Turn it to flash when the host stores the disk on SSD or NVMe.',
    kernelDocsUrl: `${ABI_DOCS}#abi-sys-block-disk-queue-rotational`,
    desktopNote: null,
    kernelDefault: 1,
    kernelDefaultNote: 'What the device reports: 0 for NVMe and SATA SSDs, 1 for hard disks and, from QEMU, for virtio disks.',
    kernelMin: 0,
    kernelMax: 1,
    step: 1,
    unit: 'bool',
  },
  // ── I/O scheduler ─────────────────────────────────────────────────────────
  {
    key: 'scheduler',
    title: 'I/O scheduler',
    tier: 'essential',
    sysctlName: 'queue/scheduler',
    udevAttr: 'queue/scheduler',
    group: 'sched',
    type: 'enum',
    control: 'select',
    options: [
      { value: 'none', label: 'none: pass requests straight to the device' },
      { value: 'mq-deadline', label: 'mq-deadline: sort by sector, with deadlines' },
      { value: 'bfq', label: 'bfq: fair shares, low latency for interactive use' },
      { value: 'kyber', label: 'kyber: throttle to latency targets' },
    ],
    shortDesc: 'Which I/O scheduler orders the requests before they reach the device.',
    longDesc: {
      what: [
        'none hands requests to the device in the order they arrive. NVMe drives and virtual disks reorder them themselves, so this costs the least CPU time and is the kernel default for devices with several hardware queues.',
        'mq-deadline sorts requests by sector, so a hard disk seeks less, and gives each one a deadline so none waits for ever. It is the kernel default for devices with one hardware queue, SATA and SAS disks.',
        'bfq gives each process a share of the disk and favours interactive ones, so a desktop stays responsive during a large copy. That costs CPU time per request: the BFQ docs measured 250 to 400 thousand requests a second on desktop CPUs, below what a fast NVMe drive does.',
        'kyber throttles requests to meet a read and a write latency target. It is meant for fast multi-queue devices.',
      ],
      watch: [
        'bfq and kyber are kernel modules that some kernels don\'t ship, such as Ubuntu 24.04\'s cloud image; the system profile says whether yours has them.',
      ],
    },
    tuningTip: 'none for NVMe and virtual disks, mq-deadline for servers on SATA, bfq for desktops on SATA.',
    kernelDocsUrl: `${ABI_DOCS}#abi-sys-block-disk-queue-scheduler`,
    desktopNote: 'BFQ gives the programs the user is waiting for the disk first, so the desktop stays responsive while a copy or an update runs.',
    kernelDefault: 'mq-deadline',
    kernelDefaultNote: 'mq-deadline for a device with one hardware queue, none for several (NVMe, virtio with more than one CPU). Debian\'s cloud kernels build mq-deadline as a module and start every disk at none; Fedora sets bfq on SATA disks with a udev rule.',
    kernelMin: 0,
    kernelMax: 0,
    unit: 'enum',
  },
  {
    key: 'nr_requests',
    title: 'Scheduler queue depth',
    tier: 'advanced',
    sysctlName: 'queue/nr_requests',
    udevAttr: 'queue/nr_requests',
    group: 'sched',
    control: 'slider',
    shortDesc: 'How many requests the scheduler may hold per hardware queue.',
    longDesc: {
      what: [
        'A deeper queue lets the scheduler sort and merge more requests, which helps a hard disk under many parallel readers. A shallower one keeps each request\'s wait short. Without a scheduler the limit is the device\'s own queue depth, so it is only offered with one.',
        'When a scheduler is set, the kernel starts it at twice the device\'s queue depth, at most 256: 64 for a SATA disk, 256 for NVMe and virtio. At 0 it is left out of the file and keeps that value. With a scheduler the kernel takes 4 to 2048; switching the scheduler resets it, so this rule comes after the scheduler\'s.',
      ],
    },
    tuningTip: 'Leave it out unless a hard disk serves many parallel streams; then try 1024.',
    kernelDocsUrl: `${ABI_DOCS}#abi-sys-block-disk-queue-nr-requests`,
    desktopNote: null,
    kernelDefault: 0,
    kernelDefaultNote: 'Twice the device\'s queue depth, at most 256, whenever a scheduler is set.',
    kernelMin: 0,
    kernelMax: SCHED_REQUESTS_MAX,
    step: 4,
    unit: 'requests',
  },
  // ── Read-ahead and merging ────────────────────────────────────────────────
  {
    key: 'read_ahead_kb',
    title: 'Read-ahead',
    tier: 'essential',
    sysctlName: 'queue/read_ahead_kb',
    udevAttr: 'queue/read_ahead_kb',
    group: 'reads',
    control: 'slider',
    shortDesc: 'How far ahead the kernel reads when a file is read sequentially.',
    longDesc: {
      what: [
        'When a program reads a file in order, the kernel reads ahead into the [[page cache]] so the next read is already in memory. A larger window keeps a hard disk streaming instead of seeking between readers, and helps backups, media servers and large scans. For random reads it fetches data nobody asked for and pushes useful pages out of the cache.',
        'The kernel default is 128 KiB, more for a device that reports a large optimal I/O size (Fedora 43 started its virtio disks at 8192). At 128 it is left out of the file, so that choice stays. The kernel rounds it down to whole 4 KiB pages.',
      ],
    },
    tuningTip: 'Keep 128 KiB for mixed and random I/O; use 1 to 4 MiB on disks that mostly stream large files.',
    kernelDocsUrl: `${ABI_DOCS}#abi-sys-block-disk-queue-read-ahead-kb`,
    desktopNote: null,
    kernelDefault: READ_AHEAD_DEFAULT,
    kernelDefaultNote: 'Raised by the kernel for a device that reports a large optimal I/O size: Fedora 43 started its virtio disks at 8192.',
    kernelMin: 0,
    kernelMax: 16384,
    step: 4,
    unit: 'KiB',
  },
  {
    key: 'nomerges',
    title: 'Request merging',
    tier: 'advanced',
    sysctlName: 'queue/nomerges',
    udevAttr: 'queue/nomerges',
    group: 'reads',
    control: 'segmented',
    segmentLabels: ['0: all merges', '1: simple only', '2: none'],
    shortDesc: 'Whether the block layer tries to merge adjacent requests into one.',
    longDesc: {
      what: [
        'Merging requests for neighbouring sectors means fewer, larger I/Os, which helps every device with sequential access. For loads known to be random the merge checks always fail and cost CPU time. 1 keeps only the one-shot check against the previous request, 2 turns merging off.',
        'At 0, the kernel default, it is left out of the file.',
      ],
    },
    tuningTip: 'Keep 0; try 1 only on NVMe under purely random I/O at very high request rates.',
    kernelDocsUrl: `${ABI_DOCS}#abi-sys-block-disk-queue-nomerges`,
    desktopNote: null,
    kernelDefault: 0,
    kernelMin: 0,
    kernelMax: 2,
    step: 1,
    unit: 'mode',
  },
]

/** Quick lookup by key. */
export const PARAMETER_DEFS_BY_KEY = Object.fromEntries(PARAMETER_DEFS.map((p) => [p.key, p]))

/** All parameter keys, in display order. */
export const PARAMETER_KEYS = PARAMETER_DEFS.map((p) => p.key)
