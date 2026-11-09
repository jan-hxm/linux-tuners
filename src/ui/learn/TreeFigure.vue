<script setup>
/**
 * A tree figure (Design.md §5 "Learning pages > Figures"): a small hierarchy
 * (at most 3 levels and 12 nodes, such as systemd's slices) drawn as an
 * indented tree with connector lines. Each node is a box with a short label
 * and, where it has one, its value on the chosen image; a node with `does` is
 * a FigureTip, the box being the button. Settings drawn on the tree (`pins`)
 * are pressed-state buttons beside their node from `md` up; the row under
 * the figure has them below `md`. The indent is small enough for a phone,
 * so the same drawing serves every width. The root is a figure named from
 * the data.
 */
import { computed, useId } from 'vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import FigurePin from './FigurePin.vue'
import { defName, tipValue, treeCaption, treeLabel, treeNodes, treePinPlace, treeValue } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'tree' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** The image's name as the reader sees it (Debian 13), for the caption; the id when unset. */
  imageLabel: { type: String, default: '' },
  /** How many images measured every value the same (sameOnEveryImage), or 0. */
  sameOn: { type: Number, default: 0 },
  /** The selected pin's `layer`: a node id. */
  highlight: { type: String, default: null },
  /** The selected pin's key: its button on the tree is pressed. */
  selectedKey: { type: String, default: null },
  defsByKey: { type: Object, default: () => ({}) },
  /** The id of the panel a pin button controls. */
  controls: { type: String, default: null },
})
const emit = defineEmits(['select'])

const scope = useId()
const nodes = computed(() => treeNodes(props.figure))
const label = computed(() => treeLabel(props.figure, props.evidence, { defsByKey: props.defsByKey, highlight: props.highlight }))
const caption = computed(() => treeCaption(props.figure, props.evidence, (props.imageLabel || props.imageId), props.sameOn))
const pinsOn = (id) => (props.figure.pins ?? []).filter((p) => p.node === id)

/** Indent per level, and where a level's connector line runs, in rem. */
const INDENT = 1.75
const lineX = (level) => `${(level - 1) * INDENT + 0.625}rem`
const on = (id) => id === props.highlight
const BOX = 'inline-flex min-w-[7rem] flex-col items-start border-[1.5px] px-3 py-1.5 text-left'
const valueOf = (n) => (n.value ? tipValue(n.value, props.evidence, props.sameOn) : '')
</script>

<template>
  <div>
    <div role="figure" :aria-label="label" data-figure="tree">
      <div
        v-for="n in nodes"
        :key="n.id"
        class="relative flex flex-wrap items-center gap-2 py-1"
        :style="{ paddingLeft: `${n.depth * INDENT}rem` }"
        :data-node="n.id"
        :data-depth="n.depth"
        :data-selected="on(n.id) || undefined"
      >
        <!-- Connectors: the lines of the levels above that run on, then this node's elbow. -->
        <template v-if="n.depth > 0">
          <template v-for="(runs, i) in n.rails" :key="`r${i}`">
            <span v-if="runs" aria-hidden="true" class="absolute inset-y-0 w-[1.5px] bg-ink" :style="{ left: lineX(i + 1) }" />
          </template>
          <span aria-hidden="true" class="absolute top-0 w-[1.5px] bg-ink" :class="n.last ? 'h-1/2' : 'h-full'" :style="{ left: lineX(n.depth) }" />
          <span aria-hidden="true" class="absolute top-1/2 h-[1.5px] bg-ink" :style="{ left: lineX(n.depth), width: `${INDENT - 0.625}rem` }" />
        </template>
        <FigureTip
          v-if="n.does"
          :label="n.label"
          :tip="n.does"
          :value="valueOf(n)"
          :scope="scope"
          :class="[BOX, on(n.id) ? 'border-fit bg-fit-tint' : 'border-ink bg-paper hover:bg-paper-hover']"
          :data-node-box="n.id"
        >
          <span class="text-[15px] leading-snug text-ink underline decoration-dotted underline-offset-4" :class="n.depth === 0 ? 'font-semibold' : 'font-medium'">{{ n.label }}</span>
          <span v-if="treeValue(n, evidence)" class="font-mono text-[13px] text-ink-2">{{ treeValue(n, evidence) }}</span>
        </FigureTip>
        <span v-else aria-hidden="true" :class="[BOX, on(n.id) ? 'border-fit bg-fit-tint' : 'border-ink bg-paper']" :data-node-box="n.id">
          <span class="text-[15px] leading-snug text-ink" :class="n.depth === 0 ? 'font-semibold' : 'font-medium'">{{ n.label }}</span>
          <span v-if="treeValue(n, evidence)" class="font-mono text-[13px] text-ink-2">{{ treeValue(n, evidence) }}</span>
        </span>
        <FigurePin
          v-for="p in pinsOn(n.id)"
          :key="p.key"
          class="hidden md:inline-flex"
          :name="defName(p.key, defsByKey)"
          :label="`${defName(p.key, defsByKey)}, ${treePinPlace(figure, p)}`"
          :pressed="p.key === selectedKey"
          :controls="controls"
          :data-figure-pin="p.key"
          @select="emit('select', p.key)"
        />
      </div>
      <TipStrip :scope="scope" />
    </div>
    <p class="m-0 mt-3 text-[13px] text-ink-2">{{ caption }}</p>
  </div>
</template>
