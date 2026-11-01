/**
 * Security-hardening domain module. Bundles the defs and rules in this folder
 * into the generic TunerDomain shape. It has no graphs: the hardening keys are
 * a checklist with no meaningful simulation, so the tune step goes full width.
 */

import { defineTuner } from '@/core/defineTuner.js'
import { PROFILE } from './profile.js'
import { PARAMETER_KEYS, PARAMETER_DEFS_BY_KEY, CIS_BENCHMARKS } from './defs.js'
import { deriveDefaults, rangeFor, isApplicable } from './calculations.js'
import { validate, hasBlockingIssue } from './validation.js'
import { generateConfig } from './config.js'
import { PRESETS, PRESETS_BY_ID } from './presets.js'
import { PAGE, ABOUT } from './about.js'

const SECTIONS = [
  {
    id: 'kernel',
    title: 'Kernel information & attack surface',
    summary: 'What unprivileged users can learn about the kernel, and which risky interfaces they can reach.',
    keys: ['kptr_restrict', 'dmesg_restrict', 'perf_event_paranoid', 'ptrace_scope', 'randomize_va_space', 'unprivileged_bpf_disabled', 'user_namespaces'],
  },
  {
    id: 'network',
    title: 'Network',
    summary: 'Spoofed sources, SYN floods, and packets that try to change routes.',
    keys: ['rp_filter', 'tcp_syncookies', 'accept_redirects', 'accept_redirects_v6', 'send_redirects', 'accept_source_route'],
  },
  {
    id: 'filesystem',
    title: 'Filesystem links & core dumps',
    summary: 'Link and file tricks in shared directories like /tmp, and what privileged crashes leave behind.',
    keys: ['protected_symlinks', 'protected_hardlinks', 'protected_fifos', 'protected_regular', 'suid_dumpable'],
  },
]

/** The card's value text: the segment's or option's label, or on/off. */
function formatValue(value, def) {
  if (def.segmentLabels) return def.segmentLabels[value] ?? String(value)
  if (def.options) return def.options.find((o) => o.value === value)?.label ?? String(value)
  return value === 1 ? 'on' : 'off'
}

export const securityDomain = defineTuner({
  id: 'security',
  profile: PROFILE,
  parameterKeys: PARAMETER_KEYS,
  defsByKey: PARAMETER_DEFS_BY_KEY,
  deriveDefaults,
  rangeFor,
  validate,
  hasBlockingIssue,
  formatValue,
  sections: SECTIONS,
  visibleKeys: (section, _params, hw) => section.keys.filter((k) => isApplicable(k, hw)),
  presets: PRESETS,
  presetsById: PRESETS_BY_ID,
  generateConfig,
  outputFilename: '99-security-hardening.conf',
  workloads: ['server', 'container', 'router', 'desktop'],
  workloadField: 'workload',
  // 2 added user.max_user_namespaces; a version 1 link lacks it and is refused.
  linkVersion: 2,
  context: { badge: 'CIS', label: 'CIS benchmark', url: CIS_BENCHMARKS },
  docsLabel: 'kernel.org docs',
  noteKey: 'cisNote',
  page: PAGE,
  about: ABOUT,
})
