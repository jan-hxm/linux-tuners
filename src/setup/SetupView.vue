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
import StepChain from '@/ui/StepChain.vue'
import { PAGE_WIDTH } from '@/ui/layout/pageWidth.js'
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
  if (store.blocked) return { label: 'Blocked', mark: '×', cls: 'font-medium text-error', seg: 'border-error', error: true }
  if (store.issues.length) return { label: `${store.issues.length} to check`, mark: '!', cls: 'text-ink-2', seg: '' }
  return null
}

/** The step list: each step with its number and, where it has one, its status. */
const CHAIN = computed(() =>
  PANELS.map((p, i) => ({ id: p.id, label: p.title, mark: String(i + 1).padStart(2, '0'), status: status(p) })),
)

async function go(index) {
  current.value = Math.max(0, Math.min(PANELS.length - 1, index))
  await nextTick()
  heading.value?.focus()
  heading.value?.scrollIntoView?.({ block: 'start' })
}

const goto = (id) => go(PANELS.findIndex((p) => p.id === id))
</script>

<template>
  <section class="pb-16 pt-10" :class="PAGE_WIDTH">
    <header class="border-t border-ink pt-4">
      <p class="font-mono text-[13px] text-quiet">Guided setup</p>
      <h1 class="mt-2 text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">Tune a whole Linux machine</h1>
      <p class="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">
        Describe the machine once, then go through every tuner in the order that matters: memory first, then security, the limits, and the settings those limits bound. Each step starts from values for your machine, and the last step gives you every file. Nothing leaves your browser; the link holds the whole setup.
      </p>
    </header>

    <!-- Step list: one segment per step on a scale, the current step thick. -->
    <nav aria-label="Setup steps" class="mt-8">
      <StepChain :steps="CHAIN" :current="current" grid-class="grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-6" @select="go" />
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
