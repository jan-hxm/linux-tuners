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
  'demo.meminfo': { kind: 'meminfoKeys', keys: ['Cached', 'SwapTotal'] },
  'demo.zram': { kind: 'file', path: '/sys/block/zram0', exists: true },
}
