<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AdSlot from '@/ui/AdSlot.vue'
import { PAGE_WIDTH } from '@/ui/layout/pageWidth.js'
import MarkGlyph from '@/ui/controls/MarkGlyph.vue'
import { LIVE_TUNERS, PLANNED_TUNERS } from '@/tuners/registry.js'
import { MACHINE_ROLES, isMachineRole, tunersForRole } from '@/core/machineRoles.js'
import { LANDING_COPY as COPY, routeSummary, tunerFacts } from '@/ui/landing.js'

const route = useRoute()
const router = useRouter()

// --- The role picker and the route --------------------------------------
//
// The picked role lives in the query (/?role=database), so Back and a shared
// link keep it. Anything that isn't a known role reads as no role, which shows
// every tuner in setup order, as the prerendered page does.
const role = computed(() => (isMachineRole(route.query.role) ? route.query.role : null))
const roleLabel = computed(() => MACHINE_ROLES.find((r) => r.value === role.value)?.label)
const roleOptions = [{ value: null, label: COPY.start.anyMachine }, ...MACHINE_ROLES]

function pickRole(value) {
  router.replace({ query: value ? { role: value } : {} })
}

// A radiogroup: one tab stop on the checked radio, arrow keys move the
// selection and the focus together, wrapping at the ends (Design.md §7).
const radioEls = []
const NEXT = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
function onRadioKey(event, i) {
  const n = roleOptions.length
  let j
  if (event.key in NEXT) j = (i + NEXT[event.key] + n) % n
  else if (event.key === 'Home') j = 0
  else if (event.key === 'End') j = n - 1
  else return
  event.preventDefault()
  pickRole(roleOptions[j].value)
  radioEls[j]?.focus()
}

// Links carry only a known role from the query, nothing else from it.
const roleQuery = computed(() => (role.value ? { role: role.value } : {}))
/** The guided setup, starting from the picked role. */
const setupLink = computed(() => ({ path: '/setup', query: roleQuery.value }))

const groups = computed(() =>
  role.value ? tunersForRole(LIVE_TUNERS, role.value) : { recommended: LIVE_TUNERS, optional: [] },
)
const summary = computed(() => routeSummary(roleLabel.value, groups.value.recommended.length))
const stepNumber = (i) => String(i + 1).padStart(2, '0')

// --- The specimen --------------------------------------------------------
//
// The swap domain and the slider are lazy-loaded, so the landing chunk stays
// small. The specimen keeps its value to itself (Design.md §5 "Guided setup").
const LandingSpecimen = defineAsyncComponent(() => import('./LandingSpecimen.vue'))
const example = shallowRef(null)
async function loadExample() {
  example.value = (await import('./landingExample.js')).landingExample
}
const exampleLine = computed(() => {
  if (!example.value) return null
  const { domain, key, hardware } = example.value
  const def = domain.defsByKey[key]
  return { name: def.sysctlName, value: domain.formatValue(domain.deriveDefaults(hardware)[key], def, hardware) }
})

// --- The tuner table -----------------------------------------------------
//
// The setting counts and file paths come from each domain, loaded once the
// table comes near the screen: every domain together is far larger than this
// page. Before that the cells stay empty (the prerendered page has them).
const facts = shallowRef(null)
const table = ref(null)
let observer = null
async function loadFacts() {
  observer?.disconnect()
  observer = null
  if (facts.value) return
  const { TUNER_DOMAINS } = await import('@/tuners/domains.js')
  facts.value = Object.fromEntries(TUNER_DOMAINS.map((d) => [d.id, tunerFacts(d)]))
}

onMounted(() => {
  loadExample()
  if (typeof IntersectionObserver === 'undefined' || !table.value) {
    loadFacts()
    return
  }
  observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadFacts(), {
    rootMargin: '600px 0px',
  })
  observer.observe(table.value)
})
onBeforeUnmount(() => observer?.disconnect())

const plannedLine = PLANNED_TUNERS.length
  ? `${COPY.tuners.planned}: ${PLANNED_TUNERS.map((t) => t.title).join(', ')}.`
  : ''

const primaryButton = 'inline-flex min-h-11 items-center justify-center bg-ink px-[22px] py-3 text-base font-medium text-paper hover:bg-ink-2'
const secondaryButton = 'inline-flex min-h-11 items-center justify-center border border-ink px-[18px] py-3 text-base font-medium text-ink hover:bg-paper-hover'
</script>

