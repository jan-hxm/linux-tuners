<script setup>
/**
 * One tuner as a setup step. It provides the step's store and the tuner's
 * domain, so the shared profile form, presets, parameter cards, drawer and
 * undo toast render as on the tuner's own page. The graphs and the About
 * content stay there; the step links to it with its state in the hash.
 */
import { computed, provide } from 'vue'
import ProfileForm from '@/ui/profile/ProfileForm.vue'
import PresetSelector from '@/ui/PresetSelector.vue'
import ParameterPanel from '@/ui/ParameterPanel.vue'
import InfoDrawer from '@/ui/InfoDrawer.vue'
import UndoToast from '@/ui/UndoToast.vue'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY, PROFILE_FIELD_NOTE_KEY } from '@/ui/useActiveTuner.js'
import { factValues, machineValues } from '@/core/machine.js'
import { machineOptionLabel } from './machineProfile.js'
import { FACT_PROVIDERS, SETUP_STEPS } from './steps.js'
import { useSetupStore, useStepStore } from './useSetupStore.js'

const props = defineProps({
  /** @type {import('./steps.js').SetupStep} */
  step: { type: Object, required: true },
  num: { type: Number, required: true },
})

const setup = useSetupStore()
const store = useStepStore(props.step.id)
const { entry, domain } = props.step

provide(TUNER_STORE_KEY, store)
provide(TUNER_DOMAIN_KEY, domain)
provide(PROFILE_FIELD_NOTE_KEY, fieldNote)

const ISSUE_CLASSES = {
  error: 'border-red-300 bg-red-50 text-red-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
}

const titleOf = (id) => SETUP_STEPS.find((s) => s.id === id)?.entry.title

/** Where a profile field's value came from: the machine profile or an earlier step. */
function fieldNote(field) {
  const fromFact = factValues([field], store.facts)
  if (Object.hasOwn(fromFact, field.key)) {
    return store.hardware[field.key] === fromFact[field.key]
      ? `From the ${titleOf(FACT_PROVIDERS[field.machine])} step.`
      : 'Changed for this step only. A change in the earlier step resets it.'
  }
  const mapped = machineValues([field], setup.machine)
  if (!Object.hasOwn(mapped, field.key)) return null
  return store.hardware[field.key] === mapped[field.key]
    ? 'From the machine profile.'
    : 'Changed for this step only. A change to the machine profile resets it.'
}

const skipped = computed(() => setup.skipped.includes(props.step.id))
const recommended = computed(() => entry.setup.roles === 'all' || entry.setup.roles.includes(setup.machine.role))
const roleLabel = computed(() => machineOptionLabel('role', setup.machine.role))

const tunerLink = computed(
  () => `${entry.path}#${domain.encodeState({ hardware: store.hardware, params: store.params, activePreset: store.activePreset })}`,
)
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p class="border-l-2 border-sky-600 pl-2 text-sm text-slate-800">{{ entry.setup.why }}</p>
      <p class="mt-2 text-xs text-slate-600">
        {{ recommended ? `Recommended for this machine (${roleLabel}).` : `Optional for this machine (${roleLabel}): its defaults are usually fine.` }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          :aria-pressed="skipped"
          @click="setup.toggleSkipped(step.id)"
        >{{ skipped ? 'Include this step' : 'Skip this step' }}</button>
        <a
          v-if="!skipped"
          :href="tunerLink"
          target="_blank"
          rel="noopener"
          class="text-sm text-sky-800 underline underline-offset-2 hover:text-sky-900"
        >Open with graphs on the tuner page ↗</a>
      </div>
    </div>

    <p v-if="skipped" class="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
      Skipped. Its files are left out of the output, and the machine keeps its current values for these settings.
    </p>

    <template v-else>
      <section class="space-y-2" :aria-labelledby="`setup-${step.id}-profile`">
        <h3 :id="`setup-${step.id}-profile`" class="text-sm font-semibold text-slate-900">{{ num }}a. Profile</h3>
        <ProfileForm />
      </section>
      <section class="space-y-2" :aria-labelledby="`setup-${step.id}-preset`">
        <h3 :id="`setup-${step.id}-preset`" class="text-sm font-semibold text-slate-900">{{ num }}b. Starting point</h3>
        <PresetSelector />
      </section>
      <section class="space-y-2" :aria-labelledby="`setup-${step.id}-tune`">
        <h3 :id="`setup-${step.id}-tune`" class="text-sm font-semibold text-slate-900">{{ num }}c. Values</h3>
        <ul v-if="store.issues.length" class="space-y-1" aria-label="Validation issues">
          <li
            v-for="issue in store.issues"
            :key="issue.id"
            class="rounded border px-3 py-2 text-xs"
            :class="ISSUE_CLASSES[issue.level]"
          >
            <span v-if="issue.blocking" class="font-semibold">Blocks the files: </span>{{ issue.message }}
          </li>
        </ul>
        <ParameterPanel />
      </section>
      <InfoDrawer />
      <UndoToast />
    </template>
  </div>
</template>
