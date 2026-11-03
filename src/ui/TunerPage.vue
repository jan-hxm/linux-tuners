<script setup>
/**
 * The page shell every tuner renders through: hero, the step chain (sticky
 * from lg up, highlighting the step in view), the
 * four steps (profile, preset, tune, export), ad slot, About section, info
 * drawer, the undo toast, the issue announcer, and the mobile impact bar with its spacer
 * (Design.md §7). It
 * provides the store and domain to the shared components below it, including
 * whatever goes into the `profile` slot.
 *
 * Everything comes from the domain: the profile field list (rendered by
 * ProfileForm unless the `profile` slot replaces it), graph tabs, the
 * simulation behind the impact metrics, and the copy from about.js. A domain
 * without graph tabs gets a full-width tune step and no impact bar. The
 * router renders this directly for each live tuner.
 */
import { provide, computed } from 'vue'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { useTunerSimulation } from '@/ui/useTunerSimulation.js'
import ProfileForm from '@/ui/profile/ProfileForm.vue'
import ProfileDraftNotice from '@/ui/profile/ProfileDraftNotice.vue'
import { useProfileDraft } from '@/ui/profile/useProfileDraft.js'
import PresetSelector from '@/ui/PresetSelector.vue'
import ParameterPanel from '@/ui/ParameterPanel.vue'
import GraphPanel from '@/ui/GraphPanel.vue'
import ConfigOutput from '@/ui/ConfigOutput.vue'
import InfoDrawer from '@/ui/InfoDrawer.vue'
import AboutSection from '@/ui/AboutSection.vue'
import StepHeader from '@/ui/StepHeader.vue'
import MobileImpactBar from '@/ui/MobileImpactBar.vue'
import UndoToast from '@/ui/UndoToast.vue'
import IssueAnnouncer from '@/ui/IssueAnnouncer.vue'
import AdSlot from '@/ui/AdSlot.vue'
import RichText from '@/ui/RichText.vue'
import NeedThisBox from '@/ui/NeedThisBox.vue'
import { useScrollSpy } from '@/ui/useScrollSpy.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY, PROFILE_DRAFT_KEY } from '@/ui/useActiveTuner.js'

const props = defineProps({
  /** @type {import('@/core/types.js').TunerDomain} */
  domain: { type: Object, required: true },
})

const store = useTunerStoreFor(props.domain)
provide(TUNER_STORE_KEY, store)
provide(TUNER_DOMAIN_KEY, props.domain)
// Shared by the profile form and the notice above the parameters. A page
// opened from a shared link starts on the summary line: its profile is set.
provide(PROFILE_DRAFT_KEY, useProfileDraft(store, props.domain.profile, { collapsed: store.restoredFromLink }))

const graphTabs = props.domain.graphTabs
const hasGraphs = graphTabs.length > 0
const simulation = useTunerSimulation(store, props.domain.simulation)
/** Impact metrics for GraphPanel and the mobile impact bar; none without graphs. */
const impact = computed(() => (hasGraphs ? simulation.impactSummary?.value ?? [] : []))

const page = props.domain.page
/** The graph panel's anchor, the mobile impact bar's jump target. */
const GRAPHS_ID = 'graphs'

const STEPS = [
  { num: 1, label: page.profileStep.label, id: page.profileStep.id },
  { num: 2, label: 'Preset', id: 'preset' },
  { num: 3, label: 'Tune', id: 'tune' },
  { num: 4, label: 'Export', id: 'export' },
].map((step) => ({ ...step, href: `#${step.id}` }))
/** The step the reader is in, highlighted in the step chain. */
const activeStep = useScrollSpy(STEPS.map((step) => step.id))

const HERO_CODE = 'rounded bg-white/10 px-1 font-mono text-[12px]'
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="light-palette surface-inverse overflow-hidden rounded-t-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
        <div class="max-w-2xl">
          <p class="text-xs uppercase tracking-widest text-slate-400">Tuner</p>
          <h1 class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{{ page.title }}</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-200">
            <RichText :text="page.intro" :code-class="HERO_CODE" />
          </p>
        </div>
        <nav class="flex items-center gap-3 text-xs text-slate-300">
          <a href="#about" class="inline-flex min-h-6 items-center hover:text-white hover:underline">About this tuner</a>
        </nav>
      </div>

    </header>

    <!-- Step chain: a sibling of the hero, not inside it, so from lg up it can
         stick under the site header for the whole page. -->
    <nav
      aria-label="Steps"
      class="light-palette surface-inverse !mt-0 rounded-b-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-xs shadow-sm lg:sticky lg:top-[var(--site-header-h)] lg:z-20"
    >
      <ol class="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-white/10 bg-black/10 px-5 py-3 sm:px-6">
        <li class="mr-1 text-slate-400">Jump to:</li>
        <template v-for="(step, i) in STEPS" :key="step.label">
          <li>
            <a
              :href="step.href"
              :aria-current="activeStep === step.id ? 'location' : undefined"
              class="inline-flex items-center gap-1.5 rounded px-2 py-1 transition"
              :class="activeStep === step.id ? 'bg-white/15' : 'hover:bg-white/10'"
            >
              <span
                class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                :class="activeStep === step.id ? 'bg-white text-slate-900' : 'bg-white/20 text-white'"
              >{{ step.num }}</span>
              <span :class="activeStep === step.id ? 'text-white' : 'text-slate-200'">{{ step.label }}</span>
            </a>
          </li>
          <li v-if="i < STEPS.length - 1" class="text-slate-500" aria-hidden="true">→</li>
        </template>
      </ol>
    </nav>

    <NeedThisBox :tuner-id="domain.id" />

    <section :id="page.profileStep.id" class="space-y-3 scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)]">
      <StepHeader :num="1" :title="page.profileStep.title" :subtitle="page.profileStep.subtitle" />
      <slot name="profile"><ProfileForm /></slot>
    </section>

    <section id="preset" class="space-y-3 scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)]">
      <StepHeader :num="2" title="Pick a starting point" subtitle="Optional: jump to a tuned baseline for your workload, then fine-tune." />
      <PresetSelector />
    </section>

    <section id="tune" class="space-y-3 scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)]">
      <StepHeader :num="3" title="Tune and preview" :subtitle="page.tuneSubtitle" />
      <ProfileDraftNotice />
      <div v-if="hasGraphs" class="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start">
        <div class="lg:col-span-3">
          <ParameterPanel />
        </div>
        <div :id="GRAPHS_ID" class="scroll-mt-16 lg:sticky lg:top-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)] lg:col-span-2 lg:self-start">
          <GraphPanel :tabs="graphTabs" :impact="impact" />
        </div>
      </div>
      <ParameterPanel v-else />
    </section>

    <section id="export" class="space-y-3 scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1rem)]">
      <StepHeader :num="4" :title="page.exportStep.title" :subtitle="page.exportStep.subtitle" />
      <ConfigOutput />
    </section>

    <AdSlot :slot="page.adSlot" :label="`${domain.id} tuner footer`" />

    <AboutSection :about="domain.about" />
    <InfoDrawer />

    <!-- Spacer so the mobile impact bar never covers page content. -->
    <div v-if="impact.length" class="h-24 lg:hidden" aria-hidden="true" />
    <MobileImpactBar :impact="impact" :graphs-id="GRAPHS_ID" />
    <UndoToast :raised="impact.length > 0" />
    <IssueAnnouncer />
  </section>
</template>
