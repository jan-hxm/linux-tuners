/**
 * What the memory guide (learn.js) measures on each VM image: every setting it
 * explains and every real part its figures name. Plain data in the frozen
 * probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and by the
 * guide contract suite. Ids are prefixed `swap.`.
 */

export const PROBES = {
  // The twelve settings, one per def.
  'swap.swappiness': { kind: 'sysctl', name: 'vm.swappiness' },
  'swap.vfsCachePressure': { kind: 'sysctl', name: 'vm.vfs_cache_pressure' },
  'swap.minFree': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'swap.watermarkScale': { kind: 'sysctl', name: 'vm.watermark_scale_factor' },
  'swap.pageCluster': { kind: 'sysctl', name: 'vm.page-cluster' },
  'swap.dirtyBackgroundRatio': { kind: 'sysctl', name: 'vm.dirty_background_ratio' },
  'swap.dirtyRatio': { kind: 'sysctl', name: 'vm.dirty_ratio' },
  'swap.dirtyExpire': { kind: 'sysctl', name: 'vm.dirty_expire_centisecs' },
  'swap.dirtyWriteback': { kind: 'sysctl', name: 'vm.dirty_writeback_centisecs' },
  'swap.overcommitMemory': { kind: 'sysctl', name: 'vm.overcommit_memory' },
  'swap.overcommitRatio': { kind: 'sysctl', name: 'vm.overcommit_ratio' },
  'swap.panicOnOom': { kind: 'sysctl', name: 'vm.panic_on_oom' },

  // The parts the figures name.
  'swap.vmSysctls': { kind: 'file', path: '/proc/sys/vm', exists: true },
  'swap.kswapd': { kind: 'thread', name: 'kswapd0' },
  'swap.zoneWatermarks': { kind: 'zoneinfo' },
  'swap.allocstall': { kind: 'vmstatKeys', prefix: 'allocstall' },
  'swap.swapIns': { kind: 'vmstatKeys', prefix: 'pswpin' },
  'swap.swapReadahead': { kind: 'vmstatKeys', prefix: 'swap_ra' },
  'swap.swaps': { kind: 'file', path: '/proc/swaps', exists: true },
  'swap.dentryState': { kind: 'file', path: '/proc/sys/fs/dentry-state', exists: true },
  'swap.memSize': { kind: 'meminfoKeys', keys: ['MemTotal', 'SwapTotal'] },
  'swap.memAnon': { kind: 'meminfoKeys', keys: ['AnonPages'] },
  'swap.memCache': { kind: 'meminfoKeys', keys: ['Cached'] },
  'swap.memDirty': { kind: 'meminfoKeys', keys: ['Dirty', 'Writeback'] },
  'swap.memCommit': { kind: 'meminfoKeys', keys: ['CommitLimit', 'Committed_AS'] },
}
