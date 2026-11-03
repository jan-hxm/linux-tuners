<script setup>
import { ref, computed, watch, useId } from 'vue'
import ParameterCard from './ParameterCard.vue'
import SwitchField from './SwitchField.vue'
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

const issueCountsBySection = computed(() => {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const section of SECTIONS) {
    counts[section.id] = section.keys.reduce(
      (sum, k) => sum + (tuner.issuesByParam[k]?.length ?? 0),
      0,
    )
  }
  return counts
})
</script>

<template>
  <section class="space-y-3">
    <div class="space-y-2 px-1">
      <div v-if="proTools">
        <label :for="filterId" class="block text-xs font-medium text-slate-700">Filter parameters</label>
        <input
          :id="filterId"
          ref="filterEl"
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Name or description, e.g. rmem"
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-600"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SwitchField label="Show all parameters" :checked="showAllParams" :disabled="filtering" @update:checked="setShowAllParams" />
          <template v-if="proTools">
            <SwitchField label="Changed only" :checked="changedOnly" @update:checked="setChangedOnly" />
            <SwitchField label="Compact" :checked="compactParams" @update:checked="setCompactParams" />
          </template>
        </div>
        <button
          type="button"
          class="inline-flex min-h-6 items-center text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-500"
          @click="tuner.resetToHardwareDefaults()"
        >
          Reset to hardware defaults
        </button>
      </div>
      <p v-if="proTools" class="text-xs text-slate-500" aria-live="polite">
        <template v-if="filtering">{{ matchCount }} parameter{{ matchCount === 1 ? '' : 's' }} shown</template>
      </p>
    </div>
    <div
      v-if="filtering && !shownSections.length"
      class="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700"
    >
      <p>{{ emptyMessage }}</p>
      <button
        type="button"
        class="mt-2 inline-flex min-h-6 items-center rounded border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50"
        @click="clearFilters"
      >
        Clear filter
      </button>
    </div>
    <article
      v-for="section in shownSections"
      :key="section.id"
      class="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-slate-900">
            <button
              type="button"
              class="flex min-h-6 w-full items-center gap-1.5 text-left"
              :aria-expanded="isOpen(section)"
              :aria-controls="`section-panel-${section.id}`"
              :disabled="filtering"
              @click="open[section.id] = !open[section.id]"
            >
              <span aria-hidden="true">{{ isOpen(section) ? '▾' : '▸' }}</span>
              {{ section.title }}
            </button>
          </h3>
          <p v-if="!compact" class="text-xs text-slate-500">{{ section.summary }}</p>
        </div>
        <span
          v-if="issueCountsBySection[section.id]"
          class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
        >
          {{ issueCountsBySection[section.id] }} issue{{ issueCountsBySection[section.id] === 1 ? '' : 's' }}
        </span>
      </header>
      <div
        v-if="isOpen(section)"
        :id="`section-panel-${section.id}`"
        class="space-y-2 border-t border-slate-100 p-3"
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
          class="min-h-6 rounded px-1 text-xs text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700"
          :aria-expanded="advancedOpen[section.id]"
          :aria-controls="`section-panel-${section.id}`"
          @click="advancedOpen[section.id] = !advancedOpen[section.id]"
        >
          {{ advancedOpen[section.id] ? 'Hide advanced' : `Show ${hideableKeys(section).length} advanced` }}
        </button>
      </div>
    </article>
  </section>
</template>
