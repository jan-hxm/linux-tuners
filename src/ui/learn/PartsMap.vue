<script setup>
/**
 * The "Start here" diagram of a guide (Design.md §5 "Learning pages >
 * Figures"): cards on a grid from their `col`/`row`, light bands behind
 * rows ("RAM", "Disk"), and labelled connectors between cards that share a
 * row or a column. A card shows its title and, where measured, its value;
 * what it does is its tooltip (FigureTip), the card itself being the
 * button. From `md` up it is the grid, the connectors an absolutely placed
 * layer whose positions are CSS lengths built from the grid's equal tracks
 * and gaps (figureText.js edgeGeometry), so nothing is measured and no guide
 * sets a pixel. Below `md` the same data is a list: the cards by band, then
 * "A to B: label" rows, and the open tooltip shows as a strip under it.
 *
 * An optional scale bar (`parts.scale`) follows, drawn to scale from the
 * evidence: each measured segment its share of the total, the rest hatched,
 * the legend entries tooltip buttons. The root is a figure named from the
 * data; everything but the buttons is hidden from assistive technology.
 */
import { computed, useId } from 'vue'
import RichText from '@/ui/RichText.vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import {
  cardGroups, edgeGeometry, edgeRows, gridSize, itemRef, partsMapLabel, shownItemValue, percent, scaleModel, tipValue,
} from './figureText.js'

const props = defineProps({
  /** PartsMap: { picture, cards, bands?, edges, scale? } */
  parts: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
})

const scope = useId()

// The gaps the connectors live in; the grid and the edge geometry share them.
const GAP_X = '5rem'
const GAP_Y = '2.5rem'
const BAND_LABEL = '6rem'

const size = computed(() => gridSize(props.parts))
const hasBands = computed(() => (props.parts.bands ?? []).length > 0)
const offset = computed(() => (hasBands.value ? 1 : 0))
const label = computed(() => partsMapLabel(props.parts, props.evidence))
const groups = computed(() => cardGroups(props.parts))
const rows = computed(() => edgeRows(props.parts))
const scale = computed(() => (props.parts.scale ? scaleModel(props.parts.scale, props.evidence) : null))

const gridStyle = computed(() => ({
  gridTemplateColumns: `${hasBands.value ? `${BAND_LABEL} ` : ''}repeat(${size.value.cols}, minmax(0, 1fr))`,
  gridAutoRows: '1fr',
  columnGap: GAP_X,
  rowGap: GAP_Y,
}))
const overlayStyle = computed(() => ({ left: hasBands.value ? `calc(${BAND_LABEL} + ${GAP_X})` : '0' }))

const edges = computed(() =>
  rows.value
    .map((edge) => ({ edge, geo: edgeGeometry(props.parts, edge, GAP_X, GAP_Y) }))
    .filter((e) => e.geo),
)

const value = (card) => shownItemValue(card, props.evidence)
const cardValue = (card) => (card.probe ? tipValue(itemRef(card), props.evidence) : '')
const cardClass = (card) => (card.tone === 'fit' ? 'border-fit bg-fit-tint' : 'border-ink bg-paper hover:bg-paper-hover')
const SWATCH = { ink: 'bg-ink', fit: 'bg-fit', quiet: 'bg-quiet' }
const HATCH = 'repeating-linear-gradient(135deg, rgb(var(--t-paper)) 0 6px, rgb(var(--t-rule-strong)) 6px 7px)'
const segValue = (seg) => (seg.ref ? tipValue(seg.ref, props.evidence) : '')
</script>

