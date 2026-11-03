<script setup>
/**
 * /setup: the guided setup (Design.md §5 "Guided setup"). The machine
 * profile first, then one step per tuner in the registry's setup order, then
 * every file. One step shows at a time; the step list says which are skipped
 * or blocked. The page owns the link: the steps' stores never touch the hash.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SetupMachine from './SetupMachine.vue'
import SetupStep from './SetupStep.vue'
import SetupFiles from './SetupFiles.vue'
import { SETUP_STEPS } from './steps.js'
import { useSetupStore, useStepStore } from './useSetupStore.js'

const route = useRoute()
const setup = useSetupStore()
setup.init(typeof window === 'undefined' ? '' : window.location.hash.slice(1), route.query.role)

// A change in any step feeds the facts forward and rewrites the link.
watch(
  () => SETUP_STEPS.map(({ id }) => {
    const s = useStepStore(id)
    return [s.hardware, s.params, s.activePreset]
  }),
  () => {
    setup.applyFacts()
    setup.syncUrl()
  },
  { deep: true },
)
watch(() => setup.skipped, () => setup.applyFacts())

const PANELS = [
  { id: 'machine', title: 'Machine profile' },
  ...SETUP_STEPS.map((step) => ({ id: step.id, title: step.entry.title, step })),
  { id: 'files', title: 'Files' },
]

const current = ref(0)
const panel = computed(() => PANELS[current.value])
const heading = ref(null)

/** A step's state in the step list. */
function status(p) {
  if (!p.step) return null
  if (setup.skipped.includes(p.id)) return { label: 'Skipped', cls: 'bg-slate-100 text-slate-700' }
  const store = useStepStore(p.id)
  if (store.blocked) return { label: 'Blocked', cls: 'bg-red-100 text-red-800' }
  if (store.issues.length) return { label: `${store.issues.length} to check`, cls: 'bg-amber-100 text-amber-800' }
  return null
}

async function go(index) {
  current.value = Math.max(0, Math.min(PANELS.length - 1, index))
  await nextTick()
  heading.value?.focus()
  heading.value?.scrollIntoView?.({ block: 'start' })
}

const goto = (id) => go(PANELS.findIndex((p) => p.id === id))
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header class="light-palette surface-inverse overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-5 py-5 text-white shadow-sm sm:px-6 sm:py-6">
      <p class="text-xs uppercase tracking-widest text-slate-400">Guided setup</p>
      <h1 class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Tune a whole Linux machine</h1>
      <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-200">
        Describe the machine once, then go through every tuner in the order that matters: memory first, then security, the limits, and the settings those limits bound. Each step starts from values for your machine, and the last step gives you every file. Nothing leaves your browser; the link holds the whole setup.
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-4 lg:items-start">
      <nav aria-label="Setup steps" class="lg:sticky lg:top-[calc(var(--site-header-h)+1rem)]">
        <ol class="flex flex-wrap gap-1 lg:flex-col">
          <li v-for="(p, i) in PANELS" :key="p.id">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
              :class="i === current ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'"
              :aria-current="i === current ? 'step' : undefined"
              @click="go(i)"
            >
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" :class="i === current ? 'bg-white text-sky-800' : 'bg-slate-200 text-slate-700'">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1">{{ p.title }}</span>
              <span v-if="status(p)" class="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium" :class="status(p).cls">{{ status(p).label }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <div class="space-y-4 lg:col-span-3">
        <h2 ref="heading" tabindex="-1" class="scroll-mt-20 text-lg font-semibold text-slate-900 focus:outline-none">
          Step {{ current + 1 }} of {{ PANELS.length }}: {{ panel.title }}
        </h2>

        <SetupMachine v-if="panel.id === 'machine'" />
        <SetupFiles v-else-if="panel.id === 'files'" @goto="goto" />
        <SetupStep v-else :key="panel.id" :step="panel.step" :num="current + 1" />

        <div class="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            v-if="current > 0"
            type="button"
            class="rounded border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50"
            @click="go(current - 1)"
          >← {{ PANELS[current - 1].title }}</button>
          <span v-else />
          <button
            v-if="current < PANELS.length - 1"
            type="button"
            class="rounded bg-sky-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
            @click="go(current + 1)"
          >{{ PANELS[current + 1].title }} →</button>
        </div>
      </div>
    </div>
  </section>
</template>
