<script setup>
/**
 * The settings outline below xl, where there is no rail (Design.md §7
 * "Settings outline"): an "Outline" button beside the step chain opens the
 * same list in a drawer from the left. It traps focus, closes on Escape and
 * returns focus to the button, or, after a choice, closes and puts focus on
 * the card chosen.
 */
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useId } from 'vue'
import OutlineList from './OutlineList.vue'
import { trapTab } from '@/ui/focusTrap.js'

defineProps({
  outline: { type: Object, required: true },
  steps: { type: Array, required: true },
  activeStep: { type: String, default: null },
  tuneStepId: { type: String, default: 'tune' },
})

const isOpen = ref(false)
const opener = ref(null)
const panel = ref(null)
const closeBtn = ref(null)
const dialogId = useId()
/** Set when a choice moves focus to the page, so closing doesn't take it back. */
let navigated = false

function close() {
  isOpen.value = false
}

function onNavigate() {
  navigated = true
  close()
}

function onKey(e) {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(isOpen, async (open) => {
  if (open) {
    navigated = false
    await nextTick()
    closeBtn.value?.focus()
  } else if (!navigated) {
    opener.value?.focus()
  }
})
</script>

<template>
  <button
    ref="opener"
    type="button"
    class="inline-flex min-h-11 shrink-0 items-center gap-2 border-t-2 border-rule px-3 text-[15px] text-ink-2 hover:bg-paper-hover hover:text-ink"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    :aria-controls="isOpen ? dialogId : undefined"
    @click="isOpen = true"
  >
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 3h12M4 7h9M4 11h9" /></svg>
    Outline
  </button>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-40 bg-black/40" aria-hidden="true" @click="close" />
    <div
      v-if="isOpen"
      :id="dialogId"
      ref="panel"
      class="fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col overflow-y-auto border-r border-ink bg-paper text-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Settings outline"
      @keydown="trapTab($event, panel)"
    >
      <div class="sticky top-0 flex items-center justify-between gap-3 border-b border-ink bg-paper px-4 py-3">
        <p class="text-[15px] font-medium">Outline</p>
        <button
          ref="closeBtn"
          type="button"
          class="inline-flex min-h-11 shrink-0 items-center gap-2 border border-rule-strong px-3 text-sm font-medium hover:bg-paper-hover"
          @click="close"
        >Close <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2l10 10M12 2 2 12" /></svg></button>
      </div>
      <nav aria-label="Settings outline" class="px-3 py-3">
        <OutlineList :outline="outline" :steps="steps" :active-step="activeStep" :tune-step-id="tuneStepId" @navigate="onNavigate" />
      </nav>
    </div>
  </Teleport>
</template>
