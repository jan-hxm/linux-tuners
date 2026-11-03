<script setup>
/**
 * The profile form every tuner renders in step 1, built from the domain's
 * profile field list (src/tuners/<id>/profile.js, src/core/profile.js). The
 * user edits a draft (useProfileDraft.js) and applies it atomically; numbers
 * snap and clamp exactly as a restored link does, so the form can't produce a
 * profile the link schema would reject.
 */
import { computed, inject } from 'vue'
import { useActiveTuner, useTunerDomain, PROFILE_FIELD_NOTE_KEY, PROFILE_DRAFT_KEY } from '@/ui/useActiveTuner.js'
import { isFieldDisabled, optionLabel } from '@/core/profile.js'
import { useProfileDraft } from './useProfileDraft.js'
import NumberPickField from './NumberPickField.vue'
import RichText from '@/ui/RichText.vue'

const tuner = useActiveTuner()
const domain = useTunerDomain()
const profile = domain.profile
const fields = profile.fields
/** Where a field's value came from, in the guided setup; nothing elsewhere. */
const fieldNote = inject(PROFILE_FIELD_NOTE_KEY, () => null)

const HELP_CODE = 'font-mono bg-slate-100 px-1 py-0.5 text-slate-600'
const idFor = (key) => `profile-${domain.id}-${key}`

/** Layout rows: consecutive `half` fields share a two-column row. */
const rows = []
for (const field of fields) {
  const last = rows[rows.length - 1]
  if (field.half && last?.half && last.fields.length < 2) last.fields.push(field)
  else rows.push({ half: Boolean(field.half), fields: [field] })
}

// The draft is shared with ProfileDraftNotice when the page provides one;
// rendered on its own (a test), the form keeps its own.
const { draft, errors, collapsed, dirty, apply } = inject(PROFILE_DRAFT_KEY, null) ?? useProfileDraft(tuner, profile)

const summary = computed(() =>
  profile.summary(tuner.hardware, (key, value) => optionLabel(fields, key, value)).join(' · '),
)

const disabled = (field) => isFieldDisabled(field, draft)
const selectedNote = (field) => field.options.find((o) => o.value === draft[field.key])?.note
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
        :aria-expanded="false"
        @click="collapsed = false"
      >
        Edit
      </button>
    </header>

    <form v-if="!collapsed" class="space-y-5 p-4" @submit.prevent="apply">
      <div v-for="(row, r) in rows" :key="r" :class="{ 'grid gap-4 sm:grid-cols-2': row.half }">
        <div v-for="f in row.fields" :key="f.key">
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
              class="focus-inset mt-2 inline-flex overflow-hidden rounded border border-slate-300"
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
          <p v-if="fieldNote(f)" class="mt-1 text-xs font-medium text-sky-800">{{ fieldNote(f) }}</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <span v-if="dirty" class="text-xs text-amber-700">Unsaved changes</span>
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
