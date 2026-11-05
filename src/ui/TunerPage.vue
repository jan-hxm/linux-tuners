<script setup>
/**
 * The page shell every tuner renders through: the title block (breadcrumb,
 * title, purpose and the machine it is tuning for), the step chain (segments
 * on a line, sticky from lg up, the step in view marked), the four steps
 * (profile, preset, tune, export), ad slot, About section, info drawer, the
 * undo toast, the issue announcer, and the mobile impact bar with its spacer
 * (Design.md §7). It provides the store and domain to the shared components
 * below it, including whatever goes into the `profile` slot.
 *
 * Everything comes from the domain: the profile field list (rendered by
 * ProfileForm unless the `profile` slot replaces it), graph tabs, the
 * simulation behind the impact metrics, and the copy from about.js. From lg
 * up the graphs sit in a sticky column beside the settings, visible by
 * default; below lg they sit open above the settings, and the impact bar
 * keeps the numbers in view (Design.md §7). A domain without graph
 * tabs gets a full-width tune step and no impact bar. The router renders this
 * directly for each live tuner.
 */
import { provide, computed, inject, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, routerKey } from 'vue-router'
import { useTunerStoreFor } from '@/core/createTunerStore.js'
import { optionLabel } from '@/core/profile.js'
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
import StepChain from '@/ui/StepChain.vue'
import { PAGE_WIDTH } from '@/ui/layout/pageWidth.js'
import MobileImpactBar from '@/ui/MobileImpactBar.vue'
import UndoToast from '@/ui/UndoToast.vue'
import IssueAnnouncer from '@/ui/IssueAnnouncer.vue'
import AdSlot from '@/ui/AdSlot.vue'
import RichText from '@/ui/RichText.vue'
import { followInPageLink } from '@/ui/inPageLink.js'
import NeedThisBox from '@/ui/NeedThisBox.vue'
import { useScrollSpy } from '@/ui/useScrollSpy.js'
import { TUNER_STORE_KEY, TUNER_DOMAIN_KEY, PROFILE_DRAFT_KEY, PARAMETER_VIEW_KEY } from '@/ui/useActiveTuner.js'
import { useParameterView } from '@/ui/useParameterView.js'
import { useOutline, railStartsExpanded } from '@/ui/outline/useOutline.js'
import OutlineRail from '@/ui/outline/OutlineRail.vue'
import OutlineDrawer from '@/ui/outline/OutlineDrawer.vue'

const props = defineProps({
  /** @type {import('@/core/types.js').TunerDomain} */
  domain: { type: Object, required: true },
})

const store = useTunerStoreFor(props.domain)
provide(TUNER_STORE_KEY, store)
provide(TUNER_DOMAIN_KEY, props.domain)
// Shared by the profile form and the notice above the parameters. A page
// opened from a shared link starts on the summary line: its profile is set.
const profileDraft = useProfileDraft(store, props.domain.profile, { collapsed: store.restoredFromLink })
provide(PROFILE_DRAFT_KEY, profileDraft)
// Which groups and cards the tune step shows, shared by the panel and the
// settings outline so they always agree.
const parameterView = useParameterView(store, props.domain)
provide(PARAMETER_VIEW_KEY, parameterView)

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
].map((step) => ({ ...step, href: `#${step.id}`, mark: String(step.num).padStart(2, '0') }))
/** The step the reader is in, marked in the step chain. */
const activeStep = useScrollSpy(STEPS.map((step) => step.id))
/** Steps before this index are behind the reader; past the last, all are. */
const activeIndex = computed(() => {
  const i = STEPS.findIndex((step) => step.id === activeStep.value)
  return i === -1 ? STEPS.length : i
})

