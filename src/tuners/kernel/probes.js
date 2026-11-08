/**
 * What the kernel limits guide (learn.js) measures on each VM image: every
 * setting it explains and the real parts its figures name. Plain data in the
 * frozen probe kinds (vm/lib/probeKinds.mjs), read by `npm run vm:capture` and
 * by the guide contract suite. Ids are prefixed `kernel.`.
 */

export const PROBES = {
  // The nine settings, one per def.
  'kernel.pidMax': { kind: 'sysctl', name: 'kernel.pid_max' },
  'kernel.threadsMax': { kind: 'sysctl', name: 'kernel.threads-max' },
  'kernel.maxkeys': { kind: 'sysctl', name: 'kernel.keys.maxkeys' },
  'kernel.maxbytes': { kind: 'sysctl', name: 'kernel.keys.maxbytes' },
  'kernel.panic': { kind: 'sysctl', name: 'kernel.panic' },
  'kernel.panicOnOops': { kind: 'sysctl', name: 'kernel.panic_on_oops' },
  'kernel.softlockupPanic': { kind: 'sysctl', name: 'kernel.softlockup_panic' },
  'kernel.sysrq': { kind: 'sysctl', name: 'kernel.sysrq' },
  'kernel.printk': { kind: 'sysctl', name: 'kernel.printk' },

  // The parts the figures name.
  'kernel.rootMaxkeys': { kind: 'sysctl', name: 'kernel.keys.root_maxkeys' },
  'kernel.rootMaxbytes': { kind: 'sysctl', name: 'kernel.keys.root_maxbytes' },
  'kernel.watchdogThresh': { kind: 'sysctl', name: 'kernel.watchdog_thresh' },
  'kernel.keyUsers': { kind: 'file', path: '/proc/key-users', exists: true },
  'kernel.sysrqTrigger': { kind: 'file', path: '/proc/sysrq-trigger', exists: true },
}
