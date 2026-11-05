import { computed, nextTick } from 'vue'
import { useScrollSpy } from '@/ui/useScrollSpy.js'
import { settingAnchorId, groupAnchorId } from '@/ui/useParameterView.js'
import { focusAnchor } from '@/ui/inPageLink.js'

/**
 * @typedef {object} OutlineSetting
 * @property {string} key
 * @property {string} title       the def's plain-language title
 * @property {string} anchor      the card's anchor id
 * @property {boolean} changed    differs from the profile's default (the `mine` dot)
 * @property {'error'|'warn'|null} issue
 * @property {string} label       the accessible name: title, then the marks in words
 *
 * @typedef {object} OutlineGroup
 * @property {string} id
 * @property {string} title
 * @property {string} anchor
 * @property {boolean} collapsed  the viewer collapsed the group
 * @property {number} more        settings a "+N" line opens (collapsed group or hidden advanced)
 * @property {string} moreLabel   "+5 advanced", "+3 settings"
 * @property {OutlineSetting[]} items
 */

/** The issue mark for a setting: an error beats a warning; an info note has none. */
function issueLevel(issues) {
  if (!issues?.length) return null
  if (issues.some((i) => i.level === 'error' || i.blocking)) return 'error'
  return issues.some((i) => i.level === 'warn') ? 'warn' : null
}

const ISSUE_WORDS = { error: 'error', warn: 'warning' }

export { focusAnchor }

/**
 * The settings outline (Design.md §7 "Settings outline"): the steps, under
 * Tune each group shown and under each group the cards it shows, all from the
 * defs, the store and the panel's view, never from a tuner id. It also spies
 * which card is in view and moves to a card, opening a group or its advanced
 * cards as their own buttons would.
 *
 * TunerPage creates it with its own store and view (it can't inject what it
 * provides) and hands it to the rail and the drawer.
 *
 * @param {any} tuner   the tuner store
 * @param {import('@/core/types.js').TunerDomain} domain
 * @param {ReturnType<typeof import('@/ui/useParameterView.js').useParameterView>} view
 * @param {{ activeStep: import('vue').Ref<string|null>, tuneStepId?: string }} options
 */
export function useOutline(tuner, domain, view, { activeStep, tuneStepId = 'tune' }) {
  /** @type {import('vue').ComputedRef<OutlineGroup[]>} */
  const groups = computed(() => {
    const changed = new Set(tuner.changedKeys)
    return view.shownSections.value.map((section) => {
      const collapsed = !view.isOpen(section)
      const items = collapsed
        ? []
        : view.cardKeys(section).map((key) => {
            const def = domain.defsByKey[key]
            const issue = issueLevel(tuner.issuesByParam[key])
            const isChanged = changed.has(key)
            const label = [def.title, isChanged && 'changed by you', issue && ISSUE_WORDS[issue]].filter(Boolean).join(', ')
            return { key, title: def.title, anchor: settingAnchorId(key), changed: isChanged, issue, label }
          })
      const more = collapsed ? view.visibleKeys(section).length : view.hiddenAdvancedCount(section)
      const moreLabel = collapsed ? `+${more} setting${more === 1 ? '' : 's'}` : `+${more} advanced`
      return { id: section.id, title: section.title, anchor: groupAnchorId(section.id), collapsed, more, moreLabel, items }
    })
  })

  /** Every anchor the spy watches, in page order: each group, then its cards. */
  const anchorIds = computed(() => groups.value.flatMap((g) => [g.anchor, ...g.items.map((i) => i.anchor)]))
  const spied = useScrollSpy(() => anchorIds.value)

  /** The group or card anchor in view, while the reader is in the tune step. */
  const activeAnchor = computed(() => (activeStep.value === tuneStepId ? spied.value : null))
  /** The group holding what is in view. */
  const activeGroup = computed(() => {
    const id = activeAnchor.value
    if (!id) return null
    return groups.value.find((g) => g.anchor === id || g.items.some((i) => i.anchor === id))?.id ?? null
  })

  /** Goes to a card or a group. */
  function goTo(anchor) {
    focusAnchor(anchor)
  }

  /**
   * The "+N" line: opens the collapsed group or its advanced cards, as the
   * group's own buttons do, then goes to the first card that appeared.
   */
  async function openMore(groupId) {
    const section = view.shownSections.value.find((s) => s.id === groupId)
    if (!section) return
    const before = new Set(view.isOpen(section) ? view.cardKeys(section) : [])
    if (!view.isOpen(section)) view.open.value[groupId] = true
    else view.advancedOpen.value[groupId] = true
    await nextTick()
    const first = view.cardKeys(section).find((k) => !before.has(k))
    if (first) focusAnchor(settingAnchorId(first))
  }

  return { groups, anchorIds, activeAnchor, activeGroup, goTo, openMore }
}

/** Rail widths, in rem, that the page's default rail state is measured with. */
export const RAIL = {
  expanded: 12,
  collapsed: 2.5,
  gap: 2,
  /** The graph column and its gap (TunerPage's lg grid: 25rem + 3rem). */
  graphs: 28,
  /** The width a card needs for its margin layout (ParameterCard, Design.md §7). */
  minSettings: 40,
}

/**
 * Whether the rail starts expanded: only when the settings column keeps the
 * card's margin layout beside an expanded rail (and the graph column, where
 * the tuner has one).
 *
 * @param {number} widthRem  the width the rail and the steps share
 * @param {boolean} hasGraphs
 */
export function railStartsExpanded(widthRem, hasGraphs) {
  return settingsColumnRem(widthRem, hasGraphs, true) >= RAIL.minSettings
}

/** The settings column's width beside the rail, in rem. */
export function settingsColumnRem(widthRem, hasGraphs, expanded) {
  return widthRem - (expanded ? RAIL.expanded : RAIL.collapsed) - RAIL.gap - (hasGraphs ? RAIL.graphs : 0)
}
