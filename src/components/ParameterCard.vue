<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/composables/useActiveTuner.js'

const props = defineProps({
  paramKey: { type: String, required: true },
})

const tuner = useActiveTuner()
const domain = useTunerDomain()

const def = computed(() => domain.defsByKey[props.paramKey])
const value = computed(() => tuner.params[props.paramKey])
const range = computed(() => domain.rangeFor(props.paramKey, tuner.hardware))
const issues = computed(() => tuner.issuesByParam[props.paramKey] ?? [])
const expanded = ref(false)

const formatted = computed(() => domain.formatValue(value.value, def.value, tuner.hardware))

// Stable id used to link the slider to the param-name button via aria-labelledby.
const labelId = computed(() => `param-label-${props.paramKey}`)

const isWorkloadTuned = computed(() => {
  // True when the workload's hardware-derived default differs from the stock default.
  // Surfaces e.g. "Workload-specific" on swappiness when workload=k8s.
  const derived = domain.deriveDefaults(tuner.hardware)[props.paramKey]
  return derived !== def.value.kernelDefault
})

// Contextual ("K8s" on the swap tuner, "container host" on systemd) note + its
// "Source" link, both supplied by the active domain so the card stays generic.
const contextNote = computed(() => def.value[domain.noteKey] ?? def.value.contextNote ?? null)

// Slider DOM ref + uncontrolled-with-external-sync pattern.
//
// We intentionally do NOT use `:value="value"` on the range input. When Vue
// patches the value attribute mid-drag (and the store updates one full reactive
// cycle per `input` event, including validation re-runs), Chromium cancels the
// active drag — symptom: "thumb jumps once, then drag stops". The fix: only
// touch the DOM value when the store value diverges from an *external* source
// (preset apply, hardware change, URL hash restore), not from the user's own
// drag. We mark our own commits with `selfWrite` so the watcher skips them.
const sliderEl = ref(null)
let selfWrite = false

onMounted(() => {
  if (sliderEl.value && def.value.control === 'slider') {
    sliderEl.value.value = String(value.value)
  }
})

watch(value, (v) => {
  if (selfWrite) {
    selfWrite = false
    return
  }
  const el = sliderEl.value
  if (el && Number(el.value) !== v) el.value = String(v)
})

function setValue(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return
  selfWrite = true
  tuner.setParam(props.paramKey, n)
}

// Filled portion of the slider track, 0–100%. Drives the gradient/progress fill
// in the scoped styles below. Reactive on the store value, so it follows drags,
// preset applies, and inline edits alike. Updating this (a style custom property)
// mid-drag is safe — unlike rewriting the input's `value`, it doesn't cancel the
// drag (see the selfWrite note above).
const pct = computed(() => {
  const { min, max } = range.value
  if (max <= min) return 0
  const clamped = Math.max(min, Math.min(max, value.value))
  return ((clamped - min) / (max - min)) * 100
})

// Click-to-edit the current value (slider params only).
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
  if (def.value.control !== 'slider') return
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
  // Commit directly via setParam (NOT setValue): the edit came from the number
  // field, not a slider drag, so we deliberately leave selfWrite false. That
  // lets the `value` watcher push the new (clamped) value to the slider DOM so
  // the thumb moves to match what was typed.
  tuner.setParam(props.paramKey, n)
}

function cancelEdit() {
  editing.value = false
}

function levelClasses(level) {
  return {
    error: 'border-red-300 bg-red-50 text-red-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    info: 'border-sky-300 bg-sky-50 text-sky-900',
  }[level]
}

function openInDrawer() {
  tuner.openDrawer(props.paramKey)
}
</script>

