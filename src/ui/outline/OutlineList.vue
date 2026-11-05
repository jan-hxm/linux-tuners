<script setup>
/**
 * The settings outline as a list (Design.md §7 "Settings outline"): the
 * steps, under Tune each group and under each group the settings it shows,
 * by title on one line. What is in view is a thick `fit` segment on the line,
 * as in the step chain, with `aria-current="location"`. A changed setting
 * carries the `mine` dot and one with a warning or error its mark, each said
 * in words too. A collapsed group or hidden advanced settings are one "+N"
 * line that opens them. Shared by the rail (xl and up) and the drawer.
 *
 * The links scroll with script rather than following their hash, since the
 * page's hash holds the shared-link state.
 */
import { focusAnchor } from './useOutline.js'

const props = defineProps({
  /** @type {import('vue').PropType<ReturnType<typeof import('./useOutline.js').useOutline>>} */
  outline: { type: Object, required: true },
  /** @type {import('vue').PropType<{ id: string, label: string, mark: string }[]>} */
  steps: { type: Array, required: true },
  /** The step in view. */
  activeStep: { type: String, default: null },
  /** The step whose children are the groups. */
  tuneStepId: { type: String, default: 'tune' },
})

const emit = defineEmits(['navigate'])

function toStep(e, step) {
  e.preventDefault()
  focusAnchor(step.id)
  emit('navigate')
}

function toAnchor(e, anchor) {
  e.preventDefault()
  emit('navigate')
  props.outline.goTo(anchor)
}

function openMore(groupId) {
  emit('navigate')
  props.outline.openMore(groupId)
}

/** A row on the rail line: thin `rule`, or the thick `fit` segment when current. */
const row = (current) =>
  current ? 'border-l-4 border-fit pl-2.5 font-medium text-ink' : 'border-l-2 border-rule pl-3 text-ink-2 hover:text-ink'
const LINK = 'flex min-h-6 w-full min-w-0 items-center gap-2 py-0.5 pr-1 text-left hover:bg-paper-hover'
</script>

<template>
  <ol class="text-sm leading-snug">
    <li v-for="step in steps" :key="step.id">
      <a
        :href="`#${step.id}`"
        :class="[LINK, row(step.id === activeStep && !outline.activeAnchor.value)]"
        :aria-current="step.id === activeStep && !outline.activeAnchor.value ? 'location' : undefined"
        @click="toStep($event, step)"
      >
        <span class="font-mono text-[13px] text-quiet" aria-hidden="true">{{ step.mark }}</span>
        <span class="min-w-0 truncate">{{ step.label }}</span>
      </a>
      <ul v-if="step.id === tuneStepId && outline.groups.value.length">
        <li v-for="group in outline.groups.value" :key="group.id">
          <a
            :href="`#${group.anchor}`"
            :class="[LINK, row(outline.activeAnchor.value === group.anchor), 'pt-2 text-ink']"
            :aria-current="outline.activeAnchor.value === group.anchor ? 'location' : undefined"
            @click="toAnchor($event, group.anchor)"
          >
            <span class="min-w-0 truncate pl-3 font-medium">{{ group.title }}</span>
          </a>
          <ul v-if="group.items.length || group.more">
            <li v-for="item in group.items" :key="item.key">
              <a
                :href="`#${item.anchor}`"
                :class="[LINK, row(outline.activeAnchor.value === item.anchor)]"
                :aria-current="outline.activeAnchor.value === item.anchor ? 'location' : undefined"
                :aria-label="item.label"
                @click="toAnchor($event, item.anchor)"
              >
                <span class="min-w-0 flex-1 truncate pl-6">{{ item.title }}</span>
                <svg
                  v-if="item.issue === 'error'"
                  aria-hidden="true"
                  data-mark="error"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  class="shrink-0 text-error"
                ><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></svg>
                <svg
                  v-else-if="item.issue === 'warn'"
                  aria-hidden="true"
                  data-mark="warn"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  class="shrink-0 text-mine-text"
                ><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
                <span v-if="item.changed" data-mark="mine" aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full bg-mine" />
              </a>
            </li>
            <li v-if="group.more">
              <button
                type="button"
                :class="[LINK, row(false), 'text-quiet']"
                :aria-label="`${group.moreLabel} in ${group.title}, show`"
                @click="openMore(group.id)"
              >
                <span class="min-w-0 truncate pl-6">{{ group.moreLabel }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </li>
  </ol>
</template>