<template>
  <div class="learn-parts">
    <div role="figure" :aria-label="label" data-figure="parts">
      <!-- md and up: the grid. -->
      <div class="relative hidden md:grid" data-layout="grid" :style="gridStyle">
        <div
          v-for="band in parts.bands ?? []"
          :key="band.label"
          aria-hidden="true"
          class="bg-paper-hover"
          :style="{ gridColumn: '1 / -1', gridRow: `${band.rows[0]} / ${band.rows[1] + 1}` }"
          data-band
        >
          <span class="block p-3 font-mono text-[13px] text-ink-2">{{ band.label }}</span>
        </div>
        <FigureTip
          v-for="card in parts.cards"
          :key="card.id"
          :label="card.title"
          :tip="card.does"
          :value="cardValue(card)"
          :scope="scope"
          class="relative z-[2] flex min-h-14 flex-col items-start justify-center border-[1.5px] px-4 py-2 text-left"
          :class="cardClass(card)"
          :style="{ gridColumn: card.col + offset, gridRow: card.row }"
          :data-card="card.id"
        >
          <span class="text-[16px] font-medium leading-snug text-ink">{{ card.title }}</span>
          <span v-if="value(card)" class="font-mono text-[13px] text-ink-2">{{ value(card) }}</span>
        </FigureTip>
        <div aria-hidden="true" class="pointer-events-none absolute inset-y-0 right-0 z-[1]" :style="overlayStyle">
          <div
            v-for="{ edge, geo } in edges"
            :key="`${edge.from}-${edge.to}`"
            class="absolute"
            :class="geo.axis === 'x' ? 'h-0 border-t-[1.5px] border-ink' : 'w-0 border-l-[1.5px] border-ink'"
            :style="geo.style"
            :data-edge="`${edge.from}-${edge.to}`"
          >
            <span
              class="absolute size-2 border-ink"
              :class="geo.axis === 'x'
                ? (geo.reverse ? 'left-0 top-0 -translate-y-1/2 -rotate-45 border-l-[1.5px] border-t-[1.5px]' : 'right-0 top-0 -translate-y-1/2 rotate-45 border-r-[1.5px] border-t-[1.5px]')
                : (geo.reverse ? 'left-0 top-0 -translate-x-1/2 rotate-45 border-l-[1.5px] border-t-[1.5px]' : 'bottom-0 left-0 -translate-x-1/2 rotate-45 border-b-[1.5px] border-r-[1.5px]')"
            />
            <!-- A row edge's label wraps inside the gap, so a card never covers it. -->
            <span
              class="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 bg-paper px-1 text-center text-[13px] leading-snug text-ink-2"
              :class="geo.axis === 'x' ? 'w-full' : 'w-max max-w-[9rem]'"
            >{{ edge.label }}</span>
          </div>
        </div>
      </div>
      <!-- Below md: the same data as a list. -->
      <div class="md:hidden" data-layout="list">
        <div v-for="(group, gi) in groups" :key="group.label ?? `rest-${gi}`" class="border-t border-rule py-2">
          <p v-if="group.label" aria-hidden="true" class="m-0 font-mono text-[13px] text-ink-2">{{ group.label }}</p>
          <ul class="m-0 list-none p-0">
            <li v-for="card in group.cards" :key="card.id" class="py-1" :class="card.tone === 'fit' ? 'border-l-2 border-fit pl-2' : ''">
              <FigureTip
                :label="card.title"
                :tip="card.does"
                :value="cardValue(card)"
                :scope="scope"
                class="inline-flex min-h-6 flex-wrap items-baseline gap-x-2 text-left text-[15px] leading-snug underline decoration-dotted underline-offset-4"
              >
                <span class="font-medium text-ink">{{ card.title }}</span>
                <span v-if="value(card)" class="font-mono text-[13px] text-ink-2">{{ value(card) }}</span>
              </FigureTip>
            </li>
          </ul>
        </div>
        <ul v-if="rows.length" aria-hidden="true" class="m-0 list-none border-t border-rule p-0 py-2">
          <li v-for="row in rows" :key="`${row.from}-${row.to}`" class="py-1 text-[15px] leading-snug text-ink-2">{{ row.text }}</li>
        </ul>
      </div>

      <div v-if="scale" class="mt-8" data-scale>
        <p aria-hidden="true" class="m-0 mb-1.5 flex justify-between gap-3 text-[15px]">
          <span class="font-medium text-ink">{{ scale.label }}, to scale</span>
          <span class="font-mono text-[13px] text-ink-2" data-scale-total>{{ scale.totalText }}</span>
        </p>
        <div aria-hidden="true" class="flex h-11 border-[1.5px] border-ink" data-scale-bar>
          <template v-if="scale.total !== null">
            <span
              v-for="seg in scale.segments.filter((x) => !x.rest)"
              :key="seg.id"
              :class="SWATCH[seg.tone]"
              :style="{ width: `${(seg.share ?? 0) * 100}%`, minWidth: seg.share ? '2px' : '0' }"
              :data-segment="seg.id"
            />
          </template>
          <span class="flex-1" :style="{ background: HATCH }" />
        </div>
        <ul class="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-[15px] text-ink">
          <li v-for="seg in scale.segments" :key="seg.id" class="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              class="inline-block size-3 shrink-0"
              :class="seg.rest ? 'border border-ink-2' : SWATCH[seg.tone]"
              :style="seg.rest ? { background: HATCH } : null"
            />
            <FigureTip
              v-if="seg.does || !seg.rest"
              :label="seg.label"
              :tip="seg.does ?? ''"
              :value="segValue(seg)"
              :scope="scope"
              class="inline-flex min-h-6 items-center gap-1.5 text-left underline decoration-dotted underline-offset-4"
              :data-legend="seg.id"
            >
              {{ seg.label }}<span v-if="!seg.rest" class="font-mono text-[13px] text-ink-2">{{ seg.text }}<template v-if="seg.share !== null">, {{ percent(seg.share) }}</template></span>
            </FigureTip>
            <span v-else :data-legend="seg.id">{{ seg.label }}</span>
          </li>
        </ul>
      </div>
      <TipStrip :scope="scope" />
    </div>
    <p v-if="parts.picture" class="m-0 mt-6 border-l-2 border-ink pl-3 text-[15px] leading-[1.55] text-ink-2">
      <span class="font-medium text-ink">Picture it: </span><RichText :text="parts.picture" />
    </p>
  </div>
</template>
