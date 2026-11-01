/**
 * Built-in presets. Each is a partial FilesystemValues: keys it doesn't name
 * keep the profile's starting value (store.applyPreset), so fs.file-max and
 * the watch limit, which follow RAM, stay sized for the profile. Every value
 * must work on every profile; the contract suite checks that.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').FilesystemValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'Every key with a fixed upstream default back at that default, which leaves fs.nr_open out of the file. fs.file-max and the watch limit follow RAM, so they keep their profile values. A baseline to compare against.',
    source: 'docs.kernel.org admin-guide/sysctl/fs, inotify(7)',
    values: {
      nr_open: 1048576,
      max_user_instances: 128,
      max_queued_events: 16384,
      aio_max_nr: 65536,
    },
  },
  {
    id: 'file-watching',
    label: 'Heavy file watching',
    description: 'Room for IDEs, dev servers, file sync and log shippers that watch large trees: a million watches per user, many instances and a deep event queue. Check the memory warning on small machines.',
    source: 'inotify(7); kind known issues; VS Code and Syncthing documentation',
    values: {
      max_user_watches: 1048576,
      max_user_instances: 8192,
      max_queued_events: 131072,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
