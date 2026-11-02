<script setup>
/**
 * The profile form every tuner renders in step 1, built from the domain's
 * profile field list (src/tuners/<id>/profile.js, src/core/profile.js). The
 * user edits a local draft and applies it atomically; numbers snap and clamp
 * exactly as a restored link does, so the form can't produce a profile the
 * link schema would reject.
 */
import { reactive, ref, computed, watch } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'
import { normalizeField, isFieldDisabled } from '@/core/profile.js'
import NumberPickField from './NumberPickField.vue'
import RichText from '@/ui/RichText.vue'

const tuner = useActiveTuner()
const domain = useTunerDomain()
const profile = domain.profile
const fields = profile.fields

const HELP_CODE = 'font-mono bg-slate-100 px-1 py-0.5'
const idFor = (key) => `profile-${domain.id}-${key}`

/** Layout rows: consecutive `half` fields share a two-column row. */
const rows = []
for (const field of fields) {
  const last = rows[rows.length - 1]
  if (field.half && last?.half && last.fields.length < 2) last.fields.push(field)
  else rows.push({ half: Boolean(field.half), fields: [field] })
}

function toDraft(hw) {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === 'text' ? (hw[f.key] ?? '') : hw[f.key]]))
}

// Local draft: lets the user edit several fields and apply atomically.
const draft = reactive(toDraft(tuner.hardware))
const errors = reactive({})
const collapsed = ref(false)
// Auto-collapse to the one-line summary only on the very first apply (the
// initial guided flow). After the user has explicitly re-opened with "Edit",
// keep the form open on apply so they can keep tweaking without re-expanding.
const hasApplied = ref(false)

/** The draft value as the store would hold it, before snapping. */
function draftValue(field) {
  if (field.type === 'number') return Number(draft[field.key])
  if (field.type === 'text') return String(draft[field.key] ?? '').trim() || null
  return draft[field.key]
}

const differsFrom = (hw) => fields.some((f) => draftValue(f) !== hw[f.key])
const dirty = computed(() => differsFrom(tuner.hardware))

function optionLabel(key, value) {
  return fields.find((f) => f.key === key)?.options?.find((o) => o.value === value)?.label ?? value
}

const summary = computed(() => profile.summary(tuner.hardware, optionLabel).join(' · '))

const disabled = (field) => isFieldDisabled(field, draft)
const selectedNote = (field) => field.options.find((o) => o.value === draft[field.key])?.note

function apply() {
  const hw = {}
  for (const field of fields) {
    const value = normalizeField(field, draft[field.key])
    errors[field.key] = value === undefined ? (field.invalidMessage ?? 'Invalid value.') : null
    hw[field.key] = value
  }
  if (fields.some((f) => errors[f.key])) return
  // Write the normalised values back into the draft so the form shows what was
  // actually applied (otherwise an out-of-range entry would keep showing
  // "Unsaved changes" against the clamped store value).
  Object.assign(draft, toDraft(hw))
  tuner.setHardware(hw)
  if (!hasApplied.value) collapsed.value = true
  hasApplied.value = true
}

