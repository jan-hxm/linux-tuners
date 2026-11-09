<script setup>
/**
 * A compare figure (Design.md §5 "Learning pages > Figures"): horizontal
 * bars, one per item, on one shared scale drawn from the evidence on the
 * chosen image (figureText.js compareModel), `linear` or `log`. Each bar has
 * a short label (a tooltip button where it has `does`) and its value; a bar
 * not measured on this image keeps its row as a dashed, labelled gap, never
 * a zero bar. `marks` are vertical lines across every bar (a limit), named
 * above the bars, and `groups` are headings over their bars. Settings drawn
 * on the figure (`pins`) are pressed-state buttons beside their bar or mark
 * from `md` up; the row under the figure has them below `md`.
 *
 * From `md` up a row is label, track, value; below `md` the label and value
 * sit over a full-width track, so nothing scrolls sideways. Tick and mark
 * labels near an end are anchored inside the track. The root is a figure
 * named from the data.
 */
import { computed, useId } from 'vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import FigurePin from './FigurePin.vue'
import { compareAxisText, compareCaption, compareLabel, compareModel, comparePinPlace, defName, tipValue } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'compare' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** How many images measured every value the same (sameOnEveryImage), or 0. */
  sameOn: { type: Number, default: 0 },
  /** The selected pin's `layer`: a bar, mark or group id. */
  highlight: { type: String, default: null },
  /** The selected pin's key: its button on the figure is pressed. */
  selectedKey: { type: String, default: null },
  defsByKey: { type: Object, default: () => ({}) },
  /** The id of the panel a pin button controls. */
  controls: { type: String, default: null },
})
const emit = defineEmits(['select'])

const scope = useId()
const model = computed(() => compareModel(props.figure, props.evidence))
const label = computed(() => compareLabel(props.figure, props.evidence, { defsByKey: props.defsByKey, highlight: props.highlight }))
const caption = computed(() => compareCaption(props.figure, props.evidence, props.imageId, props.sameOn))
const axis = computed(() => compareAxisText(props.figure, model.value))
const barPins = computed(() => (props.figure.pins ?? []).filter((p) => p.bar))
// Every row shares one set of columns, so every track has the same width.
// A setting drawn on a bar sits under its value, so the value column is as
// wide as the longest such name (13px mono is about half a rem a character,
// plus the dot and padding), and 7rem without one.
const valueCol = computed(() => `${Math.max(7, ...barPins.value.map((p) => defName(p.key, props.defsByKey).length * 0.5 + 2.75))}rem`)
const ROW = 'md:grid-cols-[9rem_minmax(0,1fr)_var(--value-col)]'

const pct = (x) => `${x * 100}%`
/**
 * A mark's name at x, in the flow so it wraps instead of leaving the track:
 * starting at x in the left part of the track, ending at x in the right part.
 */
const anchored = (x) => (x > 0.55 ? { marginRight: pct(1 - x), justifyContent: 'flex-end' } : { marginLeft: pct(x) })
/** A tick label centred on x, or held inside the track at the ends. */
const tickStyle = (x) => (x < 0.06 ? { left: '0' } : x > 0.94 ? { right: '0' } : { left: pct(x), transform: 'translateX(-50%)' })
const BAR_FILL = { fit: 'bg-fit', error: 'bg-error' }
const MARK_LINE = { fit: 'bg-fit', error: 'bg-error' }
const MARK_TEXT = { fit: 'text-fit-text', error: 'text-error' }
const on = (id) => id !== null && id === props.highlight
const tipOf = (x) => tipValue(x.value, props.evidence, props.sameOn)
const pinLabel = (key) => {
  const pin = (props.figure.pins ?? []).find((p) => p.key === key)
  return `${defName(key, props.defsByKey)}, ${comparePinPlace(props.figure, pin)}`
}
</script>

