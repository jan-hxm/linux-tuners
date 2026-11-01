/**
 * Block I/O tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Block I/O & storage',
  intro:
    'Pick the I/O scheduler, the request depth, the read-ahead window and request merging for one kind of disk. Starting values follow from the disk and what it does; copy the result into `/etc/udev/rules.d/`, where it applies to every disk of that kind at boot and on hotplug.',
  profileStep: {
    id: 'disk',
    label: 'Disk',
    title: 'Your disks',
    subtitle: 'One file per kind of disk: generate it again for each kind the machine has.',
  },
  tuneSubtitle: 'Each card says what the attribute changes and when the kernel already picks well.',
  exportStep: {
    title: 'Copy your rules',
    subtitle: 'Drop this into /etc/udev/rules.d/, then reload and trigger udev as the file says.',
  },
  adSlot: 'swap',
}

export const ABOUT = {
  heading: 'About this tuner',
  intro: [],
  sections: [
    {
      title: 'Methodology',
      blocks: [
        { p: 'Each attribute was read at boot, written across its range and set through these rules, by `udevadm trigger` and at boot, on Debian 11 and 13, Ubuntu 24.04 and Fedora 43, with an NVMe drive, a SATA SSD, a SATA hard disk and virtio disks attached. The scheduler and read-ahead starting values are opinions: none where the device orders requests itself, mq-deadline for SATA servers, BFQ for SATA desktops.' },
        {
          ul: [
            'With a scheduler, `nr_requests` took 4 to 2048 on every kernel (lower values became 4). Without one, the ceiling was the device\'s queue depth: 32 for SATA, 256 for virtio, 1023 for NVMe. Switching the scheduler reset it to twice the queue depth, at most 256.',
            'Writing `bfq` or `kyber` loaded the module on Debian; Fedora builds both in. Ubuntu 24.04\'s cloud image has neither, and udev logged the failed write and went on with the next rule.',
            'Debian\'s cloud kernels build mq-deadline as a module, so every disk, SATA included, started at none. Fedora\'s systemd sets bfq on every sd* disk with a udev rule.',
            '`read_ahead_kb` took any value up to 4294967292, rounded down to whole 4 KiB pages. Fedora 43\'s kernel started its virtio disks at 8192, the others at 128.',
            'Ubuntu 18.04\'s kernel 4.15 still runs SATA disks on the legacy block layer (noop, deadline, cfq) and has no multi-queue schedulers in its cloud image, so this tuner targets kernel 5.0 and newer.',
          ],
        },
      ],
    },
    {
      title: 'What is not here',
      blocks: [
        {
          ul: [
            'The legacy schedulers (cfq, deadline, noop) and their tunables were removed in kernel 5.0.',
            'BFQ\'s and Kyber\'s own tunables (`slice_idle`, `low_latency`, `read_lat_nsec`) live under `queue/iosched/`, which exists only while that scheduler is active; their defaults are the authors\' tuned starting points.',
            'Per-disk rules by serial number or path: these rules apply to every disk of a kind. A machine with two kinds of disk gets one file for each.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[Kernel ABI: /sys/block/<disk>/queue](https://docs.kernel.org/admin-guide/abi-stable.html#abi-sys-block-disk-queue-scheduler)',
            '[BFQ (Budget Fair Queueing)](https://docs.kernel.org/block/bfq-iosched.html)',
            '[Kyber I/O scheduler tunables](https://docs.kernel.org/block/kyber-iosched.html)',
            '[udev rules (systemd)](https://www.freedesktop.org/software/systemd/man/latest/udev.html)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'These are starting points, not guarantees. The best scheduler depends on the device\'s firmware and on what runs at the same time; measure with your own workload (fio, or the application\'s own latency figures) before and after, and apply the file on one machine first.' },
      ],
    },
  ],
}
