/**
 * Huge pages and memory layout domain module. Bundles the defs and rules in
 * this folder into the generic TunerDomain shape. It has no graphs: the pool
 * is a fixed amount of RAM, which the formula shows, and the THP and KSM
 * effects depend on the programs running.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, POSTGRES_HUGE_PAGES } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable, poolBytes, ramBytes } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { formatValue } from './formatting.js'
import { formatBytes } from '@/core/formatting.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'pool',
    title: 'Huge page pool',
    summary: 'RAM set aside in 2 MiB pages for databases, VMs and packet processing that ask for them.',
    keys: ['nr_hugepages', 'nr_overcommit_hugepages'],
  },
  {
    id: 'thp',
    title: 'Transparent huge pages',
    summary: 'Huge pages the kernel hands out on its own, without a pool.',
    keys: ['thp_enabled', 'thp_defrag'],
  },
  {
    id: 'ksm',
    title: 'Kernel samepage merging',
    summary: 'Merging identical pages, mostly between virtual machines.',
    keys: ['ksm_run', 'ksm_pages_to_scan', 'ksm_sleep_millisecs'],
  },
  {
    id: 'maps',
    title: 'Memory maps and NUMA',
    summary: 'The per-process mapping limit, and where memory comes from on multi-node machines.',
    keys: ['max_map_count', 'zone_reclaim_mode'],
  },
]

/**
 * Reference-drawer formula for the pool, where the RAM it takes is the
 * trade-off.
 *
 * @param {Object} def
 * @param {{hardware:Object, params:Object}} ctx
 * @returns {import('@/core/types.js').TunerFormula|null}
 */
function formula(def, { hardware, params }) {
  if (def.key !== 'nr_hugepages') return null
  const pool = poolBytes(params.nr_hugepages)
  return {
    title: 'RAM the pool takes',
    lines: [
      'pool = nr_hugepages × 2 MiB, taken when set',
      'left = RAM − pool',
    ],
    values: [
      { label: 'pool', v: formatBytes(pool) },
      { label: 'left for everything else', v: formatBytes(Math.max(0, ramBytes(hardware) - pool)) },
    ],
  }
}

export const hugepagesDomain = defineTuner({
  id: 'hugepages',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  visibleKeys: (section, params, hw) => section.keys.filter((k) => isApplicable(k, hw, params)),
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-hugepages-tuning.conf',
  formula,
  workloads: ['server', 'database', 'vm-host', 'desktop'],
  workloadField: 'workload',
  context: { badge: 'DB', label: 'Databases', url: POSTGRES_HUGE_PAGES },
  contextApplies: (hw) => hw.workload === 'database',
  docsLabel: 'kernel docs',
  noteKey: 'dbNote',
  page: PAGE,
  about: ABOUT,
})
