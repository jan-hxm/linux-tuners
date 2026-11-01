/**
 * Built-in presets. Each is a partial KernelValues: keys it doesn't name keep
 * the profile's starting value (store.applyPreset). Every value must work on
 * every profile; the contract suite checks that. kernel.sysrq and
 * kernel.printk are in neither, since distributions start them differently.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').KernelValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'The kernel\'s own panic behaviour and key quotas: a crash stops the machine until someone resets it, and an oops only kills the task that hit it. SysRq and the console loglevel keep the profile\'s values, since distributions set them differently.',
    source: 'docs.kernel.org admin-guide/sysctl/kernel, security/keys/core',
    values: {
      maxkeys: 200,
      maxbytes: 20000,
      panic: 0,
      panic_on_oops: 0,
      softlockup_panic: 0,
    },
  },
  {
    id: 'reboot-on-failure',
    label: 'Reboot on any kernel failure',
    description: 'Panic on an oops and on a soft lockup, and reboot 10 seconds after any panic, for cluster nodes where a fresh boot beats a machine running in an unknown state. Not for VMs on overcommitted hosts.',
    source: 'docs.kernel.org admin-guide/sysctl/kernel',
    values: {
      panic: 10,
      panic_on_oops: 1,
      softlockup_panic: 1,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
