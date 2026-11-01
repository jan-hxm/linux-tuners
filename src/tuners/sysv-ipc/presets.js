/**
 * Built-in presets. Each is a partial IpcValues: keys it doesn't name keep
 * the profile's starting value (store.applyPreset). Every value must work on
 * every profile; the contract suite checks that.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').IpcValues>} values
 */

import { IPC_ID_MAX, SEM_DEFAULT } from './defs.js'

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'Every key back at the default the kernel has used since 3.19. Writing these undoes lower values another file or an old installation guide set.',
    source: 'docs.kernel.org admin-guide/sysctl/kernel, proc_sys_kernel(5)',
    values: {
      shmmni: 4096,
      shm_rmid_forced: 0,
      sem: [...SEM_DEFAULT],
      msgmni: 32000,
      msgmax: 8192,
      msgmnb: 16384,
    },
  },
  {
    id: 'most-ids',
    label: 'Most IPC objects',
    description: 'The highest number of shared memory segments, semaphore arrays and message queues the kernel allows, 32768 of each, for hosts running many database instances. Each one costs memory only while it exists.',
    source: 'proc_sys_kernel(5): IPCMNI',
    values: {
      shmmni: IPC_ID_MAX,
      sem: [SEM_DEFAULT[0], SEM_DEFAULT[1], SEM_DEFAULT[2], IPC_ID_MAX],
      msgmni: IPC_ID_MAX,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
