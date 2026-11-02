/**
 * Generate the udev rules file for one kind of disk. Pure function over
 * (hardware, params, presetLabel). Each rule matches every disk of the
 * profile's kind and writes one queue attribute, on boot, on hotplug and on
 * `udevadm trigger`.
 */

import { PARAMETER_DEFS } from './defs.js'
import { PROFILE } from './profile.js'
import { isEmitted } from './calculations.js'
import { configFile } from '@/core/output/files.js'
import { isoDate, presetSummary, rule } from '@/core/output/comments.js'
import { undoComment } from '@/core/output/installSteps.js'
import { udevConfig } from '@/core/output/udevRules.js'

const BLOCK_DISK = [['ACTION', 'add|change'], ['SUBSYSTEM', 'block']]

/**
 * Per device class: the file (a constant, never built from state), what the
 * rules match, and what the comments call the disks. `ENV{DEVTYPE}=="disk"`
 * leaves out partitions, which have no queue of their own.
 */
export const DEVICES = {
  nvme: {
    path: '/etc/udev/rules.d/99-block-tuning-nvme.rules',
    match: [...BLOCK_DISK, ['KERNEL', 'nvme[0-9]*n[0-9]*'], ['ENV{DEVTYPE}', 'disk']],
    disks: 'NVMe namespace (nvme0n1, nvme1n1, ...)',
  },
  ssd: {
    path: '/etc/udev/rules.d/99-block-tuning-ssd.rules',
    match: [...BLOCK_DISK, ['KERNEL', 'sd[a-z]*'], ['ENV{DEVTYPE}', 'disk'], ['ATTR{queue/rotational}', '0']],
    disks: 'SATA or SAS SSD (sd*, ROTA 0)',
  },
  hdd: {
    path: '/etc/udev/rules.d/99-block-tuning-hdd.rules',
    match: [...BLOCK_DISK, ['KERNEL', 'sd[a-z]*'], ['ENV{DEVTYPE}', 'disk'], ['ATTR{queue/rotational}', '1']],
    disks: 'SATA or SAS hard disk (sd*, ROTA 1)',
  },
  virtio: {
    path: '/etc/udev/rules.d/99-block-tuning-virtio.rules',
    match: [...BLOCK_DISK, ['KERNEL', 'vd[a-z]*'], ['ENV{DEVTYPE}', 'disk']],
    disks: 'virtio disk (vda, vdb, ...)',
  },
}

const SECTIONS = [
  { id: 'device', title: 'Device type' },
  { id: 'sched', title: 'I/O scheduler' },
  { id: 'reads', title: 'Read-ahead & merging' },
]

/**
 * @param {Object} opts
 * @param {import('./profile.js').BlockIoSpec} opts.hardware
 * @param {import('./defs.js').BlockIoValues} opts.params
 * @param {string|null} [opts.presetLabel]
 * @param {boolean}     [opts.customised]
 * @param {Date}        [opts.now]
 * @returns {import('@/core/output/files.js').ConfigFile[]}
 */
