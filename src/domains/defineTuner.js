/**
 * Build a TunerDomain from a tuner's spec: fill in the optional hooks with
 * their defaults, so shared code never has to check whether a hook exists,
 * and (in dev and tests) fail fast when a required field is missing or
 * inconsistent. See Design.md §9 "Contract tests".
 */

const REQUIRED = [
  'id',
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
  'defaultTab',
  'workloads',
  'workloadField',
  'context',
  'docsLabel',
  'noteKey',
]

const DEFAULTS = {
  /** Every key of the section is shown. */
  visibleKeys: (section) => section.keys,
  /** The contextual badge/note always applies. */
  contextApplies: () => true,
  /** No reference-drawer formula. */
  formula: () => null,
}

/**
 * @param {Object} spec  A TunerDomain with the optional hooks left out
 * @returns {import('./types.js').TunerDomain}
 */
export function defineTuner(spec) {
  const domain = { ...DEFAULTS, ...spec }
  if (import.meta.env?.DEV) assertTuner(domain)
  return Object.freeze(domain)
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
  if (!/^[a-z0-9][a-z0-9._-]*\.conf$/.test(domain.outputFilename)) fail('outputFilename must be a plain *.conf name')

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
}
