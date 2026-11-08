/**
 * What the huge pages guide (learn.js) measures on each VM image: every
 * setting it explains and every real part its figures name. Plain data in the
 * frozen probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and
 * by the guide contract suite. Ids are prefixed `hugepages.`.
 */

const THP = '/sys/kernel/mm/transparent_hugepage'
const KSM = '/sys/kernel/mm/ksm'

export const PROBES = {
  // The nine settings, one per def.
  'hugepages.poolPages': { kind: 'sysctl', name: 'vm.nr_hugepages' },
  'hugepages.surplusPages': { kind: 'sysctl', name: 'vm.nr_overcommit_hugepages' },
  'hugepages.thpEnabled': { kind: 'sysfs', path: `${THP}/enabled` },
  'hugepages.thpDefrag': { kind: 'sysfs', path: `${THP}/defrag` },
  'hugepages.ksmRun': { kind: 'sysfs', path: `${KSM}/run` },
  'hugepages.ksmPagesToScan': { kind: 'sysfs', path: `${KSM}/pages_to_scan` },
  'hugepages.ksmSleep': { kind: 'sysfs', path: `${KSM}/sleep_millisecs` },
  'hugepages.mapCount': { kind: 'sysctl', name: 'vm.max_map_count' },
  'hugepages.zoneReclaim': { kind: 'sysctl', name: 'vm.zone_reclaim_mode' },

  // The parts the figures name.
  'hugepages.vmSysctls': { kind: 'file', path: '/proc/sys/vm', exists: true },
  'hugepages.poolMeminfo': { kind: 'meminfoKeys', keys: ['HugePages_Total', 'HugePages_Free', 'HugePages_Rsvd', 'HugePages_Surp', 'Hugepagesize'] },
  'hugepages.memTotal': { kind: 'meminfoKeys', keys: ['MemTotal'] },
  'hugepages.thpMeminfo': { kind: 'meminfoKeys', keys: ['AnonHugePages'] },
  'hugepages.khugepagedDir': { kind: 'file', path: `${THP}/khugepaged`, exists: true },
  'hugepages.compactStall': { kind: 'vmstatKeys', prefix: 'compact_stall' },
  'hugepages.kcompactd': { kind: 'thread', name: 'kcompactd0' },
  'hugepages.minFree': { kind: 'sysctl', name: 'vm.min_free_kbytes' },
  'hugepages.ksmShared': { kind: 'sysfs', path: `${KSM}/pages_shared` },
  'hugepages.ksmSharing': { kind: 'sysfs', path: `${KSM}/pages_sharing` },
  'hugepages.numaNode0': { kind: 'file', path: '/sys/devices/system/node/node0', exists: true },
}
