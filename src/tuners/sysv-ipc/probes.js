/**
 * What the System V IPC guide (learn.js) measures on each VM image: every
 * setting it explains and the kernel files its figures name. Plain data in
 * the frozen probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture`
 * and by the guide contract suite. Ids are prefixed `sysv-ipc.`.
 */

export const PROBES = {
  // The six settings, one per def.
  'sysv-ipc.shmmni': { kind: 'sysctl', name: 'kernel.shmmni' },
  'sysv-ipc.shmRmidForced': { kind: 'sysctl', name: 'kernel.shm_rmid_forced' },
  'sysv-ipc.sem': { kind: 'sysctl', name: 'kernel.sem' },
  'sysv-ipc.msgmni': { kind: 'sysctl', name: 'kernel.msgmni' },
  'sysv-ipc.msgmax': { kind: 'sysctl', name: 'kernel.msgmax' },
  'sysv-ipc.msgmnb': { kind: 'sysctl', name: 'kernel.msgmnb' },

  // The two shared memory limits the tuner does not offer, shown as the kernel sets them.
  'sysv-ipc.shmmax': { kind: 'sysctl', name: 'kernel.shmmax' },
  'sysv-ipc.shmall': { kind: 'sysctl', name: 'kernel.shmall' },

  // The lists of objects that exist, which the figures name.
  'sysv-ipc.sysvipcShm': { kind: 'file', path: '/proc/sysvipc/shm', exists: true },
  'sysv-ipc.sysvipcSem': { kind: 'file', path: '/proc/sysvipc/sem', exists: true },
  'sysv-ipc.sysvipcMsg': { kind: 'file', path: '/proc/sysvipc/msg', exists: true },
}
