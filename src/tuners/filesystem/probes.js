/**
 * What the file limits guide (learn.js) measures on each VM image: every
 * setting it explains and the parts its figures name. Plain data in the
 * frozen probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture`
 * and by the guide contract suite. Ids are prefixed `filesystem.`.
 */

export const PROBES = {
  // The six settings, one per def.
  'filesystem.fileMax': { kind: 'sysctl', name: 'fs.file-max' },
  'filesystem.nrOpen': { kind: 'sysctl', name: 'fs.nr_open' },
  'filesystem.maxUserWatches': { kind: 'sysctl', name: 'fs.inotify.max_user_watches' },
  'filesystem.maxUserInstances': { kind: 'sysctl', name: 'fs.inotify.max_user_instances' },
  'filesystem.maxQueuedEvents': { kind: 'sysctl', name: 'fs.inotify.max_queued_events' },
  'filesystem.aioMaxNr': { kind: 'sysctl', name: 'fs.aio-max-nr' },

  // The parts the figures name.
  'filesystem.fileNr': { kind: 'file', path: '/proc/sys/fs/file-nr', exists: true },
  'filesystem.inotifyDir': { kind: 'file', path: '/proc/sys/fs/inotify', exists: true },
  'filesystem.aioNr': { kind: 'sysctl', name: 'fs.aio-nr' },
}
