<script setup>
/**
 * "Undo" toast after a reset, a preset snap or (in the guided setup) a
 * machine-profile change, fed by the provided store's undoState.
 * It hides itself after a few seconds, but not while the pointer or focus is
 * on it, and Escape dismisses it. After an undo, focus goes back to the
 * control that triggered the snap, since the toast's own button disappears.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useActiveTuner, useTunerDomain } from '@/ui/useActiveTuner.js'

const props = defineProps({
  /** Sit above the mobile impact bar below lg. */
  raised: { type: Boolean, default: false },
})

const HIDE_AFTER_MS = 8000

const tuner = useActiveTuner()
const domain = useTunerDomain()

const message = computed(() => {
  const undo = tuner.undoState
  if (!undo) return ''
  if (undo.kind === 'preset') return `Applied the ${domain.presetsById[undo.presetId].label} preset.`
  if (undo.kind === 'machine') return 'Updated every step for the new machine profile.'
  return 'Reset to the defaults for your profile.'
})

let timer = null
let returnFocus = null
const held = ref(false)

function startTimer() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!held.value) tuner.dismissUndo()
  }, HIDE_AFTER_MS)
}

watch(() => tuner.undoState, (undo) => {
  if (!undo) {
    clearTimeout(timer)
    return
  }
  if (typeof document !== 'undefined') returnFocus = document.activeElement
  startTimer()
})

function hold() {
  held.value = true
}

function release() {
  held.value = false
  if (tuner.undoState) startTimer()
}

function undo() {
  tuner.undo()
  held.value = false
  if (returnFocus?.isConnected) returnFocus.focus()
}

function dismiss() {
  tuner.dismissUndo()
  held.value = false
  if (returnFocus?.isConnected) returnFocus.focus()
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  tuner.dismissUndo()
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
    :class="props.raised ? 'bottom-24 lg:bottom-4' : 'bottom-4'"
    aria-live="polite"
  >
    <div
      v-if="tuner.undoState"
      class="surface-inverse pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
      @mouseenter="hold"
      @mouseleave="release"
      @focusin="hold"
      @focusout="release"
      @keydown.esc="dismiss"
    >
      <span>{{ message }}</span>
      <button type="button" class="font-semibold text-sky-300 underline hover:text-sky-200" @click="undo">
        Undo
      </button>
      <button type="button" class="text-slate-300 hover:text-white" aria-label="Dismiss" @click="dismiss">
        ✕
      </button>
    </div>
  </div>
</template>
