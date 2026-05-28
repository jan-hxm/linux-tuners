<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'
import { PARAMETER_DEFS_BY_KEY } from '@/data/parameterDefs.js'
import { rangeFor, deriveDefaults } from '@/model/calculations.js'
import { formatValue } from '@/utils/formatting.js'

const props = defineProps({
  paramKey: { type: String, required: true },
})

const tuner = useTunerStore()

const def = computed(() => PARAMETER_DEFS_BY_KEY[props.paramKey])
const value = computed(() => tuner.params[props.paramKey])
const range = computed(() => rangeFor(props.paramKey, tuner.hardware))
const issues = computed(() => tuner.issuesByParam[props.paramKey] ?? [])
const expanded = ref(false)

const formatted = computed(() => formatValue(value.value, def.value.unit, tuner.hardware.ramGiB))

const isWorkloadTuned = computed(() => {
  // True when the workload's hardware-derived default differs from the kernel default.
  // Surfaces e.g. "Workload-specific" on swappiness when workload=k8s.
  const derived = deriveDefaults(tuner.hardware)[props.paramKey]
  return derived !== def.value.kernelDefault
})

const SEGMENTED_LABELS = {
  overcommit_memory: ['0 — heuristic', '1 — always', '2 — strict'],
}

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
          type="button"
          class="font-mono text-sm font-semibold text-slate-900 hover:underline"
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
            v-if="def.k8sNote"
            class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-800"
            title="Discussed in the K8s swap blog"
          >K8s</li>
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
        <div class="font-mono text-sm font-semibold text-slate-900">{{ formatted }}</div>
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
        class="w-full accent-slate-800"
        @input="setValue($event.target.value)"
      />
      <ul v-if="def.zones" class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
        <li v-for="z in def.zones" :key="z">{{ z }}</li>
      </ul>
    </div>

    <!-- Segmented -->
    <div v-else-if="def.control === 'segmented'" class="mt-3 inline-flex overflow-hidden rounded border border-slate-300">
      <button
        v-for="(label, i) in SEGMENTED_LABELS[paramKey]"
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
        :class="value === 1 ? 'bg-red-600' : 'bg-slate-300'"
        @click="setValue(value === 1 ? 0 : 1)"
      >
        <span
          class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          :class="value === 1 ? 'left-[18px]' : 'left-0.5'"
        />
      </button>
      <span class="text-xs text-slate-600">
        {{ value === 1 ? 'ENABLED — kernel will panic on OOM' : 'disabled — kernel will invoke OOM killer' }}
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
        <span class="font-semibold uppercase tracking-wide">{{ issue.level }}</span>
        — {{ issue.message }}
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
        <p>{{ def.longDesc }}</p>
        <p v-if="def.k8sNote" class="rounded bg-sky-50 p-2 text-sky-900">
          <span class="font-semibold">K8s blog:</span> {{ def.k8sNote }}
        </p>
        <p>
          <a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="text-slate-600 underline">
            kernel.org docs ↗
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