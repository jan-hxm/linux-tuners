import { ref, computed, watch } from 'vue'
import { settingsSummary } from './settingsSummary.js'
import { showAllParams, compactParams } from '@/ui/viewerPrefs.js'
import { hasProTools, queryTerms, defMatches } from '@/ui/paramFilter.js'

/** The anchor id of a setting's card, which the outline links to. */
export const settingAnchorId = (key) => `setting-${key}`
/** The anchor id of a group in the tune step. */
export const groupAnchorId = (sectionId) => `group-${sectionId}`

/**
 * Which groups and cards the tune step shows: the open groups, the advanced
 * reveal, the filter and "Changed only" (Design.md §7 "Essential and advanced
 * parameters", "Filter, changed only and compact"). ParameterPanel renders it
 * and the settings outline lists it, so both always agree. TunerPage creates
 * one and provides it (PARAMETER_VIEW_KEY); a panel without one (the guided
 * setup) makes its own.
 *
 * @param {any} tuner   the tuner store
 * @param {import('@/core/types.js').TunerDomain} domain
 */
export function useParameterView(tuner, domain) {
  const SECTIONS = domain.sections

  // Start with every section expanded.
  const open = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, true])))

  // The domain may hide context-dependent keys (e.g. swap hides
  // overcommit_ratio unless strict overcommit is selected, security hides keys
  // the chosen kernel lacks); defineTuner defaults to all keys.
  function visibleKeys(section) {
    return domain.visibleKeys(section, tuner.params, tuner.hardware)
  }

  /**
   * A set of keys that is recomputed on a bulk change (profile, preset, reset,
   * undo replace the params object) and otherwise only grows, so a card edited
   * back to its default doesn't vanish under the pointer.
   * @param {() => string[]} source
   */
  function stickyKeys(source) {
    const keys = ref(new Set(source()))
    const reset = () => (keys.value = new Set(source()))
    watch(() => tuner.params, reset)
    watch(source, (now) => {
      const added = now.filter((k) => !keys.value.has(k))
      if (added.length) keys.value = new Set([...keys.value, ...added])
    })
    return { keys, reset }
  }

  // Advanced cards hide behind "Show N advanced", except the ones a preset or
  // the user changed and the ones with an issue, so nothing changes out of
  // sight.
  const revealed = stickyKeys(() => [...tuner.changedKeys, ...Object.keys(tuner.issuesByParam)]).keys

  // Pro tools, only on tuners with enough parameters to need them. None of it
  // is tuner state: the filter text and "Changed only" last for the visit,
  // compact is remembered per viewer.
  const proTools = hasProTools(domain)
  const query = ref('')
  const changedOnly = ref(false)
  const changedShown = stickyKeys(() => tuner.changedKeys)
  const terms = computed(() => (proTools ? queryTerms(query.value) : []))
  const filtering = computed(() => terms.value.length > 0 || (proTools && changedOnly.value))
  const compact = computed(() => proTools && compactParams.value)

  function setChangedOnly(on) {
    if (on) changedShown.reset()
    changedOnly.value = on
  }

  function clearFilters() {
    query.value = ''
    changedOnly.value = false
  }

  /** A section's cards that pass the filter, across both tiers. */
  function matchingKeys(section) {
    return visibleKeys(section).filter(
      (k) => defMatches(domain.defsByKey[k], terms.value) && (!changedOnly.value || changedShown.keys.value.has(k)),
    )
  }

  // A section with no key for this system (e.g. conntrack keys without
  // nf_conntrack) isn't shown at all, and neither is one the filter empties.
  const shownSections = computed(() =>
    SECTIONS.filter((s) => (filtering.value ? matchingKeys(s) : visibleKeys(s)).length > 0),
  )

  const matchCount = computed(() =>
    filtering.value ? shownSections.value.reduce((sum, s) => sum + matchingKeys(s).length, 0) : 0,
  )

  const emptyMessage = computed(() => {
    const text = query.value.trim()
    if (changedOnly.value && text) return `No changed parameter matches "${text}".`
    if (changedOnly.value) return 'No parameter differs from the default for your profile yet.'
    return `No parameter matches "${text}".`
  })

  /** Sections whose advanced cards the viewer opened. */
  const advancedOpen = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, false])))

  /**
   * A section's advanced cards that "Hide advanced" would hide. None when the
   * profile leaves the section no essential card (a domain's visibleKeys can
   * drop them): a section that is only a button would hide what it is about.
   */
  function hideableKeys(section) {
    const keys = visibleKeys(section)
    if (!keys.some((k) => domain.defsByKey[k].tier === 'essential')) return []
    return keys.filter((k) => domain.defsByKey[k].tier === 'advanced' && !revealed.value.has(k))
  }

  // While filtering, every shown section is open, so no match hides in one
  // the viewer collapsed; their own choice comes back when the filter clears.
  function isOpen(section) {
    return filtering.value || open.value[section.id]
  }

  /** The cards an open section shows. */
  function cardKeys(section) {
    if (filtering.value) return matchingKeys(section)
    if (showAllParams.value || advancedOpen.value[section.id]) return visibleKeys(section)
    const hidden = new Set(hideableKeys(section))
    return visibleKeys(section).filter((k) => !hidden.has(k))
  }

  /** How many advanced cards sit behind the section's "Show N advanced" button now. */
  function hiddenAdvancedCount(section) {
    if (filtering.value || showAllParams.value || advancedOpen.value[section.id]) return 0
    return hideableKeys(section).length
  }

  /** Each section's issues: how many, and whether one is an error. */
  const issuesBySection = computed(() => {
    /** @type {Record<string, { count: number, error: boolean }>} */
    const result = {}
    for (const section of SECTIONS) {
      const issues = section.keys.flatMap((k) => tuner.issuesByParam[k] ?? [])
      result[section.id] = { count: issues.length, error: issues.some((i) => i.level === 'error' || i.blocking) }
    }
    return result
  })

  /** A collapsed group's line: how many settings, and where they stand. */
  function countSummary(section) {
    return settingsSummary(visibleKeys(section), tuner.changedKeys)
  }

  return {
    open,
    advancedOpen,
    proTools,
    query,
    changedOnly,
    filtering,
    compact,
    shownSections,
    matchCount,
    emptyMessage,
    issuesBySection,
    visibleKeys,
    hideableKeys,
    hiddenAdvancedCount,
    isOpen,
    cardKeys,
    countSummary,
    setChangedOnly,
    clearFilters,
  }
}