<template>
  <article
    class="rounded border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-slate-400"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <button
          :id="labelId"
          type="button"
          class="font-mono text-sm font-semibold text-slate-900 hover:underline"
          :aria-label="`${def.sysctlName}, open reference`"
          @click="openInDrawer"
        >
          {{ def.sysctlName }}
        </button>
        <a
          :href="def.kernelDocsUrl"
          target="_blank"
          rel="noopener"
          class="ml-1 text-xs text-slate-500 hover:text-slate-700"
          title="Open kernel.org docs in new tab"
        >↗</a>

        <ul class="mt-1 flex flex-wrap gap-1">
          <li
            v-if="contextNote"
            class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-800"
            :title="`Has ${domain.context.label}-specific guidance`"
          >{{ domain.context.badge }}</li>
          <li
            v-if="isWorkloadTuned"
            class="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800"
            :title="`Tuned by workload=${tuner.hardware.workload}`"
          >workload</li>
          <li
            v-if="def.dangerousIfZero"
            class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-800"
            title="Setting to 0 is documented as dangerous"
          >danger at 0</li>
        </ul>

        <p class="mt-1.5 text-xs text-slate-600">{{ def.shortDesc }}</p>
      </div>

      <div class="shrink-0 text-right">
        <input
          v-if="editing"
          ref="numberEl"
          v-model="editValue"
          type="number"
          :min="range.min"
          :max="range.max"
          :step="def.step"
          :aria-label="`${def.sysctlName} value`"
          class="w-28 rounded border border-slate-400 px-1.5 py-0.5 text-right font-mono text-sm font-semibold text-slate-900 focus:border-slate-600 focus:outline-none"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="cancelEdit"
          @blur="commitEdit"
        />
        <button
          v-else-if="def.control === 'slider'"
          type="button"
          class="rounded px-1 font-mono text-sm font-semibold text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:bg-slate-100 hover:decoration-slate-500"
          title="Click to type an exact value"
          @click="startEdit"
        >{{ formatted }}</button>
        <div v-else class="font-mono text-sm font-semibold text-slate-900">{{ formatted }}</div>
        <div class="text-[10px] text-slate-400">range {{ range.min.toLocaleString() }}–{{ range.max.toLocaleString() }}</div>
      </div>
    </header>

    <!-- Slider -->
    <div v-if="def.control === 'slider'" class="mt-3">
      <input
        ref="sliderEl"
        type="range"
        :min="range.min"
        :max="range.max"
        :step="def.step"
        :aria-labelledby="labelId"
        :aria-valuetext="formatted"
        class="range-slider"
        :style="{ '--range-pct': pct + '%' }"
        @input="setValue($event.target.value)"
      />
      <ul v-if="def.zones" class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
        <li v-for="z in def.zones" :key="z">{{ z }}</li>
      </ul>
    </div>

    <!-- Segmented -->
    <div v-else-if="def.control === 'segmented'" class="mt-3 inline-flex overflow-hidden rounded border border-slate-300">
      <button
        v-for="(label, i) in def.segmentLabels"
        :key="i"
        type="button"
        class="px-3 py-1 text-xs"
        :class="value === i ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'"
        @click="setValue(i)"
      >
        {{ label }}
      </button>
    </div>

    <!-- Toggle -->
    <div v-else-if="def.control === 'toggle'" class="mt-3 flex items-center gap-3">
      <button
        type="button"
        role="switch"
        :aria-checked="value === 1"
        class="relative h-5 w-9 rounded-full transition"
        :class="value === 1 ? (def.toggleDanger ? 'bg-red-600' : 'bg-emerald-600') : 'bg-slate-300'"
        @click="setValue(value === 1 ? 0 : 1)"
      >
        <span
          class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          :class="value === 1 ? 'left-[18px]' : 'left-0.5'"
        />
      </button>
      <span class="text-xs text-slate-600">
        {{ value === 1 ? (def.toggleLabels?.on ?? 'enabled') : (def.toggleLabels?.off ?? 'disabled') }}
      </span>
    </div>

    <!-- Validation issues for this parameter -->
    <ul v-if="issues.length" class="mt-3 space-y-1">
      <li
        v-for="issue in issues"
        :key="issue.id"
        class="rounded border px-2 py-1 text-xs"
        :class="levelClasses(issue.level)"
      >
        <span class="font-semibold uppercase tracking-wide">{{ issue.level }}</span>:
        {{ issue.message }}
      </li>
    </ul>

    <!-- Expandable "learn more" -->
    <div class="mt-3 border-t border-slate-100 pt-2">
      <button
        type="button"
        class="text-xs text-slate-500 hover:text-slate-700"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }} Learn more
      </button>
      <div v-if="expanded" class="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
        <p v-for="(para, i) in def.longDesc" :key="i">{{ para }}</p>
        <p v-if="def.tuningTip" class="rounded bg-slate-50 p-2 font-medium text-slate-800">
          <span class="font-semibold">Rule of thumb:</span> {{ def.tuningTip }}
        </p>
        <p v-if="contextNote" class="rounded bg-sky-50 p-2 text-sky-900">
          <span class="font-semibold">{{ domain.context.label }}:</span> {{ contextNote }}
          <a :href="domain.context.url" target="_blank" rel="noopener" class="whitespace-nowrap underline">Source ↗</a>
        </p>
        <p>
          <a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="text-slate-600 underline">
            {{ domain.docsLabel }} ↗
          </a>
          ·
          <button type="button" class="text-slate-600 underline" @click="openInDrawer">
            open in reference drawer
          </button>
        </p>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* Custom range slider in the page's slate palette. Native `accent-color` only
 * tints the control; here we shape the track and thumb and draw a filled
 * progress portion up to --range-pct (set inline from the reactive `pct`).
 * Colours are literal slate hexes so they don't depend on theme() resolution:
 *   slate-200 #e2e8f0 · slate-300 #cbd5e1 · slate-700 #334155 · slate-900 #0f172a
 */
.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 1.25rem; /* generous hit area; visual track is thinner */
  background: transparent;
  cursor: pointer;
}
.range-slider:focus {
  outline: none;
}

/* Track — WebKit/Blink. Gradient gives the filled-then-empty look. */
.range-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    #0f172a 0%,
    #0f172a var(--range-pct, 0%),
    #e2e8f0 var(--range-pct, 0%),
    #e2e8f0 100%
  );
}
/* Track + progress — Firefox draws the fill for us via ::-moz-range-progress. */
.range-slider::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: #e2e8f0;
}
.range-slider::-moz-range-progress {
  height: 6px;
  border-radius: 9999px;
  background: #0f172a;
}

/* Thumb */
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  margin-top: -5px; /* centre the 16px thumb on the 6px track */
  border-radius: 9999px;
  background: #0f172a;
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 1px #cbd5e1;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.range-slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 9999px;
  background: #0f172a;
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 1px #cbd5e1;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.range-slider:hover::-webkit-slider-thumb {
  transform: scale(1.15);
}
.range-slider:hover::-moz-range-thumb {
  transform: scale(1.15);
}
.range-slider:active::-webkit-slider-thumb,
.range-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 4px rgba(15, 23, 42, 0.2);
}
.range-slider:active::-moz-range-thumb,
.range-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 4px rgba(15, 23, 42, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .range-slider::-webkit-slider-thumb,
  .range-slider::-moz-range-thumb {
    transition: none;
  }
}
</style>