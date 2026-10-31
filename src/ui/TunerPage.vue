<script setup>
/**
 * The page shell every tuner renders through: hero with the step chain, the
 * four steps (profile, preset, tune, export), ad slot, About section, info
 * drawer, and the mobile impact bar with its spacer (Design.md §7). It
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
import PresetSelector from '@/ui/PresetSelector.vue'
import ParameterPanel from '@/ui/ParameterPanel.vue'
import GraphPanel from '@/ui/GraphPanel.vue'
import ConfigOutput from '@/ui/ConfigOutput.vue'
import InfoDrawer from '@/ui/InfoDrawer.vue'
import AboutSection from '@/ui/AboutSection.vue'
import StepHeader from '@/ui/StepHeader.vue'
import MobileImpactBar from '@/ui/MobileImpactBar.vue'
import AdSlot from '@/ui/AdSlot.vue'
import RichText from '@/ui/RichText.vue'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY } from '@/ui/useActiveTuner.js'

const props = defineProps({
  /** @type {import('@/core/types.js').TunerDomain} */
  domain: { type: Object, required: true },
})

const store = useTunerStoreFor(props.domain)
provide(TUNER_STORE_KEY, store)
provide(TUNER_DOMAIN_KEY, props.domain)

const graphTabs = props.domain.graphTabs
const hasGraphs = graphTabs.length > 0
const simulation = useTunerSimulation(store, props.domain.simulation)
/** Impact metrics for GraphPanel and the mobile impact bar; none without graphs. */
const impact = computed(() => (hasGraphs ? simulation.impactSummary?.value ?? [] : []))

const page = props.domain.page

const STEPS = [
  { num: 1, label: page.profileStep.label, href: `#${page.profileStep.id}` },
  { num: 2, label: 'Preset', href: '#preset' },
  { num: 3, label: 'Tune', href: '#tune' },
  { num: 4, label: 'Export', href: '#export' },
]

const HERO_CODE = 'rounded bg-white/10 px-1 font-mono text-[12px]'
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div class="max-w-2xl">
          <p class="text-xs uppercase tracking-widest text-slate-400">Tuner</p>
          <h1 class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{{ page.title }}</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-200">
            <RichText :text="page.intro" :code-class="HERO_CODE" />
          </p>
        </div>
        <nav class="flex items-center gap-3 text-xs text-slate-300">
          <a href="#about" class="hover:text-white hover:underline">About this tuner</a>
        </nav>
      </div>

      <!-- Step preview chain -->
      <ol class="mt-5 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-white/10 bg-black/10 px-5 py-3 text-xs sm:px-6">
        <li class="mr-1 text-slate-400">Jump to:</li>
        <template v-for="(step, i) in STEPS" :key="step.label">
          <li>
            <a :href="step.href" class="inline-flex items-center gap-1.5 rounded px-2 py-1 transition hover:bg-white/10">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold text-white">{{ step.num }}</span>
              <span class="text-slate-200">{{ step.label }}</span>
            </a>
          </li>
          <li v-if="i < STEPS.length - 1" class="text-slate-500" aria-hidden="true">→</li>
        </template>
      </ol>
    </header>

    <section :id="page.profileStep.id" class="space-y-3 scroll-mt-16">
      <StepHeader :num="1" :title="page.profileStep.title" :subtitle="page.profileStep.subtitle" />
      <slot name="profile"><ProfileForm /></slot>
    </section>

    <section id="preset" class="space-y-3 scroll-mt-16">
      <StepHeader :num="2" title="Pick a starting point" subtitle="Optional: jump to a tuned baseline for your workload, then fine-tune." />
      <PresetSelector />
    </section>

    <section id="tune" class="space-y-3 scroll-mt-16">
      <StepHeader :num="3" title="Tune and preview" :subtitle="page.tuneSubtitle" />
      <div v-if="hasGraphs" class="grid gap-4 lg:grid-cols-5 lg:items-start">
        <div class="lg:col-span-3">
          <ParameterPanel />
        </div>
        <div class="lg:sticky lg:top-14 lg:col-span-2 lg:self-start">
          <GraphPanel :tabs="graphTabs" :impact="impact" />
        </div>
      </div>
      <ParameterPanel v-else />
    </section>

    <section id="export" class="space-y-3 scroll-mt-16">
      <StepHeader :num="4" :title="page.exportStep.title" :subtitle="page.exportStep.subtitle" />
      <ConfigOutput />
    </section>

    <AdSlot :slot="page.adSlot" :label="`${domain.id} tuner footer`" />

    <AboutSection :about="domain.about" />
    <InfoDrawer />

    <!-- Spacer so the mobile impact bar never covers page content. -->
    <div v-if="impact.length" class="h-16 lg:hidden" aria-hidden="true" />
    <MobileImpactBar :impact="impact" />
  </section>
</template>
