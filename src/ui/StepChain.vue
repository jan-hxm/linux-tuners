<script setup>
/**
 * Steps as segments on a line (REDESIGN §3, "the motif is the ruler tick"):
 * the current step a thick verdigris segment, the ones behind it darker than
 * the ones ahead. Shared by the tuner page (links to its sections, marked
 * `aria-current="location"` as the reader scrolls) and the guided setup
 * (buttons that switch the step, `aria-current="step"`). The parent owns the
 * `<nav>` and its label, so it can make the chain sticky.
 *
 * A step can carry a status (the setup's "Skipped", "Blocked", "N to check"),
 * said in text with a mark in front, so it never rests on colour alone.
 */

/**
 * @typedef {object} ChainStep
 * @property {string} id
 * @property {string} label
 * @property {string} mark          the mono number in front, "01"
 * @property {string} [href]        a link to the step; without one the step is a button
 * @property {{ label: string, mark: string, cls: string, seg?: string, error?: boolean } | null} [status]
 */

defineProps({
  /** @type {import('vue').PropType<ChainStep[]>} */
  steps: { type: Array, required: true },
  /** The current step's index; steps before it are behind. Past the last, none is current. */
  current: { type: Number, required: true },
  /** The `aria-current` value the current step carries. */
  currentAttr: { type: String, default: 'step' },
  /** Grid columns (and gap) per breakpoint. */
  gridClass: { type: String, default: 'grid-cols-2 sm:grid-cols-4' },
  /** Keep each label on one line (the tuner chain's height is measured: --step-chain-h). */
  truncate: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

/** The segment above a step: the current one thick, earlier ones darker. */
function segment(step, i, current) {
  if (i === current) return ['border-t-4', step.status?.error ? 'border-error' : 'border-fit']
  return ['border-t-2 pt-0.5', step.status?.seg || (i < current ? 'border-rule-strong' : 'border-rule')]
}
</script>

<template>
  <ol class="grid" :class="gridClass">
    <li v-for="(step, i) in steps" :key="step.id" class="min-w-0">
      <component
        :is="step.href ? 'a' : 'button'"
        :href="step.href"
        :type="step.href ? undefined : 'button'"
        class="flex min-h-11 w-full flex-col items-start justify-center py-1 pr-3 text-left text-[15px] hover:bg-paper-hover"
        :class="[segment(step, i, current), i === current ? 'font-medium text-ink' : 'text-ink-2']"
        :aria-current="i === current ? currentAttr : undefined"
        @click="step.href ? undefined : emit('select', i)"
      >
        <span class="flex w-full min-w-0 items-baseline gap-2.5">
          <span class="font-mono text-[13px]" :class="i === current ? 'text-fit-text' : 'text-quiet'">{{ step.mark }}</span>
          <span class="min-w-0 flex-1 leading-snug" :class="{ truncate }">{{ step.label }}</span>
        </span>
        <span v-if="step.status" class="text-[13px]" :class="step.status.cls">
          <span aria-hidden="true" class="mr-1">{{ step.status.mark }}</span>{{ step.status.label }}
        </span>
      </component>
    </li>
  </ol>
</template>
