<script setup>
/**
 * A modes figure (Design.md §5 "Learning pages > Figures"): one row of
 * segments per setting, its choices, with the value measured on the chosen
 * image lit (figureText.js modeSegments): the option that equals it, every
 * set bit for a `bits` row, or an extra segment with the raw value when no
 * option names it, so a value is never silently dropped. A value absent on
 * this kernel lights nothing and says so. `groups` are headings over their
 * rows (one per disk, say). A row's setting (`pin`) is a pressed-state
 * button at its end from `md` up; the row under the figure has it below
 * `md`. Segments wrap on a phone. The root is a figure named from the data.
 */
import { computed, useId } from 'vue'
import FigureTip from './FigureTip.vue'
import TipStrip from './TipStrip.vue'
import FigurePin from './FigurePin.vue'
import { defName, modesCaption, modesLabel, modesModel, tipValue } from './figureText.js'

const props = defineProps({
  /** Figure of kind 'modes' */
  figure: { type: Object, required: true },
  /** ref => valueFor(ref, imageId) */
  evidence: { type: Function, required: true },
  imageId: { type: String, default: '' },
  /** How many images measured every value the same (sameOnEveryImage), or 0. */
  sameOn: { type: Number, default: 0 },
  /** The selected pin's `layer`: a row or group id. */
  highlight: { type: String, default: null },
  /** The selected pin's key: its button on the figure is pressed. */
  selectedKey: { type: String, default: null },
  defsByKey: { type: Object, default: () => ({}) },
  /** The id of the panel a pin button controls. */
  controls: { type: String, default: null },
})
const emit = defineEmits(['select'])

const scope = useId()
const model = computed(() => modesModel(props.figure, props.evidence))
const label = computed(() => modesLabel(props.figure, props.evidence, { defsByKey: props.defsByKey, highlight: props.highlight }))
const caption = computed(() => modesCaption(props.figure, props.evidence, props.imageId, props.sameOn))
const hasPins = computed(() => props.figure.rows.some((r) => r.pin))
const ROW = computed(() => (hasPins.value ? 'md:grid-cols-[9rem_minmax(0,1fr)_auto]' : 'md:grid-cols-[9rem_minmax(0,1fr)]'))
const on = (id) => id !== null && id === props.highlight

// Each segment draws its own border, so a row that wraps leaves no filled
// gap after its last segment.
const SEG = 'inline-flex min-h-8 items-center border-[1.5px] px-2.5 text-[13px] leading-tight'
const segClass = (s) => [
  SEG,
  s.lit ? 'border-ink bg-ink font-medium text-paper' : 'border-rule-strong bg-paper text-ink-2',
  s.extra ? 'border-dashed font-mono' : '',
]
const segTip = (s) => (s.lit ? 'Set on this kernel.' : '')
</script>

<template>
  <div>
    <div role="figure" :aria-label="label" data-figure="modes">
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
          v-for="r in g.rows"
          :key="r.id"
          class="grid grid-cols-1 items-center gap-x-3 gap-y-1 py-1.5"
          :class="[ROW, on(r.id) ? 'bg-fit-tint' : '']"
          :data-row="r.id"
          :data-status="r.status"
          :data-selected="on(r.id) || undefined"
        >
          <div class="min-w-0">
            <FigureTip
              v-if="r.does"
              :label="r.label"
              :tip="r.does"
              :value="tipValue(r.value, evidence, sameOn)"
              :scope="scope"
              class="inline-flex min-h-6 items-center text-left text-[15px] leading-snug text-ink underline decoration-dotted underline-offset-4"
              :data-row-label="r.id"
            >{{ r.label }}</FigureTip>
            <span v-else aria-hidden="true" class="text-[15px] leading-snug text-ink" :data-row-label="r.id">{{ r.label }}</span>
          </div>
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div class="flex max-w-full flex-wrap gap-1">
              <template v-for="s in r.segments" :key="String(s.value)">
                <FigureTip
                  v-if="s.does"
                  :label="s.label"
                  :tip="s.does"
                  :value="segTip(s)"
                  :scope="scope"
                  :class="[segClass(s), 'underline decoration-dotted underline-offset-4']"
                  :data-segment="String(s.value)"
                  :data-lit="s.lit || undefined"
                >{{ s.label }}</FigureTip>
                <span v-else aria-hidden="true" :class="segClass(s)" :data-segment="String(s.value)" :data-lit="s.lit || undefined" :data-extra="s.extra || undefined">{{ s.label }}</span>
              </template>
            </div>
            <span v-if="r.status !== 'ok'" aria-hidden="true" class="text-[13px] text-ink-2" data-row-status>{{ r.text }}</span>
          </div>
          <div v-if="hasPins" class="hidden md:block">
            <FigurePin
              v-if="r.pin"
              :name="defName(r.pin, defsByKey)"
              :label="`${defName(r.pin, defsByKey)}, sets ${r.label}`"
              :pressed="r.pin === selectedKey"
              :controls="controls"
              :data-figure-pin="r.pin"
              @select="emit('select', r.pin)"
            />
          </div>
        </div>
      </div>
      <TipStrip :scope="scope" />
    </div>
    <p class="m-0 mt-3 text-[13px] text-ink-2">{{ caption }}</p>
  </div>
</template>
