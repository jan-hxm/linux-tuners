<script setup>
/**
 * A schematic timeline (Design.md §5 "Learning pages > Figures"): the curve
 * is an SVG path from the guide's `curve` points (0..1 each), the lines are
 * dashed, spaced evenly in the order listed (figureText.js lineLevels) and
 * labelled with their measured values, and each event is a numbered tick
 * whose words are listed under the plot in time order. The caption says it
 * is schematic: only the shape and the order mean anything, never the
 * distances. One image, named from the data.
 */
import { computed } from 'vue'
import { curvePath, formatValue, lineLevels, measuredOn, sameOnText, timelineLabel } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'timeline' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** How many images measured every value the same (sameOnEveryImage), or 0. */
  sameOn: { type: Number, default: 0 },
  /** The selected pin's `layer`: a line id draws that line in `fit`. */
  highlight: { type: String, default: null },
})

const label = computed(() => timelineLabel(props.figure, props.evidence))
const path = computed(() => curvePath(props.figure.curve))
const lines = computed(() => {
  const levels = lineLevels(props.figure.lines)
  return props.figure.lines.map((line, i) => ({
    ...line,
    y: (1 - levels[i]) * 100,
    text: `${line.label}: ${formatValue(props.evidence(line.value), line.value.unit)}`,
  }))
})
const events = computed(() =>
  [...props.figure.events].sort((a, b) => a.at - b.at).map((e, i) => ({ ...e, n: i + 1, x: e.at * 100 })),
)
const caption = computed(() => (props.sameOn ? sameOnText(props.sameOn) : measuredOn(props.figure.lines.map((l) => l.value), props.evidence, props.imageId)))

const TONE_STROKE = { fit: 'stroke-fit', error: 'stroke-error' }
const TONE_TEXT = { fit: 'text-fit-text', error: 'text-error' }
const TONE_BORDER = { fit: 'border-fit', error: 'border-error' }
</script>

<template>
  <div>
    <div role="img" :aria-label="label" data-figure="timeline">
      <div aria-hidden="true">
        <div class="relative h-48 border-b border-l border-ink">
          <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              v-for="line in lines"
              :key="line.id"
              x1="0" x2="100" :y1="line.y" :y2="line.y"
              :class="line.id === highlight ? 'stroke-fit' : 'stroke-ink-2'"
              stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"
              :data-line="line.id"
            />
            <line
              v-for="e in events"
              :key="`e${e.n}`"
              :x1="e.x" :x2="e.x" y1="0" y2="100"
              :class="TONE_STROKE[e.tone] ?? 'stroke-quiet'"
              stroke-width="1" vector-effect="non-scaling-stroke"
              :data-event="e.n"
            />
            <path :d="path" fill="none" class="stroke-fit" stroke-width="2.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" data-curve />
          </svg>
          <span
            v-for="line in lines"
            :key="`l-${line.id}`"
            class="absolute right-1 -translate-y-full bg-paper px-1 font-mono text-[13px] leading-tight"
            :class="line.id === highlight ? 'text-fit-text' : 'text-ink-2'"
            :style="{ top: `${line.y}%` }"
          >{{ line.text }}</span>
          <span
            v-for="e in events"
            :key="`n${e.n}`"
            class="absolute -bottom-3 inline-flex size-6 -translate-x-1/2 items-center justify-center border bg-paper font-mono text-[13px]"
            :class="[TONE_BORDER[e.tone] ?? 'border-rule-strong', TONE_TEXT[e.tone] ?? 'text-ink']"
            :style="{ left: `${e.x}%` }"
          >{{ e.n }}</span>
        </div>
        <ol class="m-0 mt-6 list-none p-0 text-[15px] leading-snug text-ink-2">
          <li v-for="e in events" :key="`t${e.n}`" class="flex gap-2 py-0.5">
            <span class="font-mono" :class="TONE_TEXT[e.tone] ?? 'text-ink'">{{ e.n }}</span>
            <span :class="e.tone === 'error' ? 'text-error' : ''">{{ e.label }}</span>
          </li>
        </ol>
      </div>
    </div>
    <p class="m-0 mt-2 text-[13px] text-quiet">{{ figure.title }}. Schematic: the shape and the order are real, the distances are not.<template v-if="caption"> {{ caption }}</template></p>
  </div>
</template>
