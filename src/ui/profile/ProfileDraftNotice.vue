<script setup>
/**
 * Repeats the profile form's "Unsaved changes" above the parameters, with the
 * same Apply, so someone who edited the profile and scrolled on can apply it
 * where they are. Renders nothing unless the page provides the form's draft
 * (PROFILE_DRAFT_KEY) and that draft differs from the applied profile.
 */
import { ref, watch, inject, nextTick } from 'vue'
import { useTunerDomain, PROFILE_DRAFT_KEY } from '@/ui/useActiveTuner.js'

const domain = useTunerDomain()
const draft = inject(PROFILE_DRAFT_KEY, null)
const invalid = ref(false)

if (draft) watch(draft.dirty, (dirty) => { if (!dirty) invalid.value = false })

async function apply() {
  const key = draft.apply()
  invalid.value = key !== null
  if (!invalid.value) return
  // Take the user to the field the form now marks, rather than leave them
  // guessing which one it is.
  await nextTick()
  document.getElementById(`profile-${domain.id}-${key}`)?.focus()
}
</script>

<template>
  <div
    v-if="draft?.dirty.value"
    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
  >
    <p>
      <span class="font-semibold">Unsaved profile changes.</span>
      <span v-if="invalid" role="alert"> A profile field is invalid: fix it in the profile above.</span>
      <span v-else> The values below still follow the applied profile.</span>
    </p>
    <button
      type="button"
      class="min-h-6 rounded bg-sky-700 px-3 py-1 text-sm font-medium text-white hover:bg-sky-800"
      @click="apply"
    >
      {{ domain.profile.applyLabel }}
    </button>
  </div>
</template>
