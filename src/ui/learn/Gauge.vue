<script setup>
/**
 * A gauge (Design.md §5 "Learning pages > Figures"): a vertical scale drawn
 * to scale from the evidence on the chosen image (figureText.js gaugeModel).
 * Marks are lines with a short label and their value, zones the fills
 * between them (`fit` tint, an `error` hatch, or plain), each named in two
 * or three words with its sentence in a tooltip (FigureTip). A `zoom` adds
 * a thin bar of the whole range beside it, a bracket on the part drawn
 * large and dashed lines from the bracket to the scale. Settings drawn on
 * the scale (`pins`) are pressed-state buttons on their mark or on a bar
 * over their gap; they select the chapter's pin like the row under the
 * figure, which shows them instead below `md`. A `curve` is drawn beside
 * the scale on the same heights, with the marks as dashed lines, its
 * numbered events listed under it, and "time (schematic)" under its axis.
 *
 * A mark not measured on this image turns the whole gauge into a labelled
 * schematic: marks evenly spaced, no ticks, no bracket, and "not measured"
 * where a number would be. The root is a figure named from the data.
 */
import { computed, useId } from 'vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import { defName, gaugeAxisText, gaugeCaption, gaugeLabel, gaugeModel, gaugePinPlace, tipValue } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'gauge' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** How many images measured every value the same (sameOnEveryImage), or 0. */
  sameOn: { type: Number, default: 0 },
  /** The selected pin's `layer`: a mark or zone id. */
  highlight: { type: String, default: null },
  /** The selected pin's key: its button on the scale is pressed. */
  selectedKey: { type: String, default: null },
  /** The tuner's defs, for the pins' names. */
  defsByKey: { type: Object, default: () => ({}) },
  /** The id of the panel a pin button controls. */
  controls: { type: String, default: null },
})
const emit = defineEmits(['select'])

const scope = useId()
const model = computed(() => gaugeModel(props.figure, props.evidence))
const label = computed(() => gaugeLabel(props.figure, props.evidence, { defsByKey: props.defsByKey, highlight: props.highlight }))
const caption = computed(() => gaugeCaption(props.figure, props.evidence, props.imageId, props.sameOn))
const axis = computed(() => gaugeAxisText(props.figure, model.value))
const zonesTopDown = computed(() => [...model.value.zones].sort((a, b) => b.y1 - a.y1 || b.y0 - a.y0))

const top = (y) => `${(1 - y) * 100}%`
const hasZoom = computed(() => !!model.value.zoom)
// Columns of the scale block, in rem: zoom bar, its connector, ticks, the gauge, the mark labels.
const X = computed(() => {
  const zoom = hasZoom.value ? 2.75 : 0
  return { ticks: zoom, gauge: zoom + 3.5, labels: zoom + 7.5, width: zoom + 14 }
})
const rem = (n) => `${n}rem`

const HATCH_ERROR = 'repeating-linear-gradient(135deg, rgb(var(--t-paper)) 0 5px, rgb(var(--t-error)) 5px 6.5px)'
const HATCH_RULE = 'repeating-linear-gradient(135deg, rgb(var(--t-paper)) 0 6px, rgb(var(--t-rule-strong)) 6px 7px)'
const zoneFill = (z) => (z.tone === 'error' ? { background: HATCH_ERROR } : null)
const zoneClass = (z) => [z.tone === 'fit' ? 'bg-fit-tint' : '', z.id === props.highlight ? 'outline outline-2 -outline-offset-2 outline-fit' : '']
const ZONE_TEXT = { fit: 'text-fit-text', error: 'text-error' }
const MARK_LINE = { fit: 'bg-fit', error: 'bg-error' }
const markLine = (m) => (m.id === props.highlight ? 'h-[3px] bg-fit' : `h-0.5 ${MARK_LINE[m.tone] ?? 'bg-ink'}`)
const markValue = (m) => tipValue(m.value, props.evidence, props.sameOn)
const pinName = (p) => defName(p.key, props.defsByKey)
const pinLabel = (p) => `${pinName(p)}, ${gaugePinPlace(props.figure, p)}`
</script>

