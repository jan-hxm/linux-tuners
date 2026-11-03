<script setup>
import { ref, computed, nextTick } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { controlFor } from '@/ui/controls/index.js'
import { valueTypeOf } from '@/core/valueTypes.js'
import { DESC_PARTS } from '@/ui/descParts.js'
import RichText from '@/ui/RichText.vue'

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
// Long names break after a separator (kernel.unprivileged_bpf_ / disabled)
// rather than mid-word; <wbr> marks the spots without changing copied text.
const nameParts = computed(() => def.value.sysctlName.split(/(?<=[._/-])/))

// The control is labelled by the plain-language title and the sysctl name
// (the name's text, not its button, whose aria-label says it opens the drawer).
const titleId = computed(() => `param-title-${props.paramKey}`)
const nameId = computed(() => `param-name-${props.paramKey}`)
const labelId = computed(() => `${titleId.value} ${nameId.value}`)

/** The parts of longDesc this parameter has, each with its label. */
const descParts = computed(() => DESC_PARTS.filter(({ key }) => def.value.longDesc[key]?.length))

// Where the value comes from: the stock default, the profile's default when
// it differs, and a Reset back to the profile's when the value moved off it.
// The line always shows and Reset keeps its space while hidden, so the card
// keeps its height and the slider stays put while it's dragged.
const profileDefault = computed(() => tuner.profileDefaults[props.paramKey])
const profileDiffers = computed(() => !valueTypeOf(def.value).equals(profileDefault.value, def.value.kernelDefault))
const changed = computed(() => !valueTypeOf(def.value).equals(value.value, profileDefault.value))
const sourceLine = computed(() => {
  const stock = `${domain.defaultLabel} ${domain.formatValue(def.value.kernelDefault, def.value, tuner.hardware)}`
  if (!profileDiffers.value) return stock
  return `${stock} · for your profile ${domain.formatValue(profileDefault.value, def.value, tuner.hardware)}`
})

function resetValue() {
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
    <!-- On a phone the value wraps under the name instead of squeezing it. -->
    <header class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div class="min-w-0 flex-1 basis-56">
        <p :id="titleId" class="text-sm font-semibold text-slate-900">{{ def.title }}</p>
        <button
          type="button"
          class="min-h-6 break-words text-left font-mono text-xs text-slate-700 hover:underline"
          :aria-label="`${def.sysctlName}, open reference`"
          @click="openInDrawer"
        >
          <span :id="nameId"><template v-for="(part, i) in nameParts" :key="i">{{ part }}<wbr></template></span>
        </button>
        <a
          :href="def.kernelDocsUrl"
          target="_blank"
          rel="noopener"
          class="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center text-xs text-slate-500 hover:text-slate-700"
          :aria-label="`${domain.docsLabel}, opens in a new tab`"
          :title="`Open ${domain.docsLabel} in a new tab`"
        >↗</a>

        <!-- What each badge means is spelled out under Learn more. -->
        <ul class="mt-1 flex flex-wrap gap-1">
          <li
            v-if="contextNote"
            class="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800"
          >{{ domain.context.badge }}</li>
          <li
            v-if="def.dangerousIfZero"
            class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800"
          >danger at 0</li>
        </ul>

        <p v-if="def.alsoSets" class="mt-1 break-all font-mono text-xs text-slate-500">also sets {{ def.alsoSets.join(', ') }}</p>
        <p class="mt-1.5 text-xs text-slate-600">{{ def.shortDesc }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ sourceLine }}</p>
        <p v-if="def.kernelDefaultNote" class="text-xs text-slate-500">{{ def.kernelDefaultNote }}</p>
      </div>

      <div class="ml-auto shrink-0 text-right">
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
          class="inline-flex min-h-6 items-center gap-1 rounded px-1 font-mono text-sm font-semibold text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:bg-slate-100 hover:decoration-slate-500"
          aria-label="Edit value: type an exact number"
          title="Click to type an exact value"
          @click="startEdit"
        >{{ formatted }}<span aria-hidden="true" class="text-[11px] text-slate-400">✎</span></button>
        <div v-else class="font-mono text-sm font-semibold text-slate-900">{{ formatted }}</div>
        <div v-if="control.showsRange && !range.elements" class="text-xs text-slate-500">range {{ range.min.toLocaleString() }}–{{ range.max.toLocaleString() }}</div>
        <button
          type="button"
          class="mt-1 min-h-6 rounded border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50"
          :class="{ invisible: !changed }"
          :aria-label="`Reset ${def.title} to ${domain.formatValue(profileDefault, def, tuner.hardware)}`"
          @click="resetValue"
        >Reset</button>
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
        class="inline-flex min-h-6 items-center text-xs text-slate-500 hover:text-slate-700"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }} Learn more
      </button>
      <div v-if="expanded" class="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
        <section v-for="part in descParts" :key="part.key" class="space-y-1">
          <h4 class="font-semibold text-slate-800">{{ part.label }}</h4>
          <p v-for="(para, i) in def.longDesc[part.key]" :key="i"><RichText :text="para" /></p>
        </section>
        <p v-if="def.tuningTip" class="rounded bg-slate-50 p-2 font-medium text-slate-800">
          <span class="font-semibold">Rule of thumb:</span> {{ def.tuningTip }}
        </p>
        <p v-if="def.dangerousIfZero" class="rounded bg-red-50 p-2 text-red-900">
          <span class="font-semibold">Danger at 0:</span> setting this to 0 is documented as dangerous.
        </p>
        <p v-if="contextNote" class="rounded bg-sky-50 p-2 text-sky-900">
          <span class="font-semibold">{{ domain.context.label }} ({{ domain.context.badge }}):</span> {{ contextNote }}
          <a :href="domain.context.url" target="_blank" rel="noopener" class="whitespace-nowrap underline">Source ↗</a>
        </p>
        <p>
          <a :href="def.kernelDocsUrl" target="_blank" rel="noopener" class="text-slate-600 underline">
            {{ domain.docsLabel }} ↗
          </a>
          ·
          <button type="button" class="text-slate-600 underline" @click="openInDrawer">
            Full reference
          </button>
        </p>
      </div>
    </div>
  </article>
</template>
