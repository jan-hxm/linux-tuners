/**
 * Build a TunerDomain from a tuner's spec: fill in the optional hooks with
 * their defaults, so shared code never has to check whether a hook exists,
 * derive the default profile and the shared-link codec from the profile field
 * list, and (in dev and tests) fail fast when a required field is missing or
 * inconsistent. See Design.md §9 "Contract tests".
 */

import { makeSerialization } from './serialization.js'
import { profileDefaults, profileSchema, profileProblems } from './profile.js'

const REQUIRED = [
  'id',
  'profile',
  'defaultHardware',
  'parameterKeys',
  'defsByKey',
  'deriveDefaults',
  'rangeFor',
  'validate',
  'hasBlockingIssue',
  'formatValue',
  'sections',
  'presets',
  'presetsById',
  'generateConfig',
  'outputFilename',
  'encodeState',
  'decodeState',
  'workloads',
  'workloadField',
  'context',
  'docsLabel',
  'noteKey',
  'page',
  'about',
]

const DEFAULTS = {
  /** Every key of the section is shown. */
  visibleKeys: (section) => section.keys,
  /** The contextual badge/note always applies. */
  contextApplies: () => true,
  /** No reference-drawer formula. */
  formula: () => null,
  /** No simulation module, so no impact metrics. */
  simulation: {},
  /** No graphs: the tune step goes full width and the impact bar hides. */
  graphTabs: [],
  /** Shared links carry envelope version 1. */
  linkVersion: 1,
}

/**
 * @param {Object} spec  A TunerDomain with the optional hooks left out
 * @returns {import('./types.js').TunerDomain}
 */
export function defineTuner(spec) {
  const merged = { ...DEFAULTS, ...spec, ...fromProfile(spec) }
  // The first tab opens unless the spec names another; no tabs, no tab.
  const domain = { defaultTab: merged.graphTabs?.[0]?.id ?? null, ...merged }
  if (import.meta.env?.DEV) assertTuner(domain)
  return Object.freeze(domain)
}

/** The default profile and the link codec, both from the profile field list. */
function fromProfile({ profile, parameterKeys, defsByKey, linkVersion = DEFAULTS.linkVersion }) {
  // Without a field list there is no schema, so no link restores: the spec
  // can't supply a looser decodeState of its own.
  if (!profile?.fields) return { decodeState: () => null }
  const defaultHardware = profileDefaults(profile.fields)
  return {
    defaultHardware,
    ...makeSerialization({ parameterKeys, defsByKey, defaultHardware, hardwareSchema: profileSchema(profile.fields), version: linkVersion }),
  }
}

/**
 * Structural checks that need no rendering. The behavioural ones (ranges,
 * presets, round-trips, hostile links) live in the contract test suite.
 *
 * @param {import('./types.js').TunerDomain} domain
 */
export function assertTuner(domain) {
  const fail = (msg) => {
    throw new Error(`defineTuner(${domain.id ?? '?'}): ${msg}`)
  }
  for (const field of REQUIRED) {
    if (domain[field] === undefined || domain[field] === null) fail(`missing required field "${field}"`)
  }
  // Ids key the Pinia store and the shared URL hash, so they're permanent.
  if (!/^[a-z][a-z0-9-]*$/.test(domain.id)) fail('id must be kebab-case')
  if (!/^[a-z0-9][a-z0-9._-]*\.(conf|rules)$/.test(domain.outputFilename)) fail('outputFilename must be a plain *.conf or *.rules name')
  if (!Number.isInteger(domain.linkVersion) || domain.linkVersion < 1) fail('linkVersion must be a positive integer')

  for (const key of domain.parameterKeys) {
    if (!Object.hasOwn(domain.defsByKey, key)) fail(`no def for key "${key}"`)
  }
  for (const key of Object.keys(domain.defsByKey)) {
    if (!domain.parameterKeys.includes(key)) fail(`def "${key}" is not in parameterKeys`)
  }

  const sectionKeys = domain.sections.flatMap((s) => s.keys)
  if (sectionKeys.length !== new Set(sectionKeys).size) fail('a key appears in more than one section')
  for (const key of domain.parameterKeys) {
    if (!sectionKeys.includes(key)) fail(`key "${key}" is in no section`)
  }
  for (const key of sectionKeys) {
    if (!domain.parameterKeys.includes(key)) fail(`section key "${key}" is not a parameter`)
  }

  for (const preset of domain.presets) {
    if (domain.presetsById[preset.id] !== preset) fail(`presetsById is missing preset "${preset.id}"`)
  }
  if (Object.keys(domain.presetsById).length !== domain.presets.length) fail('presetsById has extra entries')

  if (!Object.hasOwn(domain.defaultHardware, domain.workloadField)) fail('workloadField is not a profile field')

  const { profile } = domain
  if (!profile.title || !profile.applyLabel || typeof profile.summary !== 'function') fail('profile needs a title, an applyLabel and a summary')
  for (const problem of profileProblems(profile.fields)) fail(problem)

  if (!Array.isArray(domain.graphTabs)) fail('graphTabs must be an array')
  for (const tab of domain.graphTabs) {
    if (!tab.id || !tab.label || !tab.component || !tab.blurb) fail(`graph tab "${tab.id ?? '?'}" needs an id, label, component and blurb`)
  }
  if (domain.graphTabs.length === 0) {
    if (domain.defaultTab != null) fail('defaultTab is set but there are no graph tabs')
  } else if (!domain.graphTabs.some((t) => t.id === domain.defaultTab)) {
    fail('defaultTab is not a graph tab')
  }
}
