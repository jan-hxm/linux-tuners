// Fixture for loadProbes() in scripts/vm-probe-kinds.test.js: one probe of every kind.
export const PROBES = {
  'demo.minFree': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'demo.swaps': { kind: 'file', path: '/proc/swaps', exists: true },
  'demo.thp': { kind: 'sysfs', path: '/sys/kernel/mm/transparent_hugepage/enabled' },
  'demo.ssdRotational': { kind: 'diskQueue', disk: 'ssd', attr: 'rotational' },
  'demo.kswapd': { kind: 'thread', name: 'kswapd0' },
  'demo.zoneWatermarks': { kind: 'zoneinfo' },
  'demo.allocstall': { kind: 'vmstatKeys', prefix: 'allocstall' },
  'demo.tasksMax': { kind: 'systemctl', property: 'DefaultTasksMax' },
  'demo.meminfo': { kind: 'meminfoKeys', keys: ['MemTotal', 'SwapTotal'] },
}
