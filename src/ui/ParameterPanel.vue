<script setup>
import { ref, computed, watch, useId } from 'vue'
import ParameterCard from './ParameterCard.vue'
import SwitchField from './SwitchField.vue'
import PlusMinus from './PlusMinus.vue'
import MarkKey from './controls/MarkKey.vue'
import { settingsSummary } from './settingsSummary.js'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { showAllParams, setShowAllParams, compactParams, setCompactParams } from '@/ui/viewerPrefs.js'
import { hasProTools, queryTerms, defMatches } from '@/ui/paramFilter.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const SECTIONS = domain.sections
const filterId = useId()

// Start with every section expanded.
const open = ref(Object.fromEntries(SECTIONS.map((s) => [s.id, true])))

// The domain may hide context-dependent keys (e.g. swap hides overcommit_ratio
// unless strict overcommit is selected, security hides keys the chosen kernel
// lacks); defineTuner defaults to all keys.
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

// Advanced cards hide behind "Show N advanced" (Design.md §7 "Essential and
// advanced parameters"), except the ones a preset or the user changed and the
// ones with an issue, so nothing changes out of sight.
const revealed = stickyKeys(() => [...tuner.changedKeys, ...Object.keys(tuner.issuesByParam)]).keys

// Pro tools (Design.md §7 "Filter, changed only and compact"), only on tuners
// with enough parameters to need them. None of it is tuner state: the filter
// text and "Changed only" last for the visit, compact is remembered per viewer.
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

const filterEl = ref(null)

/** Clears both filters; focus goes to the field, since the button that asked goes away. */
function clearFilters() {
  query.value = ''
  changedOnly.value = false
  filterEl.value?.focus()
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

// While filtering, every shown section is open, so no match hides in one the
// viewer collapsed; their own choice comes back when the filter clears.
function isOpen(section) {
  return filtering.value || open.value[section.id]
}

function cardKeys(section) {
  if (filtering.value) return matchingKeys(section)
  if (showAllParams.value || advancedOpen.value[section.id]) return visibleKeys(section)
  const hidden = new Set(hideableKeys(section))
  return visibleKeys(section).filter((k) => !hidden.has(k))
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
</script>

<template>
  <section>
    <!-- Pro tools and the view switches: quiet, above the groups. -->
    <div class="space-y-3">
      <div v-if="proTools" class="max-w-xl">
        <label :for="filterId" class="block text-sm font-medium text-ink">Filter parameters</label>
        <input
          :id="filterId"
          ref="filterEl"
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Name or description, e.g. rmem"
          class="mt-1.5 min-h-11 w-full border border-rule-strong !bg-paper px-3 text-[15px] text-ink placeholder:text-quiet focus:border-ink"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <SwitchField label="Show all parameters" :checked="showAllParams" :disabled="filtering" @update:checked="setShowAllParams" />
          <template v-if="proTools">
            <SwitchField label="Changed only" :checked="changedOnly" @update:checked="setChangedOnly" />
            <SwitchField label="Compact" :checked="compactParams" @update:checked="setCompactParams" />
          </template>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-[3px] hover:text-ink"
          @click="tuner.resetToHardwareDefaults()"
        >
          Reset to hardware defaults
        </button>
      </div>
      <p v-if="proTools" class="text-sm text-quiet" aria-live="polite">
        <template v-if="filtering">{{ matchCount }} parameter{{ matchCount === 1 ? '' : 's' }} shown</template>
      </p>
    </div>
    <div
      v-if="filtering && !shownSections.length"
      class="mt-8 border-y border-rule py-5 text-[15px] text-ink-2"
    >
      <p>{{ emptyMessage }}</p>
      <button
        type="button"
        class="mt-3 inline-flex min-h-11 items-center border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-paper-hover"
        @click="clearFilters"
      >
        Clear filter
      </button>
    </div>

    <!-- Groups: the headline and the marks key over an ink rule, then the
         settings between hairlines. A collapsed group is one hairline row
         with its count and any issues. -->
    <section
      v-for="section in shownSections"
      :key="section.id"
      class="mt-10"
      :aria-labelledby="`section-title-${section.id}`"
    >
      <div class="border-b" :class="isOpen(section) ? 'border-ink pb-3' : 'border-rule pb-4'">
        <h3 :id="`section-title-${section.id}`">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-between gap-4 text-left text-ink enabled:hover:bg-paper-hover"
            :aria-expanded="isOpen(section)"
            :aria-controls="`section-panel-${section.id}`"
            :disabled="filtering"
            @click="open[section.id] = !open[section.id]"
          >
            <span class="min-w-0 text-[22px] font-medium leading-tight tracking-[-0.02em] sm:text-[26px]">{{ section.title }}</span>
            <PlusMinus v-if="!filtering" :open="isOpen(section)" />
          </button>
        </h3>
        <div class="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
          <p v-if="!isOpen(section)" class="text-sm text-quiet">{{ countSummary(section) }}</p>
          <p v-else-if="!compact" class="max-w-[60ch] text-sm text-quiet">{{ section.summary }}</p>
          <p
            v-if="issuesBySection[section.id].count"
            class="text-sm font-medium"
            :class="issuesBySection[section.id].error ? 'text-error' : 'text-mine-text'"
          >
            {{ issuesBySection[section.id].count }} issue{{ issuesBySection[section.id].count === 1 ? '' : 's' }}
          </p>
          <MarkKey v-if="isOpen(section) && !compact" class="ml-auto" :default-label="domain.defaultLabel" />
        </div>
      </div>
      <div
        v-if="isOpen(section)"
        :id="`section-panel-${section.id}`"
      >
        <ParameterCard
          v-for="key in cardKeys(section)"
          :key="key"
          :param-key="key"
          :compact="compact"
        />
        <button
          v-if="!filtering && !showAllParams && hideableKeys(section).length"
          type="button"
          class="flex min-h-14 w-full items-center justify-between gap-4 border-b border-rule py-3 text-left text-[15px] font-medium text-ink hover:bg-paper-hover"
          :aria-expanded="advancedOpen[section.id]"
          :aria-controls="`section-panel-${section.id}`"
          @click="advancedOpen[section.id] = !advancedOpen[section.id]"
        >{{ advancedOpen[section.id] ? 'Hide advanced' : `Show ${hideableKeys(section).length} advanced` }}<PlusMinus :open="advancedOpen[section.id]" /></button>
      </div>
    </section>
  </section>
</template>
