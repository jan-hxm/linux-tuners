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

/**
 * A step's state in the step list, said in text with a mark in front, so it
 * never rests on colour alone: "Skipped", "Blocked" or "N to check".
 */
function status(p) {
  if (!p.step) return null
  if (setup.skipped.includes(p.id)) return { label: 'Skipped', mark: '–', cls: 'text-quiet', seg: 'border-dashed border-rule-strong' }
  const store = useStepStore(p.id)
  if (store.blocked) return { label: 'Blocked', mark: '×', cls: 'font-medium text-error', seg: 'border-error' }
  if (store.issues.length) return { label: `${store.issues.length} to check`, mark: '!', cls: 'text-ink-2', seg: '' }
  return null
}

/** The segment above a step: the current one thick, earlier ones darker. */
function segment(p, i) {
  const st = status(p)
  if (i === current.value) return ['border-t-4', st?.seg.includes('border-error') ? 'border-error' : 'border-fit']
  return ['border-t-2 pt-0.5', st?.seg || (i < current.value ? 'border-rule-strong' : 'border-rule')]
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
  <section class="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
    <header class="border-t border-ink pt-4">
      <p class="font-mono text-[13px] text-quiet">Guided setup</p>
      <h1 class="mt-2 text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">Tune a whole Linux machine</h1>
      <p class="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">
        Describe the machine once, then go through every tuner in the order that matters: memory first, then security, the limits, and the settings those limits bound. Each step starts from values for your machine, and the last step gives you every file. Nothing leaves your browser; the link holds the whole setup.
      </p>
    </header>

    <!-- Step list: one segment per step on a scale, the current step thick. -->
    <nav aria-label="Setup steps" class="mt-8">
      <ol class="grid grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-6">
        <li v-for="(p, i) in PANELS" :key="p.id" class="min-w-0">
          <button
            type="button"
            class="flex min-h-11 w-full flex-col items-start justify-center py-1 pr-2 text-left text-[15px] hover:bg-paper-hover"
            :class="[segment(p, i), i === current ? 'font-medium text-ink' : 'text-ink-2']"
            :aria-current="i === current ? 'step' : undefined"
            @click="go(i)"
          >
            <span class="flex w-full items-baseline gap-2">
              <span class="font-mono text-[13px]" :class="i === current ? 'text-fit-text' : 'text-quiet'">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="min-w-0 flex-1 leading-snug">{{ p.title }}</span>
            </span>
            <span v-if="status(p)" class="text-[13px]" :class="status(p).cls">
              <span aria-hidden="true">{{ status(p).mark }} </span>{{ status(p).label }}
            </span>
          </button>
        </li>
      </ol>
    </nav>

    <div class="mt-10 space-y-6">
      <h2 ref="heading" tabindex="-1" class="scroll-mt-20 text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink focus:outline-none">
        Step {{ current + 1 }} of {{ PANELS.length }}: {{ panel.title }}
      </h2>

      <SetupMachine v-if="panel.id === 'machine'" />
      <SetupFiles v-else-if="panel.id === 'files'" @goto="goto" />
      <SetupStep v-else :key="panel.id" :step="panel.step" :num="current + 1" />

      <div class="flex items-center justify-between gap-3 border-t border-rule pt-4">
        <button
          v-if="current > 0"
          type="button"
          class="min-h-11 border border-rule-strong px-4 text-sm font-medium text-ink hover:bg-paper-hover"
          @click="go(current - 1)"
        >← {{ PANELS[current - 1].title }}</button>
        <span v-else />
        <button
          v-if="current < PANELS.length - 1"
          type="button"
          class="min-h-11 bg-ink px-5 text-[15px] font-medium text-paper hover:bg-ink-2"
          @click="go(current + 1)"
        >{{ PANELS[current + 1].title }} →</button>
      </div>
    </div>
  </section>
</template>
