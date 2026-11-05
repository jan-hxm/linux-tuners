<script setup>
import { ref, inject, useId } from 'vue'
import ParameterCard from './ParameterCard.vue'
import SwitchField from './SwitchField.vue'
import PlusMinus from './PlusMinus.vue'
import MarkKey from './controls/MarkKey.vue'
import { useActiveTuner, useTunerDomain, PARAMETER_VIEW_KEY } from '@/ui/useActiveTuner.js'
import { showAllParams, setShowAllParams, compactParams, setCompactParams } from '@/ui/viewerPrefs.js'
import { useParameterView, settingAnchorId, groupAnchorId } from '@/ui/useParameterView.js'

const tuner = useActiveTuner()
const domain = useTunerDomain()

const filterId = useId()

// Which groups and cards show (Design.md §7 "Essential and advanced
// parameters", "Filter, changed only and compact"). The tuner page provides
// the view so the settings outline lists the same cards; the guided setup's
// panel keeps its own.
const {
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
  hideableKeys,
  isOpen,
  cardKeys,
  countSummary,
  setChangedOnly,
  clearFilters: clearView,
} = inject(PARAMETER_VIEW_KEY, null) ?? useParameterView(tuner, domain)

const filterEl = ref(null)

/** Clears both filters; focus goes to the field, since the button that asked goes away. */
function clearFilters() {
  clearView()
  filterEl.value?.focus()
}

// The outline scrolls a card or a group to just under the sticky bars.
const ANCHOR_SCROLL = 'scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)]'
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
          class="mt-1.5 min-h-11 w-full border border-rule-strong bg-paper px-3 text-[15px] text-ink placeholder:text-quiet focus:border-ink"
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
      :id="groupAnchorId(section.id)"
      class="mt-10"
      :class="ANCHOR_SCROLL"
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
        <!-- Each card's anchor, which the outline scrolls to and focuses. -->
        <div
          v-for="key in cardKeys(section)"
          :id="settingAnchorId(key)"
          :key="key"
          role="group"
          :aria-labelledby="`param-title-${key}`"
          tabindex="-1"
          class="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          :class="ANCHOR_SCROLL"
        >
          <ParameterCard :param-key="key" :compact="compact" />
        </div>
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
