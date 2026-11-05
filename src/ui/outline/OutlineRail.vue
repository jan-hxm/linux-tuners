<script setup>
/**
 * The settings outline as a sticky rail left of the steps, from xl up
 * (Design.md §7 "Settings outline"). Expanded it shows OutlineList; collapsed
 * it is a thin ruler with one tick per setting shown: the one in view a thick
 * `fit` tick, a changed one with the `mine` dot, each a link named by its
 * title. The toggle is one button with `aria-expanded`, so focus stays on it.
 * Whether it is expanded lives in the page's memory only (no storage).
 */
import { ref, watch, nextTick, useId } from 'vue'
import OutlineList from './OutlineList.vue'

const props = defineProps({
  outline: { type: Object, required: true },
  steps: { type: Array, required: true },
  activeStep: { type: String, default: null },
  tuneStepId: { type: String, default: 'tune' },
})

const expanded = defineModel('expanded', { type: Boolean, default: true })
const bodyId = useId()
const scroller = ref(null)

function toAnchor(e, anchor) {
  e.preventDefault()
  props.outline.goTo(anchor)
}

// The rail scrolls on its own when it is taller than the window: keep what is
// in view on screen in it, without scrolling the page.
watch(
  () => props.outline.activeAnchor.value,
  async () => {
    await nextTick()
    const box = scroller.value
    const el = box?.querySelector('[aria-current="location"]')
    if (!box || !el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3)
    }
  },
)
</script>

<template>
  <nav
    aria-label="Settings outline"
    class="flex max-h-[calc(100vh-var(--site-header-h)-var(--step-chain-h)-3rem)] flex-col"
    :class="expanded ? 'w-48' : 'w-10'"
  >
    <button
      type="button"
      class="inline-flex min-h-6 shrink-0 items-center gap-2 py-1 text-sm font-medium text-ink hover:bg-paper-hover"
      :class="expanded ? 'w-full justify-between border-b border-ink pb-2' : 'w-10 justify-center'"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      <span :class="expanded ? '' : 'sr-only'">Outline</span>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <path v-if="expanded" d="M9 2 4 7l5 5" />
        <path v-else d="M5 2l5 5-5 5" />
      </svg>
    </button>
    <!-- Its own scroll box: padded so focus rings aren't clipped. -->
    <div :id="bodyId" ref="scroller" class="min-h-0 flex-1 overflow-y-auto p-1 pt-2">
      <OutlineList v-if="expanded" :outline="outline" :steps="steps" :active-step="activeStep" :tune-step-id="tuneStepId" />
      <ul v-else class="space-y-2">
        <li v-for="group in outline.groups.value" :key="group.id" class="border-t border-ink pt-1">
          <ul>
            <li v-for="item in group.items" :key="item.key">
              <a
                :href="`#${item.anchor}`"
                class="relative flex h-6 w-8 items-center hover:bg-paper-hover"
                :aria-label="item.label"
                :aria-current="outline.activeAnchor.value === item.anchor ? 'location' : undefined"
                @click="toAnchor($event, item.anchor)"
              >
                <span
                  aria-hidden="true"
                  data-tick
                  :class="outline.activeAnchor.value === item.anchor ? 'h-1 w-5 bg-fit' : 'h-px w-3 bg-rule-strong'"
                />
                <span v-if="item.changed" data-mark="mine" aria-hidden="true" class="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-mine" />
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </nav>
</template>