<template>
  <div>
    <div role="figure" :aria-label="label" data-figure="gauge" :data-measured="model.measured || undefined">
      <div class="flex flex-wrap items-start gap-x-6 gap-y-8">
        <!-- The scale: zoom bar, ticks, the gauge and its marks. -->
        <div class="shrink-0">
          <div class="relative h-80" :style="{ width: rem(X.width) }" data-scale>
            <template v-if="model.zoom">
              <div aria-hidden="true" class="absolute inset-y-0 left-0 w-3 border-[1.5px] border-ink" :style="{ background: HATCH_RULE }" data-zoom-bar />
              <template v-if="model.zoom.bracket">
                <div
                  aria-hidden="true"
                  class="absolute -left-1 w-5 border-[1.5px] border-fit"
                  :style="{ bottom: `${model.zoom.bracket.y0 * 100}%`, height: `${(model.zoom.bracket.y1 - model.zoom.bracket.y0) * 100}%`, minHeight: '6px' }"
                  data-zoom-bracket
                />
                <svg aria-hidden="true" class="absolute inset-y-0 left-3 h-full overflow-visible" :style="{ width: rem(X.gauge - 0.75) }" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1="0" :y1="(1 - model.zoom.bracket.y1) * 100" x2="100" y2="0" class="stroke-fit" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
                  <line x1="0" :y1="(1 - model.zoom.bracket.y0) * 100" x2="100" y2="100" class="stroke-fit" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
                </svg>
              </template>
            </template>
            <span
              v-for="t in model.ticks"
              :key="`t${t.value}`"
              aria-hidden="true"
              class="absolute -translate-y-1/2 pr-2 text-right font-mono text-[13px] leading-none text-ink-2"
              :style="{ top: top(t.y), left: rem(X.ticks), width: rem(3.5) }"
              data-tick
            >{{ t.text }}</span>
            <div aria-hidden="true" class="absolute inset-y-0 border-[1.5px] border-ink bg-paper" :style="{ left: rem(X.gauge), width: rem(3.5) }" data-gauge>
              <div
                v-for="z in model.zones"
                :key="z.id"
                class="absolute inset-x-0"
                :class="zoneClass(z)"
                :style="{ bottom: `${z.y0 * 100}%`, height: `${(z.y1 - z.y0) * 100}%`, ...zoneFill(z) }"
                :data-zone="z.id"
              />
            </div>
            <template v-for="m in model.marks" :key="m.id">
              <div aria-hidden="true" class="absolute -translate-y-1/2" :class="markLine(m)" :style="{ top: top(m.y), left: rem(X.gauge - 0.5), width: rem(X.width - X.gauge + 0.5) }" :data-mark="m.id" />
              <div class="absolute -translate-y-full pb-0.5" :style="{ top: top(m.y), left: rem(X.labels) }">
                <FigureTip
                  v-if="m.does"
                  :label="m.label"
                  :tip="m.does"
                  :value="markValue(m)"
                  :scope="scope"
                  class="inline-flex min-h-6 items-baseline gap-1.5 whitespace-nowrap text-left text-[15px] leading-none text-ink"
                  :data-mark-label="m.id"
                ><span class="font-semibold underline decoration-dotted underline-offset-4">{{ m.label }}</span><span class="font-mono text-[13px] text-ink-2">{{ model.measured ? m.text.replace(/ [a-z]+$/i, '') : m.text }}</span></FigureTip>
                <span v-else aria-hidden="true" class="inline-flex min-h-6 items-baseline gap-1.5 whitespace-nowrap text-[15px] leading-none text-ink" :data-mark-label="m.id"><span class="font-semibold">{{ m.label }}</span><span class="font-mono text-[13px] text-ink-2">{{ model.measured ? m.text.replace(/ [a-z]+$/i, '') : m.text }}</span></span>
              </div>
            </template>
          </div>
          <p aria-hidden="true" class="m-0 mt-2 text-[13px] text-ink-2" :style="{ paddingLeft: rem(X.gauge) }" data-axis>{{ axis }}</p>
        </div>

        <!-- md and up: the settings on the scale, then the zones' names at their heights. -->
        <div v-if="model.pins.length" class="relative hidden h-80 w-56 shrink-0 md:block" data-gauge-pins>
          <template v-for="p in model.pins" :key="p.key">
            <template v-if="p.mark">
              <span aria-hidden="true" class="absolute left-0 h-0.5 w-3 -translate-y-1/2 bg-ink" :style="{ top: top(p.y) }" />
              <button
                type="button"
                class="absolute left-3 inline-flex min-h-7 -translate-y-1/2 items-center gap-2 border-[1.5px] border-ink px-2 font-mono text-[13px] text-ink"
                :class="p.key === selectedKey ? 'bg-fit-tint' : 'bg-paper hover:bg-paper-hover'"
                :style="{ top: top(p.y) }"
                :aria-pressed="p.key === selectedKey"
                :aria-controls="controls ?? undefined"
                :aria-label="pinLabel(p)"
                :data-gauge-pin="p.key"
                @click="emit('select', p.key)"
              ><span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="p.key === selectedKey ? 'bg-fit' : 'border border-ink'" />{{ pinName(p) }}</button>
            </template>
            <template v-else>
              <span aria-hidden="true" class="absolute left-1 w-0.5 bg-ink" :style="{ top: top(p.y1), height: `${(p.y1 - p.y0) * 100}%` }" />
              <button
                type="button"
                class="absolute left-3 inline-flex min-h-7 -translate-y-1/2 items-center gap-2 border-[1.5px] border-ink px-2 font-mono text-[13px] text-ink"
                :class="p.key === selectedKey ? 'bg-fit-tint' : 'bg-paper hover:bg-paper-hover'"
                :style="{ top: top((p.y0 + p.y1) / 2) }"
                :aria-pressed="p.key === selectedKey"
                :aria-controls="controls ?? undefined"
                :aria-label="pinLabel(p)"
                :data-gauge-pin="p.key"
                @click="emit('select', p.key)"
              ><span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="p.key === selectedKey ? 'bg-fit' : 'border border-ink'" />{{ pinName(p) }}</button>
            </template>
          </template>
        </div>
        <div class="relative hidden h-80 min-w-[10rem] flex-1 md:block" data-gauge-zones>
          <div v-for="z in model.zones" :key="z.id" class="absolute left-0 -translate-y-1/2" :style="{ top: top((z.y0 + z.y1) / 2) }">
            <FigureTip
              v-if="z.does"
              :label="z.label"
              :tip="z.does"
              :scope="scope"
              class="inline-flex min-h-6 items-center text-left text-[15px] leading-snug underline decoration-dotted underline-offset-4"
              :class="[ZONE_TEXT[z.tone] ?? 'text-ink-2', z.tone ? 'font-medium' : '']"
              :data-zone-label="z.id"
            >{{ z.label }}</FigureTip>
            <span v-else aria-hidden="true" class="text-[15px] leading-snug" :class="ZONE_TEXT[z.tone] ?? 'text-ink-2'" :data-zone-label="z.id">{{ z.label }}</span>
          </div>
        </div>

        <!-- The schematic curve, on the scale's heights. -->
        <div v-if="model.curve" class="min-w-[15rem] flex-1 basis-full md:basis-0" data-gauge-curve>
          <div aria-hidden="true" class="relative h-80 border-b-[1.5px] border-l-[1.5px] border-ink">
            <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line
                v-for="m in model.marks"
                :key="m.id"
                x1="0" x2="100" :y1="(1 - m.y) * 100" :y2="(1 - m.y) * 100"
                :class="m.tone === 'error' ? 'stroke-error' : m.tone === 'fit' ? 'stroke-fit' : 'stroke-ink'"
                stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"
              />
              <path :d="model.curve.path" fill="none" class="stroke-fit" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke" data-curve />
            </svg>
            <span
              v-for="m in model.marks"
              :key="`l${m.id}`"
              class="absolute right-1 -translate-y-full bg-paper px-1 text-[13px] leading-tight text-ink-2"
              :style="{ top: top(m.y) }"
            >{{ m.label }}</span>
            <span
              v-for="e in model.curve.events"
              :key="`e${e.n}`"
              class="absolute inline-flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] bg-paper font-mono text-[13px]"
              :class="e.tone === 'error' ? 'border-error text-error' : e.tone === 'fit' ? 'border-fit text-fit-text' : 'border-ink text-ink'"
              :style="{ left: `${e.x * 100}%`, top: top(e.y) }"
              :data-curve-event="e.n"
            >{{ e.n }}</span>
          </div>
          <p aria-hidden="true" class="m-0 mt-2 text-[13px] text-ink-2">time (schematic)</p>
          <ol v-if="model.curve.events.length" class="m-0 mt-2 list-none p-0 text-[15px] leading-snug">
            <li v-for="e in model.curve.events" :key="`t${e.n}`" class="flex items-baseline gap-2 py-0.5">
              <span aria-hidden="true" class="font-mono text-[13px]" :class="e.tone === 'error' ? 'text-error' : e.tone === 'fit' ? 'text-fit-text' : 'text-ink'">{{ e.n }}</span>
              <FigureTip
                v-if="e.does"
                :label="e.label"
                :tip="e.does"
                :scope="scope"
                class="inline-flex min-h-6 items-center text-left underline decoration-dotted underline-offset-4"
                :class="e.tone === 'error' ? 'text-error' : 'text-ink'"
              >{{ e.label }}</FigureTip>
              <span v-else aria-hidden="true" :class="e.tone === 'error' ? 'text-error' : 'text-ink'">{{ e.label }}</span>
            </li>
          </ol>
        </div>
      </div>

      <!-- Below md: the zones as a key under the scale. -->
      <ul class="m-0 mt-4 flex list-none flex-col gap-1 p-0 text-[15px] md:hidden" data-gauge-key>
        <li v-for="z in zonesTopDown" :key="z.id" class="flex items-center gap-2">
          <span aria-hidden="true" class="inline-block size-3 shrink-0 border border-ink" :class="z.tone === 'fit' ? 'bg-fit-tint' : 'bg-paper'" :style="zoneFill(z)" />
          <FigureTip
            v-if="z.does"
            :label="z.label"
            :tip="z.does"
            :scope="scope"
            class="inline-flex min-h-6 items-center text-left underline decoration-dotted underline-offset-4"
            :class="ZONE_TEXT[z.tone] ?? 'text-ink'"
          >{{ z.label }}</FigureTip>
          <span v-else aria-hidden="true" :class="ZONE_TEXT[z.tone] ?? 'text-ink'">{{ z.label }}</span>
        </li>
      </ul>
      <TipStrip :scope="scope" />
    </div>
    <p class="m-0 mt-3 text-[13px] text-ink-2">{{ caption }}</p>
  </div>
</template>
