import { PARAMETER_DEFS_BY_KEY } from './parameterDefs.js'

/**
 * Built-in preset profiles. Each preset is a partial ParameterValues — keys not
 * mentioned are left at whatever the hardware-derived default produced. The
 * PresetSelector merges the partial over the current params via store.applyPreset.
 *
 * @typedef {Object} Preset
 * @property {string}   id
 * @property {string}   label          Short label for the chip
 * @property {string}   description    One-line summary shown under the chip
 * @property {string}   source         Citation for where the values come from
 * @property {Partial<import('@/model/parameters.js').ParameterValues>} values
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'kernel-defaults',
    label: 'Kernel defaults',
    description: 'Every parameter at its stock kernel default, useful as a known baseline.',
    source: 'docs.kernel.org/admin-guide/sysctl/vm.html',
    values: Object.fromEntries(
      Object.values(PARAMETER_DEFS_BY_KEY).map((d) => [d.key, d.kernelDefault]),
    ),
  },
  {
    id: 'k8s-node',
    label: 'Kubernetes node',
    description: 'Latency-friendly profile for K8s workers with disk-backed swap.',
    source: 'kubernetes.io/blog Aug 2025, tuning Linux swap for Kubernetes',
    values: {
      swappiness: 10,
      min_free_kbytes: 262144,
      watermark_scale_factor: 2000,
      vfs_cache_pressure: 100,
      overcommit_memory: 0,
      panic_on_oom: 0,
    },
  },
  {
    id: 'k8s-zram',
    label: 'Kubernetes + zram',
    description: 'Aggressive swappiness for in-memory compressed swap on K8s nodes.',
    source: 'kubernetes.io/blog Aug 2025 (fast-swap formula)',
    values: {
      swappiness: 133,
      min_free_kbytes: 131072,
      watermark_scale_factor: 1000,
      overcommit_memory: 0,
      panic_on_oom: 0,
    },
  },
  {
    id: 'database',
    label: 'Database server',
    description: 'Minimal swap, tight dirty ratios to keep flushes small and predictable.',
    source: 'RHEL performance tuning guide',
    values: {
      swappiness: 1,
      dirty_ratio: 5,
      dirty_background_ratio: 2,
      dirty_expire_centisecs: 500,
      dirty_writeback_centisecs: 100,
      vfs_cache_pressure: 50,
    },
  },
  {
    id: 'desktop',
    label: 'Desktop workstation',
    description: 'Standard interactive desktop with moderate swap and default writeback.',
    source: 'General desktop guidance',
    values: {
      swappiness: 100,
      vfs_cache_pressure: 100,
      dirty_ratio: 20,
      dirty_background_ratio: 10,
    },
  },
  {
    id: 'memory-constrained',
    label: 'Memory-constrained',
    description: 'Embedded-style: small reserves, narrow watermark, lenient dirty ratios.',
    source: 'Embedded Linux tuning patterns',
    values: {
      min_free_kbytes: 8192,
      watermark_scale_factor: 10,
      dirty_ratio: 30,
      dirty_background_ratio: 15,
      swappiness: 30,
    },
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))