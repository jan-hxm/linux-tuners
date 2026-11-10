<script setup>
import { ref, reactive, computed, nextTick, useId, inject, watch, onMounted, onBeforeUnmount } from 'vue'
import { routerKey } from 'vue-router'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { controlFor } from '@/ui/controls/index.js'
import { valueTypeOf } from '@/core/valueTypes.js'
import { DESC_PARTS, HOW_IT_WORKS_KEY } from '@/ui/descParts.js'
import { TUNERS } from '@/tuners/registry.js'
import RichText from '@/ui/RichText.vue'
import { splitFirstSentence } from '@/ui/firstSentence.js'

const props = defineProps({
  paramKey: { type: String, required: true },
  // Compact density (Design.md §7 "Filter, changed only and compact"): one
  // hairline row of title and name, the control and the value. No notes;
  // the drawer keeps the full reference.
  compact: { type: Boolean, default: false },
  // Guide lookup (Design.md §7 "Three layers per parameter"): `(paramKey) =>
  // chapter id | null`, the chapter of the tuner's guide that pins this key.
  // Overrides the function a page provides under HOW_IT_WORKS_KEY. Only used
  // while the tuner's registry `guide.status` is 'live'; with neither the
  // prop nor the provider, a live guide shows no "How it works" link.
  howItWorks: { type: Function, default: null },
})

const tuner = useActiveTuner()
const domain = useTunerDomain()

