/**
 * The network tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'web' | 'bulk' | 'container' | 'router' | 'desktop'} NetworkWorkload
 * @typedef {'1g' | '10g' | '25g' | '100g'} LinkSpeed
 * @typedef {'lan' | 'region' | 'continent' | 'global'} PathLength
 *
 * @typedef {Object} NetworkSpec
 * @property {NetworkWorkload} workload
 * @property {LinkSpeed}   link       NIC speed
 * @property {PathLength}  rtt        Round-trip time of the longest path that must run fast
 * @property {number}      ramGiB
 * @property {'on' | 'off'} conntrack Whether nf_conntrack is loaded
 */

import { profileDefaults } from '@/core/profile.js'
import { formatSizeGiB } from '@/core/formatting.js'
import { RAM_FIELD } from '@/ui/profile/fieldOptions.js'

/** Link speed in bit/s for each option. */
export const LINK_BPS = { '1g': 1e9, '10g': 1e10, '25g': 2.5e10, '100g': 1e11 }

/** Round-trip time in seconds for each option. */
export const RTT_SECONDS = { lan: 0.001, region: 0.02, continent: 0.08, global: 0.2 }

export const PROFILE = {
  title: 'System profile',
  applyLabel: 'Apply system profile',
  fields: [
    {
      key: 'workload',
      type: 'choice',
      control: 'select',
      label: 'What the machine does',
      options: [
        { value: 'web', label: 'Web or API server, reverse proxy' },
        { value: 'bulk', label: 'File, storage or streaming server' },
        { value: 'container', label: 'Container host or Kubernetes node' },
        { value: 'router', label: 'Router, NAT gateway or firewall' },
        { value: 'desktop', label: 'Desktop or developer workstation' },
      ],
      default: 'web',
    },
    {
      key: 'link',
      type: 'choice',
      control: 'segmented',
      label: 'Network link speed',
      options: [
        { value: '1g', label: '1 Gbit/s' },
        { value: '10g', label: '10 Gbit/s' },
        { value: '25g', label: '25 Gbit/s' },
        { value: '100g', label: '100 Gbit/s' },
      ],
      default: '10g',
    },
    {
      key: 'rtt',
      type: 'choice',
      control: 'cards',
      label: 'Longest path that must run at full speed',
      options: [
        { value: 'lan', label: 'Same data centre', note: 'about 1 ms' },
        { value: 'region', label: 'Same region', note: 'about 20 ms' },
        { value: 'continent', label: 'Across a continent', note: 'about 80 ms' },
        { value: 'global', label: 'Intercontinental', note: 'about 200 ms' },
      ],
      default: 'region',
    },
    { ...RAM_FIELD, default: 16, half: true },
    {
      key: 'conntrack',
      type: 'choice',
      control: 'segmented',
      label: 'Connection tracking',
      options: [
        { value: 'on', label: 'in use', note: 'A stateful firewall, NAT, Docker or Kubernetes loads nf_conntrack.' },
        { value: 'off', label: 'not loaded', note: 'The net.netfilter keys don\'t exist, so they are left out.' },
      ],
      default: 'on',
      half: true,
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {NetworkSpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('workload', hw.workload),
    label('link', hw.link),
    `${RTT_SECONDS[hw.rtt] * 1000} ms RTT`,
    `\`${formatSizeGiB(hw.ramGiB)}\` RAM`,
    hw.conntrack === 'on' ? 'conntrack in use' : 'no conntrack',
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_NETWORK_SPEC = /** @type {NetworkSpec} */ (profileDefaults(PROFILE.fields))
