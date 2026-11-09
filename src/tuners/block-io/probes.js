/**
 * What the disk I/O guide (learn.js) measures on each VM image: the five
 * queue attributes it explains, on each kind of disk the capture guest has,
 * and the parts its figures name. Plain data in the frozen probe kinds
 * (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and by the guide
 * contract suite. Ids are prefixed `block-io.`.
 *
 * The guest's disks (GUEST.disks in vm/lib/probeKinds.mjs) appear as
 * nvme0n1 (NVMe), sda (SATA SSD, rotation_rate=1), sdb (SATA hard disk,
 * rotation_rate=7200) and vda (the virtio root disk). A cloud kernel without
 * AHCI has no sda or sdb (Debian 11), so those probes read as absent there;
 * the rotational probes tell the SSD from the hard disk on every capture.
 */

const queue = (dev, attr) => ({ kind: 'sysfs', path: `/sys/block/${dev}/queue/${attr}` })

export const PROBES = {
  // queue/rotational
  'block-io.nvmeRotational': queue('nvme0n1', 'rotational'),
  'block-io.ssdRotational': queue('sda', 'rotational'),
  'block-io.hddRotational': queue('sdb', 'rotational'),
  'block-io.virtioRotational': queue('vda', 'rotational'),

  // queue/scheduler (the bracketed, active one)
  'block-io.nvmeScheduler': queue('nvme0n1', 'scheduler'),
  'block-io.ssdScheduler': queue('sda', 'scheduler'),
  'block-io.hddScheduler': queue('sdb', 'scheduler'),
  'block-io.virtioScheduler': queue('vda', 'scheduler'),

  // queue/nr_requests
  'block-io.nvmeRequests': queue('nvme0n1', 'nr_requests'),
  'block-io.ssdRequests': queue('sda', 'nr_requests'),
  'block-io.hddRequests': queue('sdb', 'nr_requests'),
  'block-io.virtioRequests': queue('vda', 'nr_requests'),

  // queue/read_ahead_kb
  'block-io.nvmeReadAhead': queue('nvme0n1', 'read_ahead_kb'),
  'block-io.ssdReadAhead': queue('sda', 'read_ahead_kb'),
  'block-io.hddReadAhead': queue('sdb', 'read_ahead_kb'),
  'block-io.virtioReadAhead': queue('vda', 'read_ahead_kb'),

  // queue/nomerges
  'block-io.nvmeNomerges': queue('nvme0n1', 'nomerges'),
  'block-io.ssdNomerges': queue('sda', 'nomerges'),
  'block-io.hddNomerges': queue('sdb', 'nomerges'),
  'block-io.virtioNomerges': queue('vda', 'nomerges'),

  // The parts the figures name.
  'block-io.sysBlock': { kind: 'file', path: '/sys/block', exists: true },
  'block-io.udevd': { kind: 'thread', name: 'systemd-udevd' },
}
