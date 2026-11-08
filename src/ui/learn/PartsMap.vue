<script setup>
/**
 * The "Start here" diagram of a guide (Design.md §5 "Learning pages >
 * Figures"): cards on a grid from their `col`/`row`, light bands behind
 * rows ("RAM", "DISK"), and labelled connectors between cards that share a
 * row or a column. From `md` up it is the grid, the connectors an absolutely
 * placed layer whose positions are CSS lengths built from the grid's equal
 * tracks and gaps (figureText.js edgeGeometry), so nothing is measured and no
 * guide sets a pixel. Below `md` the same data is a list: the cards by band,
 * then "A to B: label" rows. The root is one image named from the data; the
 * "Picture it" text follows it as ordinary text.
 */
import { computed } from 'vue'
import { cardGroups, edgeGeometry, edgeRows, formatValue, gridSize, partsMapLabel, probeRef } from './figureText.js'

const props = defineProps({
  /** PartsMap: { picture, cards, bands?, edges } */
  parts: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
})

// The gaps the connectors live in; the grid and the edge geometry share them.
const GAP_X = '4rem'
const GAP_Y = '3rem'
const BAND_LABEL = '7.5rem'

const size = computed(() => gridSize(props.parts))
const hasBands = computed(() => (props.parts.bands ?? []).length > 0)
const offset = computed(() => (hasBands.value ? 1 : 0))
const label = computed(() => partsMapLabel(props.parts, props.evidence))
const groups = computed(() => cardGroups(props.parts))
const rows = computed(() => edgeRows(props.parts))

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

const value = (card) => formatValue(props.evidence(probeRef(card.probe)))
const cardClass = (card) => (card.tone === 'fit' ? 'border-fit bg-fit-tint' : 'border-rule-strong bg-paper')
</script>

<template>
  <div class="learn-parts">
    <div role="img" :aria-label="label" data-figure="parts">
      <!-- md and up: the grid. -->
      <div aria-hidden="true" class="relative hidden md:grid" data-layout="grid" :style="gridStyle">
        <div
          v-for="band in parts.bands ?? []"
          :key="band.label"
          class="bg-paper-hover"
          :style="{ gridColumn: '1 / -1', gridRow: `${band.rows[0]} / ${band.rows[1] + 1}` }"
          data-band
        >
          <span class="block p-3 font-mono text-[13px] text-quiet">{{ band.label }}</span>
        </div>
        <div
          v-for="card in parts.cards"
          :key="card.id"
          class="relative z-[2] border p-3"
          :class="cardClass(card)"
          :style="{ gridColumn: card.col + offset, gridRow: card.row }"
          :data-card="card.id"
        >
          <p class="m-0 text-[15px] font-medium leading-snug text-ink">{{ card.title }}</p>
          <p class="m-0 mt-1 text-[13px] leading-snug text-ink-2">{{ card.does }}</p>
          <p v-if="card.probe" class="m-0 mt-2 font-mono text-[13px] text-ink-2">{{ value(card) }}</p>
        </div>
        <div class="pointer-events-none absolute inset-y-0 right-0 z-[1]" :style="overlayStyle">
          <div
            v-for="{ edge, geo } in edges"
            :key="`${edge.from}-${edge.to}`"
            class="absolute"
            :class="geo.axis === 'x' ? 'h-0 border-t border-ink-2' : 'w-0 border-l border-ink-2'"
            :style="geo.style"
            :data-edge="`${edge.from}-${edge.to}`"
          >
            <span
              class="absolute size-2 border-ink-2"
              :class="geo.axis === 'x'
                ? (geo.reverse ? 'left-0 top-0 -translate-y-1/2 -rotate-45 border-l border-t' : 'right-0 top-0 -translate-y-1/2 rotate-45 border-r border-t')
                : (geo.reverse ? 'left-0 top-0 -translate-x-1/2 rotate-45 border-l border-t' : 'bottom-0 left-0 -translate-x-1/2 rotate-45 border-b border-r')"
            />
            <span class="absolute left-1/2 top-1/2 z-[3] w-max max-w-[9rem] -translate-x-1/2 -translate-y-1/2 bg-paper px-1 text-center text-[13px] leading-snug text-ink-2">{{ edge.label }}</span>
          </div>
        </div>
      </div>
      <!-- Below md: the same data as a list. -->
      <div aria-hidden="true" class="md:hidden" data-layout="list">
        <div v-for="group in groups" :key="group.label ?? '-'" class="border-t border-rule py-2">
          <p v-if="group.label" class="m-0 font-mono text-[13px] text-quiet">{{ group.label }}</p>
          <ul class="m-0 list-none p-0">
            <li v-for="card in group.cards" :key="card.id" class="py-1 text-[15px] leading-snug" :class="card.tone === 'fit' ? 'border-l-2 border-fit pl-2' : ''">
              <span class="font-medium text-ink">{{ card.title }}</span>
              <span class="text-ink-2">: {{ card.does }}</span>
              <span v-if="card.probe" class="block font-mono text-[13px] text-ink-2">{{ value(card) }}</span>
            </li>
          </ul>
        </div>
        <ul v-if="rows.length" class="m-0 list-none border-t border-rule p-0 py-2">
          <li v-for="row in rows" :key="`${row.from}-${row.to}`" class="py-1 text-[15px] leading-snug text-ink-2">{{ row.text }}</li>
        </ul>
      </div>
    </div>
    <p v-if="parts.picture" class="m-0 mt-4 border-l-2 border-ink pl-3 text-[15px] leading-[1.55] text-ink-2">
      <span class="font-medium text-ink">Picture it: </span>{{ parts.picture }}
    </p>
  </div>
</template>
