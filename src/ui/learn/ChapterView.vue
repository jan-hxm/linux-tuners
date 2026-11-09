<script setup>
/**
 * One chapter of a study guide, in the template's order (Design.md §5
 * "Learning pages > Figures"): the one-line summary, the picture box, the
 * figure with its pins and margin panel, the body with its sources in the
 * margin, the chooser, what you notice if it's wrong, where to look on your
 * machine, and the sources. Each thing is said once: the pin panel is the
 * one place a setting is explained on screen (the static page lists every
 * setting with its `here` as well), and the look command has its own part.
 *
 * The kernel switcher (which VM capture the numbers come from) is a group of
 * pressed-state buttons, remembered per viewer (kernelPref.js) and shared by
 * every chapter on the page. The figures get `evidence`, a function
 * `ref => valueFor(ref, imageId)` for the chosen image, so a figure never
 * looks a capture up by itself and a missing one reads "not measured".
 *
 * Footnote marks `[^id]` aren't RichText markup, so the body is split at
 * them here (figureText.js splitFootnotes) and each piece goes to RichText.
 */
import { computed, ref, useId, watch } from 'vue'
import RichText from '@/ui/RichText.vue'
import { followInPageLink } from '@/ui/inPageLink.js'
import StackFigure from './StackFigure.vue'
import Timeline from './Timeline.vue'
import SideBySide from './SideBySide.vue'
import Gauge from './Gauge.vue'
import CompareFigure from './CompareFigure.vue'
import TreeFigure from './TreeFigure.vue'
import ModesFigure from './ModesFigure.vue'
import Chooser from './Chooser.vue'
import DecisionFlow from './DecisionFlow.vue'
import { imageIn, setKernel } from './kernelPref.js'
import {
  defName, defTitle, drawnPinKeys, figureRefs as refsOf, hostOf, kernelOf, measuredText, numberedSources, pinRefs, safeHref, sameOnEveryImage, splitFootnotes,
} from './figureText.js'

const props = defineProps({
  /** Chapter, as in the frozen guide shape. */
  chapter: { type: Object, required: true },
  /** IMAGES_ORDER: [{ id, label }], the switcher's buttons in order. */
  images: { type: Array, required: true },
  /** valueFor(ref, imageId) from src/learn/evidence.js */
  valueFor: { type: Function, required: true },
  /** The tuner's defs by key, for names, titles and docs links. */
  defsByKey: { type: Object, default: () => ({}) },
  /** key => href of the setting in its tuner, or null for no link. */
  tuneHref: { type: Function, default: null },
  /** The chapter title's heading level; the parts under it are one deeper. */
  headingLevel: { type: Number, default: 2, validator: (n) => n >= 1 && n <= 5 },
})

const FIGURES = { stack: StackFigure, timeline: Timeline, sideBySide: SideBySide, gauge: Gauge, compare: CompareFigure, tree: TreeFigure, modes: ModesFigure }
/** Figures that draw settings themselves, whose pin buttons control the panel. */
const DRAWS_PINS = new Set(['gauge', 'compare', 'tree', 'modes'])

const uid = useId()
const headId = `${uid}-title`
const panelId = `${uid}-pin`
const sourceId = (id) => `${props.chapter.id}-source-${id}`

const imageId = computed(() => imageIn(props.images))
const imageLabel = computed(() => props.images.find((img) => img.id === imageId.value)?.label ?? imageId.value)
const evidence = computed(() => {
  const id = imageId.value
  return (vref) => props.valueFor(vref, id)
})

const figure = computed(() => props.chapter.figure)
const figureComponent = computed(() => FIGURES[figure.value?.kind] ?? null)
const figureRefs = computed(() => refsOf(figure.value, props.defsByKey))
/** Pins the figure draws itself, whose buttons in the row show only below md. */
const drawnKeys = computed(() => new Set(drawnPinKeys(figure.value)))

// Every value the same on every image: no picker, one caption (Design.md
// "Learning pages > Figures").
const sameOn = computed(() =>
  sameOnEveryImage(figureRefs.value, props.images.map((img) => img.id), props.valueFor) ? props.images.length : 0,
)

const pins = computed(() => props.chapter.pins ?? [])
const selectedKey = ref(pins.value[0]?.key ?? null)
watch(() => props.chapter.id, () => (selectedKey.value = pins.value[0]?.key ?? null))
const selected = computed(() => pins.value.find((p) => p.key === selectedKey.value) ?? null)
const selectedRefs = computed(() => (selected.value && figure.value ? pinRefs(figure.value, selected.value, props.defsByKey) : []))
const selectedKernel = computed(() => kernelOf(selectedRefs.value, evidence.value))
const docsHref = computed(() => (selected.value ? safeHref(props.defsByKey[selected.value.key]?.kernelDocsUrl) : null))
const tune = (key) => (props.tuneHref ? safeHref(props.tuneHref(key)) : null)

function togglePin(key) {
  selectedKey.value = selectedKey.value === key ? null : key
}