export function generateConfig({ hardware, params, presetLabel, customised, now }) {
  if (!Object.hasOwn(DEVICES, hardware.device)) throw new Error(`Unknown device class "${hardware.device}"`)
  const device = DEVICES[hardware.device]
  const lines = []

  lines.push(rule())
  lines.push('# Linux block I/O queue settings, as udev rules')
  lines.push(`# Generated ${isoDate(now)} by linux-tuners.dev/block-io`)
  lines.push(`# System: ${describeSystem(hardware)}`)
  lines.push(`# Profile: ${presetSummary(presetLabel, customised)}`)
  lines.push(rule())
  lines.push('#')
  lines.push(`# The rules below apply to every ${device.disks},`)
  lines.push('# at boot, when one is plugged in, and when the rules are triggered.')
  lines.push('#')
  lines.push('# HOW TO APPLY THESE SETTINGS')
  lines.push('#')
  lines.push('# 1. Persist them. Save this whole file as a rules file:')
  lines.push(`#      sudo nano ${device.path}   # then paste this file`)
  lines.push('#')
  lines.push('# 2. Apply them now, without rebooting:')
  lines.push('#      sudo udevadm control --reload')
  lines.push('#      sudo udevadm trigger --action=change --subsystem-match=block')
  lines.push('#      sudo udevadm settle')
  lines.push('#')
  lines.push('# 3. Verify they took effect, and that udev wrote every value:')
  lines.push('#      lsblk -d -o NAME,ROTA,SCHED,RQ-SIZE,RA')
  lines.push('#      journalctl -b -u systemd-udevd | grep "Failed to write"')
  lines.push('#')
  lines.push(...undoComment([device.path]), '#')
  lines.push(...noteBlock(hardware, params))
  lines.push('# Sources:')
  lines.push('#   queue attributes: https://docs.kernel.org/admin-guide/abi-stable.html')
  lines.push('#   BFQ:              https://docs.kernel.org/block/bfq-iosched.html')
  lines.push('#   udev rules:       https://www.freedesktop.org/software/systemd/man/latest/udev.html')
  lines.push('')

  lines.push(...udevConfig({
    defs: PARAMETER_DEFS,
    sections: SECTIONS,
    params,
    match: device.match,
    comment: (def, value) => commentFor(def, value),
    include: (def) => isEmitted(def.key, hardware, params),
  }))

  return [configFile(device.path, lines)]
}

/** What the output leaves out, what overrides it, and what the kernel may refuse. */
function noteBlock(hw, params) {
  const groups = []
  groups.push([
    '# udev writes each value when the rule runs. A value the kernel refuses,',
    '# such as a scheduler it lacks, is logged ("Failed to write") and',
    '# skipped; the rest still apply.',
  ])
  if (hw.device === 'ssd' || hw.device === 'hdd') {
    groups.push([
      '# Fedora\'s systemd sets bfq on every sd* disk (60-block-scheduler.rules).',
      '# This file sorts after it, so its scheduler wins.',
      '#',
      '# Kernels before 5.0 may run SATA disks on the legacy block layer, whose',
      '# schedulers are noop, deadline and cfq; there the scheduler rule fails.',
    ])
  }
  if (!isEmitted('nr_requests', hw, params)) {
    groups.push([
      '# queue/nr_requests is left out, so it keeps the value the kernel sets',
      '# with the scheduler: twice the queue depth, at most 256.',
    ])
  } else {
    groups.push([
      '# Switching the scheduler resets queue/nr_requests, so its rule comes',
      '# after the scheduler\'s, and another rules file that sets the scheduler',
      '# later resets it again.',
    ])
  }
  if (!isEmitted('read_ahead_kb', hw, params)) {
    groups.push([
      '# queue/read_ahead_kb is left out at 128 KiB, so a device the kernel',
      '# starts higher keeps its value (Fedora 43 starts virtio disks at 8192).',
    ])
  }
  return ['# NOTES', '#', ...groups.flatMap((g, i) => (i ? ['#', ...g] : g)), '#', rule(), '#']
}

/** @param {import('./profile.js').BlockIoSpec} hw */
function describeSystem(hw) {
  const label = (key) => PROFILE.fields.find((f) => f.key === key).options.find((o) => o.value === hw[key]).label
  return `${label('device')}, ${label('workload').split(':')[0]}, ${hw.schedulers === 'all' ? 'BFQ and Kyber available' : 'mq-deadline only'}`
}

/**
 * The inline comment for each value in the output.
 *
 * @param {Object} def
 * @param {number|string} value
 */
function commentFor(def, value) {
  switch (def.key) {
    case 'rotational':
      return 'treat the disk as flash'
    case 'scheduler':
      return value === 'none' ? 'no scheduler: the device orders requests' : 'the I/O scheduler'
    case 'nr_requests':
      return 'requests the scheduler may hold per hardware queue'
    case 'read_ahead_kb':
      return 'KiB read ahead on sequential reads'
    case 'nomerges':
      return value === 2 ? 'no request merging' : 'only one-shot merges with the previous request'
    default:
      return ''
  }
}