const def = computed(() => domain.defsByKey[props.paramKey])
const control = computed(() => controlFor(def.value))
const value = computed(() => tuner.params[props.paramKey])
const range = computed(() => domain.rangeFor(props.paramKey, tuner.hardware))
// A live guide takes over the long text: the card drops the longDesc notes
// and "Learn more" and links to the chapter instead. Read defensively: an
// entry without `guide`, or a draft one, changes nothing.
const guide = computed(() => TUNERS.find((t) => t.id === domain.id)?.guide ?? null)
const guideLive = computed(() => guide.value?.status === 'live')
const router = inject(routerKey, null)
const chapterFor = props.howItWorks ?? inject(HOW_IT_WORKS_KEY, null)
const howItWorksPath = computed(() => {
  if (!guideLive.value || !guide.value.slug || !chapterFor) return null
  const chapter = chapterFor(props.paramKey)
  return chapter ? `/learn/${guide.value.slug}#${chapter}` : null
})
function openGuide(event) {
  // Plain clicks go through the router when there is one (no page load);
  // modified clicks and a missing router fall back to the link itself.
  if (!router || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return
  event.preventDefault()
  router.push(howItWorksPath.value)
}

const issues = computed(() => tuner.issuesByParam[props.paramKey] ?? [])

const format = (v) => domain.formatValue(v, def.value, tuner.hardware)
const formatted = computed(() => format(value.value))
// Many formatted values carry a second reading in brackets ("262144 kB
// (256 MiB)", "3 (up to 8 pages, 32 KiB)"). The card prints the first part
// large and the bracket beside it in quiet text; the full string stays the
// slider's valuetext.
const splitValue = (text) => {
  const m = /^(.+?) \((.+)\)$/.exec(text)
  return m ? { main: m[1], aside: m[2] } : { main: text, aside: null }
}
const valueParts = computed(() => splitValue(formatted.value))
// The edit button's name starts with the value as it reads on screen, both
// parts without the bracket (WCAG 2.5.3: the name contains the visible text).
const valueText = computed(() => [valueParts.value.main, valueParts.value.aside].filter(Boolean).join(' '))

// Long names break after a separator (kernel.unprivileged_bpf_ / disabled)
// rather than mid-word; <wbr> marks the spots without changing copied text.
const nameParts = computed(() => def.value.sysctlName.split(/(?<=[._/-])/))

// The control is labelled by the plain-language title and the sysctl name
// (the name's text, not its button, whose aria-label says it opens the drawer).
const titleId = computed(() => `param-title-${props.paramKey}`)
const nameId = computed(() => `param-name-${props.paramKey}`)
const labelId = computed(() => `${titleId.value} ${nameId.value}`)
const uid = useId()

// Where the value comes from (Design.md §7): the stock default, the
// profile's default, and whether the value moved off the profile's. That
// state drives the three marks: the value and its underline in `fit` or
// `mine`, the dot on the scale, the note in the margin and "Back to X".
const profileDefault = computed(() => tuner.profileDefaults[props.paramKey])
const profileDiffers = computed(() => !valueTypeOf(def.value).equals(profileDefault.value, def.value.kernelDefault))
const changed = computed(() => !valueTypeOf(def.value).equals(value.value, profileDefault.value))
const profileFormatted = computed(() => format(profileDefault.value))

// The origin note, always the margin's last: it always shows and only its
// words change, so the card keeps its height while the slider is dragged.
const originNote = computed(() => {
  const stock = `${domain.defaultLabel} ${format(def.value.kernelDefault)}.`
  if (changed.value) return `You moved this from ${profileFormatted.value} to ${formatted.value}. ${stock}`
  if (!profileDiffers.value) return `${domain.defaultLabel} ${format(def.value.kernelDefault)}, which also fits your machine.`
  return `${stock} Fits your machine: ${profileFormatted.value}.`
})

// "Back to X" keeps its space while hidden (invisible, out of the tab
// order), so nothing around it moves when the value moves off the default.
const backLabel = computed(() => `Back to ${splitValue(profileFormatted.value).main}`)
function backToDefault() {
  tuner.setParam(props.paramKey, profileDefault.value)
}

// Contextual ("K8s" on the swap tuner, "container host" on systemd) note + its
// "Source" link, both supplied by the active domain so the card stays generic.
// A domain may gate the note on hardware (contextApplies) so e.g. the K8s note
// only surfaces when the chosen workload is actually Kubernetes.
const contextNote = computed(() => {
  if (!domain.contextApplies(tuner.hardware)) return null
  return def.value[domain.noteKey] ?? def.value.contextNote ?? null
})

// The notes, in the order of the layers (Design.md §7 "Three layers per
// parameter"): the parts of longDesc, the rule of thumb, the context note.
// The margin holds at most three notes (Design.md §7): the first
// two of these and the origin note. A card too narrow for the wide margin
// (beside the graph column, or on a phone) holds two: the first of these and
// the origin note. The rest stay behind "Learn more", with the danger note,
// and the drawer keeps the full reference.
const MARGIN_LAYER_NOTES = 2
const NARROW_MARGIN_LAYER_NOTES = 1
// The card's own width decides, never the tuner: below the width at which the
// margin's clamp in the styles below bottoms out (34rem column + 2.5rem gap +
// 16.25rem margin), the card counts as narrow. Until it is measured (and where
// ResizeObserver is missing) it holds the full three.
const NARROW_CARD_REM = 36.5 + 16.25
const cardEl = ref(null)
const narrowCard = ref(false)
let resizeObserver = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !cardEl.value) return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  resizeObserver = new ResizeObserver(([entry]) => {
    narrowCard.value = entry.contentRect.width < NARROW_CARD_REM * rem
  })
  resizeObserver.observe(cardEl.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const marginLayerNotes = computed(() => (narrowCard.value ? NARROW_MARGIN_LAYER_NOTES : MARGIN_LAYER_NOTES))
// The zone note: the note of the first zone whose bounds hold the value, the
// margin's first note while the value sits in such a zone. Plain text, kept
// whole (no "more"). Data first: the card knows no tuner.
const zoneNote = computed(() => {
  const v = value.value
  if (typeof v !== 'number') return null
  const zone = def.value.zones?.find((z) => z.note && z.min !== undefined && z.max !== undefined && z.min <= v && v <= z.max)
  return zone ? { id: 'zone', label: zone.label, paras: [zone.note], zone: true } : null
})
const layerNotes = computed(() => guideLive.value ? [] : [
  ...DESC_PARTS.filter(({ key }) => def.value.longDesc[key]?.length).map(({ key, label }) => ({
    id: key,
    label,
    paras: def.value.longDesc[key],
  })),
  ...(def.value.tuningTip ? [{ id: 'tip', label: 'Rule of thumb', paras: [def.value.tuningTip] }] : []),
  ...(contextNote.value
    ? [{ id: 'context', label: `${domain.context.label} (${domain.context.badge})`, paras: [contextNote.value], url: domain.context.url }]
    : []),
])
// Each margin note shows its first sentence; "more" opens the rest of it in
// place (the [n] toggle of a narrow card opens the whole note). The notes
// don't depend on the value, so dragging never changes their height.
const allNotes = computed(() => (zoneNote.value ? [zoneNote.value, ...layerNotes.value] : layerNotes.value))
const marginNotes = computed(() =>
  allNotes.value.slice(0, marginLayerNotes.value).map((note) => {
    if (note.zone) return { ...note, head: note.paras[0], tail: '', rest: [], hasMore: false }
    const { head, tail } = splitFirstSentence(note.paras[0])
    const rest = note.paras.slice(1)
    return { ...note, head, tail, rest, hasMore: Boolean(tail) || rest.length > 0 }
  }),
)
const moreNotes = computed(() => guideLive.value ? [] : [
  ...allNotes.value.slice(marginLayerNotes.value),
  ...(def.value.dangerousIfZero
    ? [{ id: 'danger', label: 'Danger at 0', paras: ['Setting this to 0 is documented as dangerous.'] }]
    : []),
])

// The zone note is read out in a polite live region once the value has
// settled, like IssueAnnouncer (a drag across zones doesn't chatter). A note
// there when the card mounts isn't read: it is on the page.
const ZONE_SETTLE_MS = 600
const zoneAnnouncement = ref('')
let zoneTimer = null
let zoneSaid = zoneNote.value ? `${zoneNote.value.label}: ${zoneNote.value.paras[0]}` : ''
watch(
  () => (zoneNote.value ? `${zoneNote.value.label}: ${zoneNote.value.paras[0]}` : ''),
  (text) => {
    clearTimeout(zoneTimer)
    zoneTimer = setTimeout(async () => {
      if (text === zoneSaid) return
      zoneSaid = text
      if (!text) return
      zoneAnnouncement.value = ''
      await nextTick()
      zoneAnnouncement.value = text
    }, ZONE_SETTLE_MS)
  },
)
onBeforeUnmount(() => clearTimeout(zoneTimer))

// Where the card has no margin (a narrow card, Design.md §7), each
// margin note is an [n] toggle that opens it in place.
const openNotes = reactive({})
// On a wide card, which notes show past their first sentence. Its own state,
// apart from the toggles: only one of the two buttons shows at a time.
const fullNotes = reactive({})
const noteId = (note) => `${uid}-note-${note.id}`
const noteRestIds = (note) =>
  [note.tail && `${noteId(note)}-tail`, note.rest.length && `${noteId(note)}-rest`].filter(Boolean).join(' ')
const moreId = `${uid}-more`
const expanded = ref(false)

/** A control's `update`; the store clamps it by the def's value type. */
function setValue(v) {
  tuner.setParam(props.paramKey, v)
}

// Click-to-edit the current value (controls marked `editable`, i.e. sliders).
//
// Wide-range sliders (min_free_kbytes, dirty_expire_centisecs,
// watermark_scale_factor) map many value units per pixel, so landing on an
// exact number by mouse is impractical. Clicking the value text swaps it for an
// inline number input pre-filled with the *raw* value (not the formatted
// "262144 kB (256 MiB)" string). Commit on Enter/blur via setParam (which
// clamps); Escape reverts.
const editing = ref(false)
const editValue = ref('')
const numberEl = ref(null)

function startEdit() {
  if (!control.value.editable) return
  editValue.value = String(value.value)
  editing.value = true
  nextTick(() => {
    numberEl.value?.focus()
    numberEl.value?.select()
  })
}

function commitEdit() {
  if (!editing.value) return
  editing.value = false
  if (String(editValue.value).trim() === '') return
  const n = Number(editValue.value)
  if (!Number.isFinite(n)) return
  // This is an external change as far as the slider is concerned, so its
  // watcher pushes the new (clamped) value to the DOM and the thumb moves to
  // match what was typed.
  tuner.setParam(props.paramKey, n)
}

function cancelEdit() {
  editing.value = false
}

const ISSUE_LABELS = { error: 'Error', warn: 'Warning', info: 'Note' }

function openInDrawer() {
  tuner.openDrawer(props.paramKey)
}
</script>

<template>
  <!-- No box: a setting is a stretch of the column between hairlines. The
       card is a size container, so it lays itself out by its own width:
       column and margin side by side from 40rem, else the margin's notes as
       [n] toggles under the column (scoped styles below). -->
  <article
    ref="cardEl"
    class="param-card border-b border-rule"
    :class="compact ? 'pc-compact py-4' : 'py-6'"
    :data-changed="changed ? '' : undefined"
  >
    <div class="pc-body">
      <div class="pc-col min-w-0">
        <div class="pc-head min-w-0">
          <div :class="compact ? '' : 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'">
            <p :id="titleId" class="font-medium text-ink" :class="compact ? 'text-base' : 'text-[19px] leading-snug sm:text-xl'">{{ def.title }}</p>
            <button
              type="button"
              class="inline-flex min-h-6 items-center break-words text-left font-mono text-sm text-quiet underline-offset-[3px] hover:text-ink hover:underline"
              :aria-label="`${def.sysctlName}, open reference`"
              @click="openInDrawer"
            >
              <span :id="nameId" class="min-w-0"><template v-for="(part, i) in nameParts" :key="i">{{ part }}<wbr></template></span>
            </button>
          </div>

          <!-- What each badge means is spelled out under Learn more. -->
          <ul v-if="contextNote || def.dangerousIfZero" class="mt-2 flex flex-wrap gap-1.5">
            <li
              v-if="contextNote"
              class="border border-rule-strong px-1.5 text-[13px] text-ink-2"
            >{{ domain.context.badge }}</li>
            <li
              v-if="def.dangerousIfZero"
              class="border border-mine px-1.5 text-[13px] text-mine-text"
            >danger at 0</li>
          </ul>
          <p v-if="def.alsoSets && !compact" class="mt-2 break-all font-mono text-[13px] text-quiet">also sets {{ def.alsoSets.join(', ') }}</p>
        </div>

        <!-- The value, in its mark's colour and underline: verdigris while it
             fits the machine, ochre once changed. Back to X beside it. -->
        <div
          class="pc-value flex"
          :class="compact ? 'flex-col items-end gap-1' : 'mt-3 items-start justify-between gap-4'"
        >
          <div class="min-w-0" :class="{ 'text-right': compact }">
            <input
              v-if="editing"
              ref="numberEl"
              v-model="editValue"
              type="number"
              :min="range.min"
              :max="range.max"
              :step="def.step"
              :aria-label="`${def.sysctlName} value`"
              class="min-h-11 w-40 border border-ink bg-paper px-2 text-right font-mono text-lg text-ink"
              @keydown.enter.prevent="commitEdit"
              @keydown.esc.prevent="cancelEdit"
              @blur="commitEdit"
            />
            <component
              :is="control.editable ? 'button' : 'div'"
              v-else
              :type="control.editable ? 'button' : undefined"
              class="group inline-flex min-h-6 max-w-full flex-wrap items-baseline gap-x-2 text-left font-mono"
              :class="compact ? 'justify-end' : ''"
              :aria-label="control.editable ? `${valueText}, edit: type an exact value` : undefined"
              :title="control.editable ? 'Click to type an exact value' : undefined"
              @click="control.editable && startEdit()"
            >
              <span
                class="pc-num min-w-0 break-words border-b-[3px] leading-tight"
                :class="[
                  changed ? 'border-mine text-mine-text' : 'border-fit text-fit-text',
                  compact ? 'text-lg' : 'pc-num-large',
                ]"
              >{{ valueParts.main }}</span>
              <!-- A real space between the parts, so the text reads as two
                   words and the accessible name contains it (WCAG 2.5.3). -->
              <template v-if="valueParts.aside">{{ ' ' }}<span class="text-base text-quiet">{{ valueParts.aside }}</span></template>
              <span v-if="control.editable" aria-hidden="true" class="text-sm text-quiet group-hover:text-ink">✎</span>
            </component>
            <p
              v-if="!compact && control.showsRange && !range.elements"
              class="mt-1.5 font-mono text-[13px] text-quiet"
            >range {{ range.min.toLocaleString() }}–{{ range.max.toLocaleString() }}</p>
          </div>
          <button
            type="button"
            class="min-h-11 shrink-0 border border-fit px-3.5 text-sm font-medium text-fit-text hover:bg-fit-tint"
            :class="{ invisible: !changed }"
            :aria-label="`${backLabel}, ${def.title}`"
            @click="backToDefault"
          >{{ backLabel }}</button>
        </div>

        <!-- Controls bring their own top margin, which a compact row drops. -->
        <div class="pc-control min-w-0" :class="{ '[&>*]:mt-0': compact }">
          <component
            :is="control.component"
            :def="def"
            :value="value"
            :range="range"
            :label-id="labelId"
            :value-text="formatted"
            :fit-value="profileDefault"
            :changed="changed"
            @update="setValue"
          />
        </div>

        <p v-if="!compact" class="mt-3 text-base leading-relaxed text-ink-2">{{ def.shortDesc }}</p>

        <!-- Validation issues: a blocking error in a 1px error frame, a
             warning in the warning colour with its sign, an info note quiet.
             The issue's fix, when it has one, is the line under it. -->
        <ul v-if="issues.length" class="pc-issues mt-3 space-y-2 text-[15px] leading-[1.55]">
          <li
            v-for="issue in issues"
            :key="issue.id"
            :class="{
              'border border-error px-3 py-2.5 text-ink': issue.level === 'error',
              'flex gap-2 text-mine-text': issue.level === 'warn',
              'text-ink-2': issue.level === 'info',
            }"
          >
            <svg
              v-if="issue.level === 'warn'"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="mt-1 shrink-0"
            ><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            <span>
              <span class="font-medium" :class="{ 'text-error': issue.level === 'error' }">{{ ISSUE_LABELS[issue.level] ?? issue.level }}:</span>
              {{ issue.message }}
              <span v-if="issue.fix" class="mt-1 block">{{ issue.fix }}</span>
            </span>
          </li>
        </ul>
      </div>

      <!-- The margin: numbered notes, then Learn more and the sources. -->
      <aside v-if="!compact" class="pc-margin min-w-0 text-[15px] leading-[1.55] [overflow-wrap:anywhere]" :aria-label="`Notes on ${def.title}`">
        <p class="sr-only" aria-live="polite">{{ zoneAnnouncement }}</p>
        <ol>
          <li
            v-for="(note, i) in marginNotes"
            :key="note.id"
            class="pc-note grid grid-cols-[30px_minmax(0,1fr)] border-t pt-2.5"
            :class="i === 0 ? 'border-ink' : 'border-rule'"
          >
            <!-- Narrow card: a real button opens the note in place. -->
            <button
              type="button"
              class="pc-note-toggle col-span-2 grid min-h-11 grid-cols-[30px_minmax(0,1fr)_auto] items-center text-left text-ink hover:bg-paper-hover"
              :aria-expanded="!!openNotes[note.id]"
              :aria-controls="noteId(note)"
              @click="openNotes[note.id] = !openNotes[note.id]"
            >
              <span class="font-mono text-[13px] text-quiet">[{{ i + 1 }}]</span>
              <span class="font-medium">{{ note.label }}</span>
              <span aria-hidden="true" class="px-2 font-mono text-quiet">{{ openNotes[note.id] ? '−' : '+' }}</span>
            </button>
            <span aria-hidden="true" class="pc-note-num font-mono text-[13px] text-quiet">[{{ i + 1 }}]</span>
            <div class="col-start-2 min-w-0">
              <h4 class="pc-note-label text-[13px] font-medium text-quiet">{{ note.label }}</h4>
              <div :id="noteId(note)" class="pc-note-body space-y-2 pb-2 text-ink-2" :class="{ 'pc-open': openNotes[note.id] }">
                <p>
                  <RichText :text="note.head" />
                  <span v-if="note.tail" :id="`${noteId(note)}-tail`" class="pc-note-tail" :class="{ 'pc-hidden': !fullNotes[note.id] }">{{ ' ' }}<RichText :text="note.tail" /></span>
                  <template v-if="note.hasMore">
                    {{ ' ' }}<button
                      type="button"
                      class="pc-note-more font-medium text-ink underline underline-offset-[3px] hover:decoration-2"
                      :aria-expanded="!!fullNotes[note.id]"
                      :aria-controls="noteRestIds(note)"
                      @click="fullNotes[note.id] = !fullNotes[note.id]"
                    >{{ fullNotes[note.id] ? 'less' : 'more' }}<span class="sr-only">, {{ note.label }}</span></button>
                  </template>
                </p>
                <div v-if="note.rest.length" :id="`${noteId(note)}-rest`" class="pc-note-rest space-y-2" :class="{ 'pc-hidden': !fullNotes[note.id] }">
                  <p v-for="(para, j) in note.rest" :key="j"><RichText :text="para" /></p>
                </div>
                <p v-if="note.url"><a :href="note.url" target="_blank" rel="noopener" class="whitespace-nowrap underline underline-offset-[3px]">Source ↗</a></p>
              </div>
            </div>
          </li>
          <li
            class="grid grid-cols-[30px_minmax(0,1fr)] border-t pt-2.5"
            :class="changed ? 'border-mine' : marginNotes.length ? 'border-fit' : 'border-ink'"
          >
            <span class="font-mono text-[13px] text-quiet">[{{ marginNotes.length + 1 }}]</span>
            <div class="min-w-0">
              <p :class="changed ? 'text-mine-text' : 'text-ink-2'">{{ originNote }}</p>
              <p v-if="def.kernelDefaultNote" class="mt-1 text-sm text-quiet">{{ def.kernelDefaultNote }}</p>
            </div>
          </li>
        </ol>

        <!-- The margin's last line, under the origin note's text: Learn more
             and the sources, so they add no row of their own to the card. -->
        <p class="pc-links mt-1 flex flex-wrap gap-x-4 pl-[30px] text-sm">
          <a
            v-if="howItWorksPath"
            :href="howItWorksPath"
            class="inline-flex min-h-6 items-center font-medium text-ink underline underline-offset-[3px] hover:decoration-2"
            @click="openGuide"
          >How it works<span class="sr-only">, {{ def.title }}</span></a>
          <button
            v-if="moreNotes.length"
            type="button"
            class="inline-flex min-h-6 items-center font-medium text-ink underline underline-offset-[3px] hover:decoration-2"
            :aria-expanded="expanded"
            :aria-controls="moreId"
            @click="expanded = !expanded"
          >Learn more</button>
          <a
            :href="def.kernelDocsUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px] hover:decoration-2"
          >{{ domain.docsLabel }}<span aria-hidden="true">&nbsp;↗</span><span class="sr-only">, opens in a new tab</span></a>
          <button
            type="button"
            class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px] hover:decoration-2"
            @click="openInDrawer"
          >Full reference</button>
        </p>

        <template v-if="moreNotes.length">
          <div :id="moreId">
            <ol v-if="expanded" class="mt-2 space-y-4">
              <li
                v-for="(note, i) in moreNotes"
                :key="note.id"
                class="grid grid-cols-[30px_minmax(0,1fr)] border-t border-rule pt-2.5"
              >
                <span class="font-mono text-[13px] text-quiet">[{{ marginNotes.length + 2 + i }}]</span>
                <div class="min-w-0 space-y-2 text-ink-2">
                  <h4 class="text-[13px] font-medium text-quiet">{{ note.label }}</h4>
                  <p v-for="(para, j) in note.paras" :key="j"><RichText :text="para" /></p>
                  <p v-if="note.url"><a :href="note.url" target="_blank" rel="noopener" class="whitespace-nowrap underline underline-offset-[3px]">Source ↗</a></p>
                </div>
              </li>
            </ol>
          </div>
        </template>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.param-card {
  container: param-card / inline-size;
}