const sources = computed(() => numberedSources(props.chapter))
const numberOf = (id) => sources.value.find((s) => s.id === id)?.n ?? null
const paragraphs = computed(() =>
  (props.chapter.body ?? []).map((text) => {
    const parts = splitFootnotes(text)
    const cited = [...new Set(parts.filter((p) => p.note && numberOf(p.note)).map((p) => p.note))]
    return { parts, notes: cited.map((id) => sources.value.find((s) => s.id === id)) }
  }),
)

const h = computed(() => `h${props.headingLevel}`)
const sub = computed(() => `h${props.headingLevel + 1}`)

const SUBHEAD = 'm-0 mt-10 border-t border-ink pt-3 text-[17px] font-medium text-ink'
const LINK = 'underline underline-offset-[3px] hover:decoration-2'
</script>

<template>
  <section :id="chapter.id" :aria-labelledby="headId" class="scroll-mt-4 lg:scroll-mt-[calc(var(--site-header-h)+1rem)]" data-chapter>
    <component :is="h" :id="headId" class="m-0 text-[28px] font-medium leading-tight text-ink">{{ chapter.title }}</component>
    <p class="m-0 mt-3 text-[19px] leading-[1.5] text-ink-2" data-part="oneLine"><RichText :text="chapter.oneLine" /></p>

    <div class="mt-6 border border-rule bg-paper-hover p-4" data-part="picture">
      <p class="m-0 text-[13px] font-medium text-quiet">Picture it</p>
      <p class="m-0 mt-1 text-[17px] leading-[1.55] text-ink"><RichText :text="chapter.picture.text" /></p>
      <p v-if="chapter.picture.limit" class="m-0 mt-2 text-[15px] leading-[1.55] text-ink-2">
        <span class="font-medium text-ink">Where the picture stops: </span><RichText :text="chapter.picture.limit" />
      </p>
    </div>

    <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_16rem]" data-part="figure">
      <div class="min-w-0">
        <div v-if="figureRefs.length && !sameOn" class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span :id="`${uid}-kernels`" class="text-[13px] text-quiet">Measured on</span>
          <div role="group" :aria-labelledby="`${uid}-kernels`" class="flex max-w-full flex-wrap gap-px border border-rule-strong bg-rule-strong" data-kernels>
            <button
              v-for="img in images"
              :key="img.id"
              type="button"
              class="min-h-11 grow px-3 text-[13px]"
              :class="img.id === imageId ? 'bg-ink font-medium text-paper' : 'bg-paper text-ink hover:bg-paper-hover'"
              :aria-pressed="img.id === imageId"
              @click="setKernel(img.id)"
            >{{ img.label }}</button>
          </div>
        </div>
        <component
          :is="figureComponent"
          v-if="figureComponent"
          :figure="figure"
          :evidence="evidence"
          :image-id="imageId"
          :defs-by-key="defsByKey"
          :highlight="selected?.layer ?? null"
          :same-on="sameOn"
          :selected-key="selectedKey"
          v-bind="DRAWS_PINS.has(figure.kind) ? { controls: panelId } : {}"
          @select="togglePin"
        />
        <div v-if="pins.length" role="group" aria-label="Settings in this figure" class="mt-4 flex flex-wrap gap-2" data-pins>
          <button
            v-for="pin in pins"
            :key="pin.key"
            type="button"
            class="inline-flex min-h-6 items-center gap-2 border px-2 py-1 font-mono text-[13px] text-ink"
            :class="[pin.key === selectedKey ? 'border-fit bg-fit-tint' : 'border-rule-strong bg-paper hover:bg-paper-hover', drawnKeys.has(pin.key) ? 'md:hidden' : '']"
            :aria-pressed="pin.key === selectedKey"
            :aria-controls="panelId"
            @click="togglePin(pin.key)"
          >
            <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="pin.key === selectedKey ? 'bg-fit' : 'bg-quiet'" />
            {{ defName(pin.key, defsByKey) }}
          </button>
        </div>
      </div>
      <aside :id="panelId" aria-live="polite" class="min-w-0 border-t border-ink pt-3 text-[15px] leading-[1.55]" data-pin-panel>
        <template v-if="selected">
          <p class="m-0 break-words font-mono text-[15px] text-ink">{{ defName(selected.key, defsByKey) }}</p>
          <p v-if="defTitle(selected.key, defsByKey)" class="m-0 text-ink-2">{{ defTitle(selected.key, defsByKey) }}</p>
          <p class="m-0 mt-3 text-[13px] font-medium text-quiet">What it changes here</p>
          <p class="m-0 text-ink"><RichText :text="selected.here" /></p>
          <template v-if="selectedRefs.length">
            <p class="m-0 mt-3 text-[13px] font-medium text-quiet">Measured</p>
            <ul class="m-0 list-none p-0 font-mono text-[13px] text-ink">
              <li v-for="vref in selectedRefs" :key="`${vref.probe}:${vref.path}`" class="break-words">{{ measuredText(vref, evidence, { exact: true }) }}</li>
            </ul>
            <p class="m-0 text-[13px] text-ink-2">{{ sameOn ? `The same on all ${sameOn} test kernels` : selectedKernel ? `${imageLabel}, kernel ${selectedKernel}` : `Not measured on ${imageLabel} yet` }}</p>
          </template>
          <p v-if="docsHref" class="m-0 mt-3 text-[13px] text-ink-2">
            Source: <a :href="docsHref" :class="LINK" target="_blank" rel="noopener">{{ hostOf(docsHref) }} ↗</a>
          </p>
          <p v-if="tune(selected.key)" class="m-0 mt-3">
            <a :href="tune(selected.key)" class="inline-flex min-h-6 items-center text-[15px] text-ink" :class="LINK">Tune it</a>
          </p>
        </template>
        <p v-else class="m-0 text-ink-2">Pick a setting to see what it changes here.</p>
      </aside>
    </div>

    <div class="mt-8 grid grid-cols-1 gap-x-6 md:grid-cols-[minmax(0,1fr)_16rem]" data-part="body">
      <template v-for="(para, i) in paragraphs" :key="i">
        <p class="m-0 mt-4 text-[17px] leading-[1.6] text-ink">
          <template v-for="(part, j) in para.parts" :key="j">
            <a
              v-if="part.note && numberOf(part.note)"
              :href="`#${sourceId(part.note)}`"
              class="font-mono text-[13px] text-quiet no-underline hover:text-ink hover:underline"
              @click="followInPageLink($event, sourceId(part.note))"
            ><span class="sr-only">Source </span>[{{ numberOf(part.note) }}]</a>
            <RichText v-else-if="part.text" :text="part.text" />
          </template>
        </p>
        <ul v-if="para.notes.length" class="m-0 mt-4 list-none p-0 text-[13px] leading-snug text-ink-2" :aria-label="`Sources for paragraph ${i + 1}`">
          <li v-for="note in para.notes" :key="note.id" class="mb-2">
            <span class="font-mono text-quiet">[{{ note.n }}]</span>{{ ' ' }}<a v-if="safeHref(note.url)" :href="safeHref(note.url)" :class="LINK" target="_blank" rel="noopener">{{ note.label }} ↗</a>
            <template v-else>{{ note.label }}</template>
          </li>
        </ul>
        <div v-else aria-hidden="true" />
      </template>
    </div>

    <template v-if="chapter.choose?.length">
      <component :is="sub" :class="SUBHEAD">Should you change it?</component>
      <div class="print:hidden" data-part="chooser">
        <Chooser :choose="chapter.choose" :defs-by-key="defsByKey" :tune-href="tuneHref ? tune : null" />
      </div>
      <div class="hidden print:block" data-part="flow">
        <DecisionFlow :choose="chapter.choose" :defs-by-key="defsByKey" />
      </div>
    </template>

    <template v-if="chapter.symptoms">
      <component :is="sub" :class="SUBHEAD">What you notice if it's wrong</component>
      <dl class="m-0 grid grid-cols-1 gap-4 pt-3 text-[15px] leading-[1.55] md:grid-cols-2" data-part="symptoms">
        <div>
          <dt class="text-[13px] font-medium text-quiet">Too low</dt>
          <dd class="m-0 text-ink"><RichText :text="chapter.symptoms.low" /></dd>
        </div>
        <div>
          <dt class="text-[13px] font-medium text-quiet">Too high</dt>
          <dd class="m-0 text-ink"><RichText :text="chapter.symptoms.high" /></dd>
        </div>
      </dl>
    </template>

    <template v-if="chapter.look">
      <component :is="sub" :class="SUBHEAD">Look on your machine</component>
      <div class="pt-3" data-part="look">
        <pre tabindex="0" :aria-label="`Command: ${chapter.look.cmd}`" class="m-0 overflow-x-auto border border-rule bg-paper-hover p-3 font-mono text-[15px] text-ink"><code>{{ chapter.look.cmd }}</code></pre>
        <p class="m-0 mt-2 text-[15px] leading-[1.55] text-ink-2"><RichText :text="chapter.look.for" /></p>
      </div>
    </template>

    <template v-if="sources.length">
      <component :is="sub" :class="SUBHEAD">Sources</component>
      <ol class="m-0 list-none p-0 pt-3 text-[15px] leading-[1.55]" data-part="sources">
        <li v-for="s in sources" :id="sourceId(s.id)" :key="s.id" class="scroll-mt-4 py-1 lg:scroll-mt-[calc(var(--site-header-h)+1rem)]">
          <span class="font-mono text-[13px] text-quiet">[{{ s.n }}]</span>{{ ' ' }}<a v-if="safeHref(s.url)" :href="safeHref(s.url)" :class="LINK" target="_blank" rel="noopener">{{ s.label }} ↗</a>
          <template v-else>{{ s.label }}</template>
        </li>
      </ol>
    </template>
  </section>
</template>
