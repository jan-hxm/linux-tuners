/**
 * Built-in presets. Each is a partial HugepagesValues: keys it doesn't name
 * keep the profile's starting value (store.applyPreset). There is no kernel
 * defaults preset: the THP default is chosen when the kernel is built, always
 * on Debian and madvise on Ubuntu and Fedora, so no one set is right
 * everywhere. Every value must work on every profile; the contract suite
 * checks that.
 *
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {Partial<import('./defs.js').HugepagesValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'thp-off',
    label: 'THP off',
    description: 'Transparent huge pages off entirely, for software whose vendor asks for it: Oracle Database, and MongoDB before 8.0. Programs still get huge pages from the pool.',
    source: 'docs.kernel.org admin-guide/mm/transhuge; Oracle and MongoDB production notes',
    values: {
      thp_enabled: 'never',
      thp_defrag: 'never',
    },
  },
  {
    id: 'thp-always',
    label: 'THP always',
    description: 'Huge pages for all large anonymous memory, for compute and in-memory workloads that gain from fewer TLB misses (MongoDB 8.0 asks for it). Background compaction keeps other programs from waiting for it.',
    source: 'docs.kernel.org admin-guide/mm/transhuge; MongoDB 8.0 production notes',
    values: {
      thp_enabled: 'always',
      thp_defrag: 'defer+madvise',
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