// The settings outline (Design.md §7 "Settings outline"): a rail left of the
// steps from xl up, a drawer from the step chain below that. It lists the
// steps after the profile, the groups and the cards shown.
const OUTLINE_STEPS = STEPS.slice(1)
const outline = useOutline(store, props.domain, parameterView, { activeStep })
// Expanded only where the settings column keeps the card's margin layout
// beside it; the viewer's choice lasts for the visit, in memory only.
const railExpanded = ref(false)
const railToggled = ref(false)
const stepsGrid = ref(null)
function fitRail() {
  if (railToggled.value || !stepsGrid.value) return
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  railExpanded.value = railStartsExpanded(stepsGrid.value.clientWidth / rem, hasGraphs)
}
function setRailExpanded(on) {
  railToggled.value = true
  railExpanded.value = on
}
onMounted(() => {
  fitRail()
  window.addEventListener('resize', fitRail, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', fitRail))

// The machine this page tunes, as the profile form's collapsed summary says it.
const profileSummary = computed(() =>
  props.domain.profile
    .summary(store.hardware, (key, value) => optionLabel(props.domain.profile.fields, key, value))
    .join(' · '),
)

/** "Edit machine": open the profile form and put focus in it. */
async function editMachine() {
  profileDraft.collapsed.value = false
  await nextTick()
  const step = document.getElementById(page.profileStep.id)
  const field = step?.querySelector('input:not([disabled]), select:not([disabled]), [role="radio"]')
  if (field) field.focus()
  else step?.scrollIntoView()
}

// The breadcrumb's link stays in the app when a router is installed; a test
// that mounts the page on its own gets a plain link.
const hasRouter = inject(routerKey, null) !== null

const STEP_SCROLL = 'scroll-mt-16 lg:scroll-mt-[calc(var(--site-header-h)+var(--step-chain-h)+1.5rem)]'
const INTRO_CODE = 'font-mono text-[0.9em] text-ink'
const CRUMB_LINK = 'inline-flex min-h-6 items-center underline underline-offset-[3px] hover:text-ink'
</script>

<template>
  <section class="pb-16" :class="PAGE_WIDTH">
    <!-- Title block: where you are, what the tuner is for, which machine. -->
    <header class="flex flex-wrap items-end justify-between gap-x-12 gap-y-4 pt-8 sm:pt-10">
      <div class="min-w-0 max-w-3xl flex-[1_1_32rem]">
        <nav aria-label="Breadcrumb" class="text-sm text-quiet">
          <ol class="flex flex-wrap items-center gap-x-1.5">
            <li>
              <RouterLink v-if="hasRouter" to="/" :class="CRUMB_LINK">All tuners</RouterLink>
              <a v-else href="/" :class="CRUMB_LINK">All tuners</a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{{ page.title }}</li>
          </ol>
        </nav>
        <h1 class="mt-2 text-[32px] font-medium leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px] sm:leading-[1.08]">{{ page.title }}</h1>
        <p class="mt-3 max-w-[36em] text-[17px] leading-relaxed text-ink-2 sm:text-lg">
          <RichText :text="page.intro" :code-class="INTRO_CODE" />
        </p>
        <p class="mt-1 text-sm">
          <a href="#about" @click="followInPageLink($event, 'about')" class="inline-flex min-h-6 items-center text-ink underline underline-offset-[3px]">About this tuner</a>
        </p>
      </div>
      <div class="flex min-w-0 max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 border-y border-rule py-1.5">
        <span class="text-sm text-quiet">Tuning for</span>
        <span class="min-w-0 break-words font-mono text-sm text-ink"><RichText :text="profileSummary" /></span>
        <button
          type="button"
          class="inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink underline underline-offset-[3px] hover:bg-paper-hover"
          @click="editMachine"
        >Edit machine</button>
      </div>
    </header>

    <!-- Step chain: segments on a line, the step in view a thick verdigris
         segment. Outside the title block, so from lg up it can stick under
         the site header for the whole page (its height is --step-chain-h). -->
    <nav
      aria-label="Steps"
      class="mt-6 bg-paper lg:sticky lg:top-[var(--site-header-h)] lg:z-20"
    >
      <div class="flex items-stretch gap-x-2">
        <StepChain class="min-w-0 flex-1" :steps="STEPS" :current="activeIndex" current-attr="location" truncate />
        <div class="flex xl:hidden">
          <OutlineDrawer :outline="outline" :steps="OUTLINE_STEPS" :active-step="activeStep" />
        </div>
      </div>
    </nav>

    <!-- From xl up the settings outline sits in a sticky rail left of the
         steps; the steps keep a grid-cols-1 column below that. -->
    <div
      ref="stepsGrid"
      class="grid grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-x-8"
    >
      <div class="hidden xl:col-start-1 xl:row-start-1 xl:block">
        <div class="sticky top-[calc(var(--site-header-h)+var(--step-chain-h)+1.5rem)] mt-8">
          <OutlineRail
            :expanded="railExpanded"
            :outline="outline"
            :steps="OUTLINE_STEPS"
            :active-step="activeStep"
            @update:expanded="setRailExpanded"
          />
        </div>
      </div>
      <div class="min-w-0 xl:col-start-2 xl:row-start-1">
        <div class="mt-8">
          <NeedThisBox :tuner-id="domain.id" />
        </div>

        <section :id="page.profileStep.id" class="mt-12" :class="STEP_SCROLL">
          <StepHeader :num="1" :title="page.profileStep.title" :subtitle="page.profileStep.subtitle" />
          <div class="mt-4">
            <slot name="profile"><ProfileForm /></slot>
          </div>
        </section>

        <section id="preset" class="mt-12" :class="STEP_SCROLL">
          <StepHeader :num="2" title="Pick a starting point" subtitle="Optional: jump to a tuned baseline for your workload, then fine-tune." />
          <div class="mt-4">
            <PresetSelector />
          </div>
        </section>

        <section id="tune" class="mt-12" :class="STEP_SCROLL">
          <StepHeader :num="3" title="Tune and preview" :subtitle="page.tuneSubtitle" />
          <ProfileDraftNotice class="mt-4" />
          <div v-if="hasGraphs" class="mt-6 grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-x-12">
            <!-- The graphs: open above the settings on a narrow screen, a sticky
                 column beside them from lg up. The settings come first in the
                 reading order. -->
            <div
              :id="GRAPHS_ID"
              class="min-w-0 scroll-mt-16 max-lg:order-first lg:sticky lg:col-start-2 lg:row-start-1 lg:top-[calc(var(--site-header-h)+var(--step-chain-h)+1.5rem)] lg:self-start"
            >
              <GraphPanel :tabs="graphTabs" :impact="impact" />
            </div>
            <div class="min-w-0 lg:col-start-1 lg:row-start-1">
              <ParameterPanel />
            </div>
          </div>
          <ParameterPanel v-else class="mt-6" />
        </section>

        <section id="export" class="mt-12" :class="STEP_SCROLL">
          <StepHeader :num="4" :title="page.exportStep.title" :subtitle="page.exportStep.subtitle" />
          <div class="mt-4">
            <ConfigOutput />
          </div>
        </section>
      </div>
    </div>

    <div class="mt-12 empty:hidden">
      <AdSlot :slot="page.adSlot" :label="`${domain.id} tuner footer`" />
    </div>

    <AboutSection class="mt-12" :about="domain.about" />
    <InfoDrawer />

    <!-- Spacer so the mobile impact bar never covers page content. -->
    <div v-if="impact.length" class="h-24 lg:hidden" aria-hidden="true" />
    <MobileImpactBar :impact="impact" :graphs-id="GRAPHS_ID" />
    <UndoToast :raised="impact.length > 0" />
    <IssueAnnouncer />
  </section>
</template>
