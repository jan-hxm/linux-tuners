/**
 * Fixture probes for the demo guide (demo.learn.js), in the shape of a
 * tuner's probes.js: plain data, no imports. One probe per kind, so the
 * figure components and the evidence checks see each shape. The values the
 * fixture evidence files hold for them are made up (round numbers).
 */
export const PROBES = {
  'demo.watermarks': { kind: 'zoneinfo' },
  'demo.worker': { kind: 'thread', name: 'kswapd0' },
  'demo.stalls': { kind: 'vmstatKeys', prefix: 'allocstall' },
  'demo.reserve': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'demo.swaps': { kind: 'file', path: '/proc/swaps', exists: true },
  'demo.meminfo': { kind: 'meminfoKeys', keys: ['MemTotal', 'AnonPages', 'Cached', 'SwapTotal'] },
  'demo.zram': { kind: 'file', path: '/sys/block/zram0', exists: true },
  // Figures v3: a string of three numbers read by index, limits, cgroup weights, modes and disks.
  'demo.bufSizes': { kind: 'sysctl', name: 'net.ipv4.tcp_rmem' },
  'demo.bufMax': { kind: 'sysctl', name: 'net.core.rmem_max' },
  'demo.bufTotal': { kind: 'sysctl', name: 'net.core.optmem_max' },
  'demo.sliceWeight': { kind: 'sysfs', path: '/sys/fs/cgroup/system.slice/cpu.weight' },
  'demo.userWeight': { kind: 'sysfs', path: '/sys/fs/cgroup/user.slice/cpu.weight' },
  'demo.pageMode': { kind: 'sysfs', path: '/sys/kernel/mm/transparent_hugepage/enabled' },
  'demo.keyMask': { kind: 'sysctl', name: 'kernel.sysrq' },
  'demo.schedSsd': { kind: 'diskQueue', disk: 'ssd', attr: 'scheduler' },
  'demo.schedHdd': { kind: 'diskQueue', disk: 'hdd', attr: 'scheduler' },
}