<template>
  <div>
    <div role="figure" :aria-label="label" data-figure="compare" :data-measured="model.measured || undefined" :data-scale="figure.scale" :style="{ '--value-col': valueCol }">
      <!-- The marks' names, one line each, at their place on the scale. -->
      <div v-for="m in model.marks" :key="`m${m.id}`" class="grid grid-cols-1 gap-x-3" :class="ROW" :data-mark-row="m.id">
        <span aria-hidden="true" class="hidden md:block" />
        <div class="min-w-0 pb-1 pt-2">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1" :style="m.x === null ? null : anchored(m.x)">
            <FigureTip
              v-if="m.does"
              :label="m.label"
              :tip="m.does"
              :value="tipOf(m)"
              :scope="scope"
              class="inline-flex min-h-6 items-baseline gap-1.5 text-left text-[15px] leading-none underline decoration-dotted underline-offset-4"
              :class="[MARK_TEXT[m.tone] ?? 'text-ink', on(m.id) ? 'font-semibold' : 'font-medium']"
              :data-mark-label="m.id"
            >{{ m.label }}<span class="font-mono text-[13px] text-ink-2 no-underline">{{ m.text }}</span></FigureTip>
            <span v-else aria-hidden="true" class="inline-flex min-h-6 items-baseline gap-1.5 text-[15px] font-medium leading-none" :class="MARK_TEXT[m.tone] ?? 'text-ink'" :data-mark-label="m.id">{{ m.label }}<span class="font-mono text-[13px] text-ink-2">{{ m.text }}</span></span>
            <FigurePin
              v-for="key in m.pins"
              :key="key"
              class="hidden md:inline-flex"
              :name="defName(key, defsByKey)"
              :label="pinLabel(key)"
              :pressed="key === selectedKey"
              :controls="controls"
              :data-figure-pin="key"
              @select="emit('select', key)"
            />
          </div>
        </div>
      </div>

      <div v-for="g in model.groups" :key="g.id ?? 'all'" :class="g.id && on(g.id) ? 'bg-fit-tint' : ''" :data-group="g.id ?? undefined">
        <div v-if="g.label" class="pb-1 pt-3" :class="on(g.id) ? 'border-l-4 border-fit pl-2' : ''">
          <FigureTip
            v-if="g.does"
            :label="g.label"
            :tip="g.does"
            :scope="scope"
            class="inline-flex min-h-6 items-center text-left text-[13px] font-medium text-ink-2 underline decoration-dotted underline-offset-4"
          >{{ g.label }}</FigureTip>
          <span v-else aria-hidden="true" class="text-[13px] font-medium text-ink-2">{{ g.label }}</span>
        </div>
        <div
          v-for="b in g.bars"
          :key="b.id"
          class="grid grid-cols-1 items-center gap-x-3"
          :class="[ROW, on(b.id) ? 'bg-fit-tint' : '']"
          :data-bar="b.id"
          :data-status="b.status"
          :data-selected="on(b.id) || undefined"
        >
          <div class="flex min-w-0 items-baseline justify-between gap-3 pt-1 md:pt-0">
            <FigureTip
              v-if="b.does"
              :label="b.label"
              :tip="b.does"
              :value="tipOf(b)"
              :scope="scope"
              class="inline-flex min-h-6 items-center text-left text-[15px] leading-snug text-ink underline decoration-dotted underline-offset-4"
              :data-bar-label="b.id"
            >{{ b.label }}</FigureTip>
            <span v-else aria-hidden="true" class="text-[15px] leading-snug text-ink" :data-bar-label="b.id">{{ b.label }}</span>
            <span aria-hidden="true" class="font-mono text-[13px] text-ink-2 md:hidden">{{ b.text }}</span>
          </div>
          <div aria-hidden="true" class="relative h-9" data-track>
            <span v-for="t in model.ticks" :key="`g${t.value}`" class="absolute inset-y-0 w-px bg-rule" :style="{ left: pct(t.x) }" />
            <span class="absolute inset-y-0 left-0 w-[1.5px] bg-ink" />
            <div
              v-if="b.x !== null"
              class="absolute inset-y-2 left-0 border-[1.5px] border-ink"
              :class="BAR_FILL[b.tone] ?? 'bg-ink'"
              :style="{ width: pct(b.x) }"
              data-bar-fill
            />
            <div
              v-else
              class="absolute inset-y-2 left-0 right-0 flex items-center truncate border-[1.5px] border-dashed border-rule-strong px-2 text-[13px] leading-none text-ink-2"
              data-bar-gap
            >{{ b.text }}</div>
            <span
              v-for="m in model.marks.filter((x) => x.x !== null)"
              :key="`l${m.id}`"
              class="absolute inset-y-0 -translate-x-1/2"
              :class="[on(m.id) ? 'w-[3px] bg-fit' : `w-0.5 ${MARK_LINE[m.tone] ?? 'bg-ink'}`]"
              :style="{ left: pct(m.x) }"
              data-mark-line
            />
          </div>
          <div class="hidden flex-col items-start gap-1 py-1 md:flex">
            <span aria-hidden="true" class="font-mono text-[13px] text-ink-2" data-bar-value>{{ b.text }}</span>
            <FigurePin
              v-for="key in b.pins"
              :key="key"
              :name="defName(key, defsByKey)"
              :label="pinLabel(key)"
              :pressed="key === selectedKey"
              :controls="controls"
              :data-figure-pin="key"
              @select="emit('select', key)"
            />
          </div>
        </div>
      </div>

      <!-- The shared scale under the bars. -->
      <div v-if="model.ticks.length" aria-hidden="true" class="grid grid-cols-1 gap-x-3" :class="ROW">
        <span class="hidden md:block" />
        <div class="relative h-6 border-t-[1.5px] border-ink">
          <template v-for="t in model.ticks" :key="`t${t.value}`">
            <span class="absolute top-0 h-1.5 w-px bg-ink" :style="{ left: pct(t.x) }" />
            <span class="absolute top-1.5 whitespace-nowrap font-mono text-[13px] leading-none text-ink-2" :style="tickStyle(t.x)" data-tick>{{ t.text }}</span>
          </template>
        </div>
      </div>
      <p aria-hidden="true" class="m-0 mt-1 text-[13px] text-ink-2 md:pl-[9.75rem]" data-axis>{{ axis }}</p>
      <TipStrip :scope="scope" />
    </div>
    <p class="m-0 mt-3 text-[13px] text-ink-2">{{ caption }}</p>
  </div>
</template>
