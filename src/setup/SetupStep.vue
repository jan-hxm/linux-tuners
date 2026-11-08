<script setup>
/**
 * One tuner as a setup step. It provides the step's store and the tuner's
 * domain, so the shared profile form, presets, parameter cards, drawer and
 * undo toast render as on the tuner's own page. The graphs and the About
 * content stay there; the step links to it with its state in the hash.
 */
import { computed, provide } from 'vue'
import ProfileForm from '@/ui/profile/ProfileForm.vue'
import ProfileDraftNotice from '@/ui/profile/ProfileDraftNotice.vue'
import { useProfileDraft } from '@/ui/profile/useProfileDraft.js'
import PresetSelector from '@/ui/PresetSelector.vue'
import ParameterPanel from '@/ui/ParameterPanel.vue'
import InfoDrawer from '@/ui/InfoDrawer.vue'
import UndoToast from '@/ui/UndoToast.vue'
import IssueAnnouncer from '@/ui/IssueAnnouncer.vue'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY, PROFILE_FIELD_NOTE_KEY, PROFILE_DRAFT_KEY } from '@/ui/useActiveTuner.js'
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
// The machine profile already set this step's profile, so the form starts on
// its summary line; the notice above the values repeats unapplied edits.
provide(PROFILE_DRAFT_KEY, useProfileDraft(store, domain.profile, { collapsed: true }))

// An issue says its level in words, so colour only backs it up.
const ISSUE_LABEL = { error: 'Error', warn: 'Check', info: 'Note' }
const ISSUE_CLASSES = {
  error: 'border-error',
  warn: 'border-mine',
  info: 'border-rule-strong',
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

const SECTION_H = 'border-t border-ink pt-3 text-[17px] font-medium text-ink'
const SECTION_NUM = 'mr-3 font-mono text-[13px] font-normal text-quiet'
</script>

<template>
  <div class="space-y-8">
    <!-- Why, whether it is recommended, and the step's own actions, as hairline rows. -->
    <div class="border-y border-rule text-[15px]">
      <p class="py-3 leading-relaxed text-ink">{{ entry.setup.why }}</p>
      <p class="border-t border-rule py-3 text-ink-2">
        {{ recommended ? `Recommended for this machine (${roleLabel}).` : `Optional for this machine (${roleLabel}): its defaults are usually fine.` }}
      </p>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule py-3">
        <button
          type="button"
          class="min-h-11 border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-paper-hover"
          :aria-pressed="skipped"
          @click="setup.toggleSkipped(step.id)"
        >{{ skipped ? 'Include this step' : 'Skip this step' }}</button>
        <a
          v-if="!skipped"
          :href="tunerLink"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-[3px] hover:text-ink"
        >Open with graphs on the tuner page ↗</a>
      </div>
    </div>

    <p v-if="skipped" class="border border-dashed border-rule-strong p-4 text-[15px] text-ink-2">
      Skipped. Its files are left out of the output, and the machine keeps its current values for these settings.
    </p>

    <template v-else>
      <section class="space-y-3" :aria-labelledby="`setup-${step.id}-profile`">
        <h3 :id="`setup-${step.id}-profile`" :class="SECTION_H"><span :class="SECTION_NUM">{{ num }}a</span>Profile</h3>
        <ProfileForm />
      </section>
      <section class="space-y-3" :aria-labelledby="`setup-${step.id}-preset`">
        <h3 :id="`setup-${step.id}-preset`" :class="SECTION_H"><span :class="SECTION_NUM">{{ num }}b</span>Starting point</h3>
        <PresetSelector />
      </section>
      <section class="space-y-3" :aria-labelledby="`setup-${step.id}-tune`">
        <h3 :id="`setup-${step.id}-tune`" :class="SECTION_H"><span :class="SECTION_NUM">{{ num }}c</span>Values</h3>
        <ProfileDraftNotice />
        <ul v-if="store.issues.length" class="space-y-2" aria-label="Validation issues">
          <li
            v-for="issue in store.issues"
            :key="issue.id"
            class="border-l-4 py-1 pl-3 text-sm leading-relaxed text-ink"
            :class="ISSUE_CLASSES[issue.level]"
          >
            <span class="font-medium">{{ issue.blocking ? 'Blocks the files: ' : `${ISSUE_LABEL[issue.level]}: ` }}</span>{{ issue.message }}
            <span v-if="issue.fix" class="block">{{ issue.fix }}</span>
          </li>
        </ul>
        <ParameterPanel />
      </section>
      <InfoDrawer />
      <UndoToast />
      <IssueAnnouncer />
    </template>
  </div>
</template>
