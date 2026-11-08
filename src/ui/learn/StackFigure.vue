<script setup>
/**
 * A stack figure (Design.md §5 "Learning pages > Figures"): the layers of
 * one part of the machine as rows, top to bottom, a label column on the
 * left. A layer is either bands (stretches like "Above high / Low to high /
 * Below min") or nodes (boxes with an optional sub line and a measured
 * value), and may list values measured on the chosen kernel. `highlight` is
 * the selected pin's `layer`: a layer, band or node id, drawn in `fit-tint`
 * with a `fit` mark. Below `md` the label sits over its row and the bands
 * stack, so the figure reads as a list. One image, named from the data.
 */
import { computed } from 'vue'
import { formatValue, measuredOn, measuredText, probeRef, refName, stackLabel, stackRefs } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'stack' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** The selected pin's `layer`, or null. */
  highlight: { type: String, default: null },
})

const label = computed(() => stackLabel(props.figure, props.evidence, props.highlight))
const caption = computed(() => measuredOn(stackRefs(props.figure), props.evidence, props.imageId))
const on = (id) => id === props.highlight
const SELECTED = 'border-fit bg-fit-tint'
const PLAIN = 'border-rule-strong bg-paper'
</script>

<template>
  <div>
    <div role="img" :aria-label="label" data-figure="stack">
      <ol aria-hidden="true" class="m-0 list-none border-t border-ink p-0">
        <li
          v-for="layer in figure.layers"
          :key="layer.id"
          class="grid grid-cols-1 gap-2 border-b border-rule py-3 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-4"
          :class="on(layer.id) ? 'bg-fit-tint' : ''"
          :data-layer="layer.id"
          :data-selected="on(layer.id) || undefined"
        >
          <p class="m-0 text-[13px] font-medium leading-snug" :class="on(layer.id) ? 'border-l-4 border-fit pl-2 text-ink' : 'text-quiet'">{{ layer.label }}</p>
          <div class="min-w-0">
            <div v-if="layer.kind === 'bands'" class="flex flex-col gap-px md:flex-row">
              <div
                v-for="band in layer.bands ?? []"
                :key="band.id"
                class="min-w-0 flex-1 border px-3 py-2 text-[15px] leading-snug text-ink"
                :class="on(band.id) ? SELECTED : PLAIN"
                :data-band="band.id"
                :data-selected="on(band.id) || undefined"
              >{{ band.text }}</div>
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <div
                v-for="node in layer.nodes ?? []"
                :key="node.id"
                class="min-w-[8rem] border px-3 py-2"
                :class="on(node.id) ? SELECTED : PLAIN"
                :data-node="node.id"
                :data-selected="on(node.id) || undefined"
              >
                <p class="m-0 text-[15px] font-medium leading-snug text-ink">{{ node.text }}</p>
                <p v-if="node.sub" class="m-0 text-[13px] leading-snug text-ink-2">{{ node.sub }}</p>
                <p v-if="node.probe" class="m-0 mt-1 font-mono text-[13px] text-ink-2">{{ formatValue(evidence(probeRef(node.probe))) }}</p>
              </div>
            </div>
            <ul v-if="layer.values?.length" class="m-0 mt-2 flex list-none flex-wrap gap-x-4 p-0 font-mono text-[13px] text-ink-2">
              <li v-for="vref in layer.values" :key="refName(vref)">{{ measuredText(vref, evidence) }}</li>
            </ul>
          </div>
        </li>
      </ol>
    </div>
    <p v-if="caption" class="m-0 mt-2 text-[13px] text-quiet">{{ figure.title }}. {{ caption }}</p>
    <p v-else class="m-0 mt-2 text-[13px] text-quiet">{{ figure.title }}.</p>
  </div>
</template>
