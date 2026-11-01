<script setup>
import { ref, computed, nextTick } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { controlFor } from '@/ui/controls/index.js'
import { valueTypeOf } from '@/core/valueTypes.js'

const props = defineProps({
  paramKey: { type: String, required: true },
})

const tuner = useActiveTuner()
const domain = useTunerDomain()

const def = computed(() => domain.defsByKey[props.paramKey])
const control = computed(() => controlFor(def.value))
const value = computed(() => tuner.params[props.paramKey])
const range = computed(() => domain.rangeFor(props.paramKey, tuner.hardware))
const issues = computed(() => tuner.issuesByParam[props.paramKey] ?? [])
const expanded = ref(false)

const formatted = computed(() => domain.formatValue(value.value, def.value, tuner.hardware))

// Stable id used to link the control to the param-name button via aria-labelledby.
const labelId = computed(() => `param-label-${props.paramKey}`)

const isWorkloadTuned = computed(() => {
  // True when the workload's hardware-derived default differs from the stock default.
  // Surfaces e.g. "Workload-specific" on swappiness when workload=k8s.
  const derived = domain.deriveDefaults(tuner.hardware)[props.paramKey]
  return !valueTypeOf(def.value).equals(derived, def.value.kernelDefault)
})

// Contextual ("K8s" on the swap tuner, "container host" on systemd) note + its
// "Source" link, both supplied by the active domain so the card stays generic.
// A domain may gate the note on hardware (contextApplies) so e.g. the K8s note
// only surfaces when the chosen workload is actually Kubernetes.
const contextNote = computed(() => {
  if (!domain.contextApplies(tuner.hardware)) return null
  return def.value[domain.noteKey] ?? def.value.contextNote ?? null
})

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
          class="break-all text-left font-mono text-sm font-semibold text-slate-900 hover:underline"
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

        <p v-if="def.alsoSets" class="mt-1 break-all font-mono text-xs text-slate-500">also sets {{ def.alsoSets.join(', ') }}</p>
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
          v-else-if="control.editable"
          type="button"
          class="inline-flex items-center gap-1 rounded px-1 font-mono text-sm font-semibold text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:bg-slate-100 hover:decoration-slate-500"
          aria-label="Edit value: type an exact number"
          title="Click to type an exact value"
          @click="startEdit"
        >{{ formatted }}<span aria-hidden="true" class="text-[11px] text-slate-400">✎</span></button>
        <div v-else class="font-mono text-sm font-semibold text-slate-900">{{ formatted }}</div>
        <div v-if="control.showsRange && !range.elements" class="text-[11px] text-slate-500">range {{ range.min.toLocaleString() }}–{{ range.max.toLocaleString() }}</div>
      </div>
    </header>

    <component
      :is="control.component"
      :def="def"
      :value="value"
      :range="range"
      :label-id="labelId"
      :value-text="formatted"
      @update="setValue"
    />

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
