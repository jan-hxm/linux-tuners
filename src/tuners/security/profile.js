/**
 * The security tuner's system profile: one field list that drives the form,
 * the defaults and the shared-link restore schema (src/core/profile.js).
 *
 * @typedef {'server' | 'container' | 'router' | 'desktop'} SecurityWorkload
 * @typedef {'current' | 'lts' | 'legacy'} KernelGeneration
 *
 * @typedef {Object} SecuritySpec
 * @property {SecurityWorkload} workload  What the machine does
 * @property {KernelGeneration} kernel    Decides which keys and values exist
 * @property {'on' | 'off'}     ipv6      Whether the net.ipv6 keys exist
 */

import { profileDefaults } from '@/core/profile.js'

// workload is echoed into the generated config, so a shared link is held to
// these option lists like every other choice field.
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
        { value: 'server', label: 'Server (single network, no forwarding)' },
        { value: 'container', label: 'Container host or Kubernetes node' },
        { value: 'router', label: 'Router, firewall or VPN gateway' },
        { value: 'desktop', label: 'Desktop or developer workstation' },
      ],
      default: 'server',
      machine: {
        from: 'role',
        map: {
          server: 'server',
          web: 'server',
          database: 'server',
          'container-host': 'container',
          'vm-host': 'container',
          router: 'router',
          desktop: 'desktop',
        },
      },
    },
    {
      key: 'kernel',
      type: 'choice',
      control: 'cards',
      label: 'Kernel version (run uname -r)',
      columns: 3,
      options: [
        { value: 'current', label: '5.13 or newer', note: 'every key and value' },
        { value: 'lts', label: '4.19 to 5.12', note: 'unprivileged BPF can only be locked off' },
        { value: 'legacy', label: '4.9 to 4.18', note: 'also no protected_fifos or protected_regular' },
      ],
      default: 'current',
      machine: {
        from: 'kernel',
        map: { '5.17': 'current', '5.13': 'current', '5.8': 'lts', '4.19': 'lts', '4.9': 'legacy' },
      },
    },
    {
      key: 'ipv6',
      type: 'choice',
      control: 'segmented',
      label: 'IPv6',
      options: [
        { value: 'on', label: 'enabled', note: 'The IPv6 redirect keys are included.' },
        { value: 'off', label: 'disabled', note: 'For ipv6.disable=1 at boot, where the net.ipv6 keys don\'t exist.' },
      ],
      default: 'on',
    },
  ],
  /**
   * The collapsed one-line summary, as rich-text parts joined with " · ".
   * @param {SecuritySpec} hw
   * @param {(key: string, value: string) => string} label  A choice's option label
   */
  summary: (hw, label) => [
    label('workload', hw.workload),
    `kernel ${label('kernel', hw.kernel)}`,
    hw.ipv6 === 'on' ? 'IPv6 on' : 'IPv6 off',
  ],
}

/** Default system profile used before the user submits the form. */
export const DEFAULT_SECURITY_SPEC = /** @type {SecuritySpec} */ (profileDefaults(PROFILE.fields))
