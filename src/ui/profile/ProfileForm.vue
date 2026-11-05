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

const HELP_CODE = 'font-mono text-ink'
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
  <section>
    <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
      <div class="min-w-0">
        <h2 class="text-lg font-medium text-ink">{{ profile.title }}</h2>
        <p v-if="collapsed" class="mt-1 break-words font-mono text-sm text-ink-2"><RichText :text="summary" /></p>
      </div>
      <button
        v-if="collapsed"
        type="button"
        class="min-h-11 border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-paper-hover"
        :aria-expanded="false"
        @click="collapsed = false"
      >
        Edit
      </button>
    </header>

    <form v-if="!collapsed" class="space-y-5 pt-4" @submit.prevent="apply">
      <div v-for="(row, r) in rows" :key="r" :class="{ 'grid gap-x-8 gap-y-5 sm:grid-cols-2': row.half }">
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
            <label class="block text-[15px] font-medium text-ink" :for="idFor(f.key)">{{ f.label }}</label>
            <select
              :id="idFor(f.key)"
              v-model="draft[f.key]"
              class="mt-2 min-h-11 w-full max-w-md border border-rule-strong bg-paper px-2.5 text-[15px] text-ink"
            >
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <fieldset v-else-if="f.type === 'choice' && f.control === 'cards'" :disabled="disabled(f)">
            <legend class="text-[15px] font-medium text-ink">{{ f.label }}</legend>
            <div class="mt-2 grid gap-x-6 border-t border-rule" :class="f.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
              <label
                v-for="o in f.options"
                :key="o.value"
                class="flex min-h-11 cursor-pointer items-start gap-3 border-b border-rule px-2 py-2.5 text-[15px]"
                :class="[draft[f.key] === o.value ? 'bg-fit-tint' : 'hover:bg-paper-hover', { 'cursor-default opacity-50': disabled(f) }]"
              >
                <input
                  v-model="draft[f.key]"
                  type="radio"
                  :name="idFor(f.key)"
                  :value="o.value"
                  :disabled="disabled(f)"
                  class="mt-1 accent-[rgb(var(--t-fit))]"
                />
                <span>
                  <span :class="f.mono ? 'font-mono text-sm text-ink' : 'text-ink'">{{ o.label }}</span>
                  <span v-if="o.note" class="block text-sm text-ink-2">{{ o.note }}</span>
                </span>
              </label>
            </div>
            <p v-if="disabled(f) && f.disabledNote" class="mt-2 text-sm text-quiet">{{ f.disabledNote }}</p>
          </fieldset>

          <div v-else-if="f.type === 'choice' && f.control === 'segmented'">
            <span :id="`${idFor(f.key)}-label`" class="block text-[15px] font-medium text-ink">{{ f.label }}</span>
            <div
              role="radiogroup"
              :aria-labelledby="`${idFor(f.key)}-label`"
              class="mt-2 flex flex-wrap"
            >
              <button
                v-for="o in f.options"
                :key="o.value"
                type="button"
                role="radio"
                :aria-checked="draft[f.key] === o.value"
                class="-ml-px min-h-11 border border-ink px-4 text-[15px] first:ml-0"
                :class="draft[f.key] === o.value ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-hover'"
                @click="draft[f.key] = o.value"
              >
                {{ o.label }}
              </button>
            </div>
            <p v-if="selectedNote(f)" class="mt-1.5 text-sm text-quiet">{{ selectedNote(f) }}</p>
          </div>

          <div v-else-if="f.type === 'text'">
            <label class="block text-[15px] font-medium text-ink" :for="idFor(f.key)">{{ f.label }}</label>
            <input
              :id="idFor(f.key)"
              v-model="draft[f.key]"
              type="text"
              :placeholder="f.placeholder"
              :aria-invalid="Boolean(errors[f.key])"
              :aria-describedby="errors[f.key] ? `${idFor(f.key)}-error` : undefined"
              class="mt-2 min-h-11 w-full max-w-md border bg-paper px-2.5 font-mono text-[15px] text-ink placeholder:text-quiet"
              :class="errors[f.key] ? 'border-error' : 'border-rule-strong'"
              @input="errors[f.key] = null"
            />
            <p v-if="errors[f.key]" :id="`${idFor(f.key)}-error`" class="mt-1.5 text-sm text-error">{{ errors[f.key] }}</p>
            <p v-if="f.help" class="mt-1.5 text-sm text-quiet">
              <template v-for="(line, i) in f.help" :key="i"><br v-if="i"><RichText :text="line" :code-class="HELP_CODE" /></template>
            </p>
          </div>
          <p v-if="fieldNote(f)" class="mt-1.5 text-sm font-medium text-fit-text">{{ fieldNote(f) }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-rule pt-3">
        <span v-if="dirty" class="text-sm text-mine-text">Unsaved changes</span>
        <button
          type="submit"
          class="min-h-11 bg-ink px-5 text-[15px] font-medium text-paper hover:bg-ink-2"
        >
          {{ profile.applyLabel }}
        </button>
      </div>
    </form>
  </section>
</template>
