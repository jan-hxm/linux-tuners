/**
 * What the systemd resources guide (learn.js) measures on each VM image: the
 * cgroup tree systemd builds, the files the slice settings write for
 * system.slice, and the kernel limits the task and file defaults sit under.
 * Plain data in the frozen probe kinds (vm/lib/probeKinds.mjs), read by
 * `npm run vm:capture` and by the guide contract suite. Ids are prefixed
 * `systemd.`.
 *
 * The /sys/fs/cgroup paths are the cgroup v2 layout. On an image that boots
 * the older v1 or hybrid layout (Ubuntu 18.04, systemd 237) they read as
 * absent, which is what the figures should say there.
 *
 * The manager defaults (DefaultTasksMax, the DefaultLimit* pairs and the
 * accounting toggles) are only visible through `systemctl show`, read by
 * the `systemctl` kind. Names are the Manager object's D-Bus properties
 * (org.freedesktop.systemd1(5)). A property an older or newer systemd
 * doesn't export reads as absent: DefaultIOAccounting reaches D-Bus only in
 * 254, and DefaultCPUAccounting is gone from 258, where CPU accounting is
 * always on.
 */

const SLICE = '/sys/fs/cgroup/system.slice'

export const PROBES = {
  // The tree and its counters.
  'systemd.pid1': { kind: 'thread', name: 'systemd' },
  'systemd.controllers': { kind: 'sysfs', path: '/sys/fs/cgroup/cgroup.controllers' },
  'systemd.subtreeControl': { kind: 'sysfs', path: '/sys/fs/cgroup/cgroup.subtree_control' },
  'systemd.v1Layout': { kind: 'file', path: '/sys/fs/cgroup/systemd', exists: true },
  'systemd.systemSlice': { kind: 'file', path: SLICE, exists: true },
  'systemd.userSlice': { kind: 'file', path: '/sys/fs/cgroup/user.slice', exists: true },
  'systemd.initScope': { kind: 'file', path: '/sys/fs/cgroup/init.scope', exists: true },
  'systemd.cpuStat': { kind: 'file', path: `${SLICE}/cpu.stat`, exists: true },
  'systemd.memoryCurrent': { kind: 'sysfs', path: `${SLICE}/memory.current` },

  // What the slice settings write, read back for system.slice.
  'systemd.cpuWeight': { kind: 'sysfs', path: `${SLICE}/cpu.weight` },
  'systemd.cpuMax': { kind: 'sysfs', path: `${SLICE}/cpu.max` },
  'systemd.memoryHigh': { kind: 'sysfs', path: `${SLICE}/memory.high` },
  'systemd.memoryMax': { kind: 'sysfs', path: `${SLICE}/memory.max` },
  'systemd.swapMax': { kind: 'sysfs', path: `${SLICE}/memory.swap.max` },
  'systemd.pidsMax': { kind: 'sysfs', path: `${SLICE}/pids.max` },
  'systemd.pidsCurrent': { kind: 'sysfs', path: `${SLICE}/pids.current` },

  // What splits disk time by weight: the io cost model, and the boot disk's scheduler.
  'systemd.ioCostQos': { kind: 'file', path: '/sys/fs/cgroup/io.cost.qos', exists: true },
  'systemd.bootDiskScheduler': { kind: 'sysfs', path: '/sys/block/vda/queue/scheduler' },

  // The kernel limits the task and file defaults sit under.
  'systemd.pidMax': { kind: 'sysctl', name: 'kernel.pid_max' },
  'systemd.threadsMax': { kind: 'sysctl', name: 'kernel.threads-max' },
  'systemd.nrOpen': { kind: 'sysctl', name: 'fs.nr_open' },

  // The manager defaults every service starts from, and system.slice's own task limit.
  'systemd.defaultTasksMax': { kind: 'systemctl', property: 'DefaultTasksMax' },
  'systemd.defaultLimitNofile': { kind: 'systemctl', property: 'DefaultLimitNOFILE' },
  'systemd.defaultLimitNofileSoft': { kind: 'systemctl', property: 'DefaultLimitNOFILESoft' },
  'systemd.defaultLimitMemlock': { kind: 'systemctl', property: 'DefaultLimitMEMLOCK' },
  'systemd.defaultLimitMemlockSoft': { kind: 'systemctl', property: 'DefaultLimitMEMLOCKSoft' },
  'systemd.defaultMemoryAccounting': { kind: 'systemctl', property: 'DefaultMemoryAccounting' },
  'systemd.defaultTasksAccounting': { kind: 'systemctl', property: 'DefaultTasksAccounting' },
  'systemd.defaultIoAccounting': { kind: 'systemctl', property: 'DefaultIOAccounting' },
  'systemd.defaultIpAccounting': { kind: 'systemctl', property: 'DefaultIPAccounting' },
  'systemd.defaultCpuAccounting': { kind: 'systemctl', property: 'DefaultCPUAccounting' },
  'systemd.systemSliceTasksMax': { kind: 'systemctl', property: 'TasksMax', unit: 'system.slice' },
}