/* The value: 24px, and 36px once the card is wide enough for it. */
.pc-num-large {
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}
@container param-card (min-width: 30rem) {
  .pc-num-large {
    font-size: 2.25rem;
  }
}

/* A narrow card: the margin follows the column, its notes are [n] toggles
 * and only the origin note is always open. An open note shows in full, so
 * its "more" button is hidden. */
.pc-margin {
  margin-top: 1.5rem;
}
.pc-note-num,
.pc-note-label,
.pc-note-body,
.pc-note-more {
  display: none;
}
.pc-note-body.pc-open {
  display: block;
}
.pc-hidden {
  display: none;
}
@container param-card not (min-width: 40rem) {
  .pc-open .pc-note-tail {
    display: inline;
  }
  .pc-open .pc-note-rest {
    display: block;
  }
}

/* A wide card: column and margin side by side, every margin note open at
 * its first sentence, with "more" for the rest. */
@container param-card (min-width: 40rem) {
  .pc-body {
    display: grid;
    /* The margin is 16.25rem, and on a wide card it grows towards 30rem
     * while the column keeps at least 34rem (100cqi is the card's width). */
    grid-template-columns: minmax(0, 1fr) clamp(16.25rem, calc(100cqi - 36.5rem), 30rem);
    column-gap: 2.5rem;
    align-items: start;
  }
  .pc-margin {
    margin-top: 0;
  }
  .pc-note-toggle {
    display: none;
  }
  .pc-note-num,
  .pc-note-label,
  .pc-note-body {
    display: block;
  }
  .pc-note-more {
    display: inline;
  }
  .pc-note-label {
    margin-bottom: 0.25rem;
  }
}

/* Compact: one row of title and name, the control, the value; on a narrow
 * card the control wraps under the other two. Issues and Back to X stay. */
.pc-compact .pc-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'head value'
    'control control'
    'issues issues';
  column-gap: 1rem;
  align-items: center;
}
.pc-compact .pc-head {
  grid-area: head;
}
.pc-compact .pc-value {
  grid-area: value;
}
.pc-compact .pc-control {
  grid-area: control;
}
.pc-compact .pc-issues {
  grid-area: issues;
}
@container param-card (min-width: 36rem) {
  .pc-compact .pc-col {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
    grid-template-areas:
      'head control value'
      'issues issues issues';
  }
}
</style>