<template>
  <div class="pb-4" :class="PAGE_WIDTH">
    <!-- Hero: one sentence, then the real thing to touch -->
    <section class="grid gap-x-16 gap-y-12 pb-12 pt-10 sm:pb-[72px] sm:pt-[88px] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      <div class="min-w-0">
        <h1 class="text-[34px] font-medium leading-[1.1] tracking-[-0.03em] text-ink sm:text-[52px] sm:leading-[1.08]">{{ COPY.hero.title }}</h1>
        <p class="mt-6 text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">{{ COPY.hero.lead }}</p>
        <div class="mt-8 flex flex-wrap gap-2.5">
          <RouterLink :to="{ query: roleQuery, hash: '#start' }" :class="primaryButton">{{ COPY.hero.pickRole }}</RouterLink>
          <RouterLink :to="{ query: roleQuery, hash: '#tuners' }" :class="secondaryButton">{{ COPY.hero.browse }}</RouterLink>
        </div>
        <p class="mt-7 text-sm leading-relaxed text-quiet">{{ COPY.hero.trust }}</p>
      </div>
      <LandingSpecimen v-if="example" :example="example" />
      <!-- Holds the specimen's place while the swap domain loads. -->
      <div v-else class="min-h-[28rem] border-t border-ink pt-2.5 text-sm text-quiet" role="status">
        <span class="sr-only">{{ COPY.specimen.loading }}</span>
      </div>
    </section>

    <!-- The key: the three marks, taught once -->
    <section :aria-label="COPY.key.label" class="border-y border-rule py-7">
      <ul class="grid gap-x-12 gap-y-6 md:grid-cols-3">
        <li v-for="mark in COPY.key.marks" :key="mark.kind" class="flex items-start gap-3.5">
          <MarkGlyph :kind="mark.kind" class="mt-1.5" />
          <p class="text-[15px] leading-normal text-ink-2">
            <strong
              class="font-semibold"
              :class="{ 'text-ink': mark.kind === 'default', 'text-fit-text': mark.kind === 'fit', 'text-mine-text': mark.kind === 'mine' }"
            >{{ mark.label }}.</strong>
            {{ mark.text }}
          </p>
        </li>
      </ul>
    </section>

    <!-- Why -->
    <section id="how" aria-labelledby="why-heading" class="grid gap-x-16 gap-y-10 pt-16 sm:pt-24 lg:grid-cols-2">
      <div>
        <h2 id="why-heading" class="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">{{ COPY.why.heading }}</h2>
        <p class="mt-4 text-[17px] leading-relaxed text-ink-2">{{ COPY.why.text }}</p>
      </div>
      <div class="grid grid-cols-2 border-t border-ink">
        <div class="min-w-0 border-r border-rule pr-4 pt-4 sm:pr-5">
          <p class="text-sm text-quiet">{{ COPY.why.forum.label }}</p>
          <p class="mt-3.5 break-words font-mono text-[15px] leading-relaxed text-quiet">{{ COPY.why.forum.line }}</p>
          <ul class="mt-4 space-y-2 text-[15px] text-ink-2">
            <li v-for="point in COPY.why.forum.points" :key="point">{{ point }}</li>
          </ul>
        </div>
        <div class="min-w-0 pl-4 pt-4 sm:pl-5">
          <p class="text-sm text-fit-text">{{ COPY.why.site.label }}</p>
          <p class="mt-3.5 min-h-[1.625em] break-words font-mono text-[15px] leading-relaxed text-ink">
            <template v-if="exampleLine">{{ exampleLine.name }} = <span class="text-fit-text">{{ exampleLine.value }}</span></template>
          </p>
          <p v-if="example" class="mt-1 text-[13px] text-quiet">{{ example.summary }}</p>
          <ul class="mt-4 space-y-2 text-[15px] text-ink">
            <li v-for="point in COPY.why.site.points" :key="point">{{ point }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Start: the role list beside the route for the picked role -->
    <section id="start" aria-labelledby="role-heading" class="scroll-mt-4 lg:scroll-mt-[calc(var(--site-header-h)+1rem)] pt-20 sm:pt-28">
      <h2 id="role-heading" class="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">{{ COPY.start.heading }}</h2>
      <p id="role-intro" class="mt-3 text-[17px] leading-relaxed text-ink-2">{{ COPY.start.intro }}</p>
      <!-- Wide: roles and route side by side, the route's header row sticky
           under the site header while the route column (at least as tall as
           the roles) is in view. Narrow: the roles, then that row, sticky at
           the bottom of the screen while the roles are in view (its
           containing block is this wrapper, from the roles' top). Either way
           the button stays in view with the picked role. -->
      <div class="mt-9 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16">
        <div
          role="radiogroup"
          aria-labelledby="role-heading"
          aria-describedby="role-intro"
          class="min-w-0 border-t border-ink"
        >
          <button
            v-for="(r, i) in roleOptions"
            :key="r.value ?? 'any'"
            :ref="(el) => (radioEls[i] = el)"
            type="button"
            role="radio"
            :aria-checked="role === r.value"
            :tabindex="role === r.value ? 0 : -1"
            class="flex min-h-14 w-full items-center gap-4 border-b border-rule py-3.5 pl-3 pr-3 text-left text-[17px] text-ink"
            :class="role === r.value ? 'bg-fit-tint font-medium' : 'hover:bg-paper-hover'"
            @click="pickRole(r.value)"
            @keydown="onRadioKey($event, i)"
          >
            <span
              aria-hidden="true"
              class="h-[18px] w-[18px] shrink-0 rounded-full bg-paper"
              :class="role === r.value ? 'border-[6px] border-fit' : 'border-[1.5px] border-quiet'"
            />
            <span class="min-w-0">{{ r.label }}</span>
          </button>
        </div>

        <div class="contents lg:block lg:min-w-0 lg:border-t lg:border-ink" data-route>
          <!-- The primary action sits in the route's header row, above the
               route, whose length depends on the role (Design.md §5 "Guided setup"). -->
          <div class="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-b-rule border-t-ink bg-paper py-3 lg:bottom-auto lg:py-1.5 lg:top-[var(--site-header-h)] lg:mt-0 lg:border-t-0">
            <p class="text-sm text-quiet" aria-live="polite">{{ summary }}</p>
            <RouterLink :to="setupLink" :class="primaryButton" data-setup-button>{{ COPY.start.setupButton }}</RouterLink>
          </div>
          <ol>
            <li
              v-for="(tuner, i) in groups.recommended"
              :key="tuner.id"
              class="grid grid-cols-[44px_minmax(0,1fr)] gap-2 border-b border-rule py-3.5"
            >
              <span class="font-mono text-sm leading-[1.6] text-fit-text">{{ stepNumber(i) }}</span>
              <span class="min-w-0">
                <RouterLink :to="tuner.path" class="text-[17px] font-medium text-ink underline-offset-[3px] hover:underline">{{ tuner.title }}</RouterLink>
                <span v-if="role" class="mt-0.5 block text-sm leading-normal text-quiet">{{ tuner.setup.why }}</span>
              </span>
            </li>
          </ol>
          <p v-if="groups.optional.length" class="mt-3.5 text-sm leading-normal text-quiet">
            {{ COPY.start.fineToLeave }}:
            <template v-for="(tuner, i) in groups.optional" :key="tuner.id"><RouterLink :to="tuner.path" class="text-ink-2 underline underline-offset-[3px] hover:text-ink">{{ tuner.title }}</RouterLink>{{ i < groups.optional.length - 1 ? ', ' : '.' }}</template>
          </p>
        </div>
      </div>
    </section>

    <!-- Every tuner, as a spec sheet -->
    <section id="tuners" aria-labelledby="tuners-heading" class="scroll-mt-4 lg:scroll-mt-[calc(var(--site-header-h)+1rem)] pt-20 sm:pt-28">
      <h2 id="tuners-heading" class="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">{{ COPY.tuners.heading }}</h2>
      <!-- A wide table scrolls in its own box, never the page (Design.md §7). -->
      <div ref="table" class="mt-7 overflow-x-auto" tabindex="0" role="region" :aria-label="COPY.tuners.tableLabel">
        <table class="w-full min-w-[52rem] border-collapse text-base" :aria-busy="!facts">
          <thead>
            <tr class="border-y border-b-rule border-t-ink text-left text-[13px] text-quiet">
              <th scope="col" class="py-2.5 pr-4 font-medium">{{ COPY.tuners.columns.question }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ COPY.tuners.columns.tuner }}</th>
              <th scope="col" class="px-4 py-2.5 text-right font-medium">{{ COPY.tuners.columns.settings }}</th>
              <th scope="col" class="py-2.5 pl-4 font-medium">{{ COPY.tuners.columns.writes }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tuner in LIVE_TUNERS" :key="tuner.id" class="border-b border-rule align-top hover:bg-paper-hover">
              <td class="py-4 pr-4">
                <RouterLink :to="tuner.path" class="font-medium text-ink underline-offset-[3px] hover:underline">{{ tuner.question }}</RouterLink>
              </td>
              <td class="px-4 py-4 text-ink-2">{{ tuner.title }}</td>
              <td class="px-4 py-4 text-right font-mono text-sm text-ink-2">{{ facts?.[tuner.id].settings }}</td>
              <td class="py-4 pl-4 font-mono text-sm text-ink-2">
                <span v-for="path in facts?.[tuner.id].writes ?? []" :key="path" class="block whitespace-nowrap">{{ path }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="plannedLine" class="mt-4 text-sm text-quiet">{{ plannedLine }}</p>
    </section>

    <!-- Below the table, so the role picker stays near the top on a phone. -->
    <div class="pt-20">
      <AdSlot slot="landing" label="landing" />
    </div>
  </div>
</template>