// If something else replaces store.hardware, mirror it into the draft unless
// the user has unsaved edits against the previous profile.
watch(
  () => tuner.hardware,
  (hw, previous) => {
    if (!differsFrom(previous)) Object.assign(draft, toDraft(hw))
  },
  { deep: true },
)
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ profile.title }}</h2>
        <p v-if="collapsed" class="mt-1 text-sm text-slate-700"><RichText :text="summary" /></p>
      </div>
      <button
        v-if="collapsed"
        type="button"
        class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        @click="collapsed = false"
      >
        Edit
      </button>
    </header>

    <form v-if="!collapsed" class="space-y-5 p-4" @submit.prevent="apply">
      <div v-for="(row, r) in rows" :key="r" :class="{ 'grid gap-4 sm:grid-cols-2': row.half }">
        <template v-for="f in row.fields" :key="f.key">
          <NumberPickField
            v-if="f.type === 'number'"
            :id="idFor(f.key)"
            v-model="draft[f.key]"
            :label="f.label"
            :min="f.min"
            :max="f.max"
            :step="f.inputStep ?? f.step"
            :picks="f.picks ?? []"
          >
            <template v-if="f.help" #help>
              <template v-for="(line, i) in f.help" :key="i"><br v-if="i"><RichText :text="line" :code-class="HELP_CODE" /></template>
            </template>
          </NumberPickField>

          <div v-else-if="f.type === 'choice' && f.control === 'select'">
            <label class="block text-sm font-medium text-slate-700" :for="idFor(f.key)">{{ f.label }}</label>
            <select
              :id="idFor(f.key)"
              v-model="draft[f.key]"
              class="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <fieldset v-else-if="f.type === 'choice' && f.control === 'cards'" :disabled="disabled(f)">
            <legend class="text-sm font-medium text-slate-700">{{ f.label }}</legend>
            <div class="mt-2 grid gap-2" :class="f.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
              <label
                v-for="o in f.options"
                :key="o.value"
                class="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2 text-sm hover:bg-slate-50"
                :class="{ 'opacity-50': disabled(f) }"
              >
                <input
                  v-model="draft[f.key]"
                  type="radio"
                  :name="idFor(f.key)"
                  :value="o.value"
                  :disabled="disabled(f)"
                  class="mt-1"
                />
                <span>
                  <span :class="f.mono ? 'font-mono text-xs' : 'font-medium'">{{ o.label }}</span>
                  <span v-if="o.note" class="block text-xs text-slate-500">{{ o.note }}</span>
                </span>
              </label>
            </div>
            <p v-if="disabled(f) && f.disabledNote" class="mt-2 text-xs text-slate-500">{{ f.disabledNote }}</p>
          </fieldset>

          <div v-else-if="f.type === 'choice' && f.control === 'segmented'">
            <span :id="`${idFor(f.key)}-label`" class="block text-sm font-medium text-slate-700">{{ f.label }}</span>
            <div
              role="radiogroup"
              :aria-labelledby="`${idFor(f.key)}-label`"
              class="mt-2 inline-flex overflow-hidden rounded border border-slate-300"
            >
              <button
                v-for="o in f.options"
                :key="o.value"
                type="button"
                role="radio"
                :aria-checked="draft[f.key] === o.value"
                class="px-3 py-1 text-sm"
                :class="draft[f.key] === o.value ? 'bg-sky-700 text-white' : 'bg-white hover:bg-slate-50'"
                @click="draft[f.key] = o.value"
              >
                {{ o.label }}
              </button>
            </div>
            <p v-if="selectedNote(f)" class="mt-1 text-xs text-slate-500">{{ selectedNote(f) }}</p>
          </div>

          <div v-else-if="f.type === 'text'">
            <label class="block text-sm font-medium text-slate-700" :for="idFor(f.key)">{{ f.label }}</label>
            <input
              :id="idFor(f.key)"
              v-model="draft[f.key]"
              type="text"
              :placeholder="f.placeholder"
              :aria-invalid="Boolean(errors[f.key])"
              :aria-describedby="errors[f.key] ? `${idFor(f.key)}-error` : undefined"
              class="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
              @input="errors[f.key] = null"
            />
            <p v-if="errors[f.key]" :id="`${idFor(f.key)}-error`" class="mt-1 text-xs text-red-700">{{ errors[f.key] }}</p>
            <p v-if="f.help" class="mt-1 text-xs text-slate-500">
              <template v-for="(line, i) in f.help" :key="i"><br v-if="i"><RichText :text="line" :code-class="HELP_CODE" /></template>
            </p>
          </div>
        </template>
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <span v-if="dirty" class="text-xs text-amber-600">Unsaved changes</span>
        <button
          type="submit"
          class="rounded bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
        >
          {{ profile.applyLabel }}
        </button>
      </div>
    </form>
  </section>
</template>
