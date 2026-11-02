<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  range: { type: Object, required: true },
  labelId: { type: String, required: true },
  valueText: { type: String, required: true },
})
const emit = defineEmits(['update'])

// Slider DOM ref + uncontrolled-with-external-sync pattern.
//
// We intentionally do NOT use `:value="value"` on the range input. When Vue
// patches the value attribute mid-drag (and the store updates one full reactive
// cycle per `input` event, including validation re-runs), Chromium cancels the
// active drag — symptom: "thumb jumps once, then drag stops". The fix: only
// touch the DOM value when the store value diverges from an *external* source
// (preset apply, hardware change, URL hash restore, the card's inline number
// edit), not from the user's own drag. We mark our own commits with
// `selfWrite` so the watcher skips them.
const sliderEl = ref(null)
let selfWrite = false

onMounted(() => {
  if (sliderEl.value) sliderEl.value.value = String(props.value)
})

watch(() => props.value, (v) => {
  if (selfWrite) {
    selfWrite = false
    return
  }
  const el = sliderEl.value
  if (el && Number(el.value) !== v) el.value = String(v)
})

function commit(v) {
  selfWrite = true
  emit('update', v)
}

// --- Touch handling for the range slider ----------------------------------
//
// Native range inputs are hostile to touch scrolling: a swipe that begins on a
// full-width slider gets captured as a value change, and the control also
// commits a value on a plain tap. Combined with `touch-action: pan-y` (styles
// below), the model here is: on touch, ONLY a deliberate horizontal drag may
// change the value. A vertical swipe scrolls the page; a tap does nothing.
//
// Native value changes can't be reliably blocked mid-gesture (and a trailing
// input/click fires *after* touchend), so rather than fight them live we let
// the store track horizontal drags and then force the thumb back in sync with
// the store after the gesture settles. `isTouching` stays true through a short
// post-touchend window so that trailing event is handled, then clears so mouse
// input on hybrid devices still works.
const TOUCH_THRESHOLD = 8
let startX = 0
let startY = 0
let movedX = 0
let movedY = 0
let valueAtTouchStart = null
let isTouching = false
let touchEndTimer = null

const isVerticalSwipe = () => movedY > movedX && movedY > TOUCH_THRESHOLD
const isTap = () => movedX <= TOUCH_THRESHOLD && movedY <= TOUCH_THRESHOLD

function pinThumbTo(v) {
  const el = sliderEl.value
  if (el && Number(el.value) !== v) el.value = String(v)
}

function setValue(v) {
  // On touch, a vertical swipe or a tap must not change the value: pin the thumb
  // back to where the touch started and ignore the native input. Horizontal
  // drags (and all mouse/keyboard input) fall through and commit normally.
  if (isTouching && (isVerticalSwipe() || isTap())) {
    pinThumbTo(valueAtTouchStart)
    return
  }
  const n = Number(v)
  if (!Number.isFinite(n)) return
  commit(n)
}

function onTouchStart(e) {
  const t = e.touches[0]
  if (!t) return
  if (touchEndTimer) {
    clearTimeout(touchEndTimer)
    touchEndTimer = null
  }
  startX = t.clientX
  startY = t.clientY
  movedX = 0
  movedY = 0
  valueAtTouchStart = props.value
  isTouching = true
}

function onTouchMove(e) {
  const t = e.touches[0]
  if (!t) return
  movedX = Math.abs(t.clientX - startX)
  movedY = Math.abs(t.clientY - startY)
  // Keep the thumb still while the user is scrolling vertically.
  if (isVerticalSwipe()) pinThumbTo(valueAtTouchStart)
}

function onTouchEnd() {
  // Discard anything that wasn't a deliberate horizontal drag (scroll or tap):
  // restore the store to the value it had when the touch began.
  if (valueAtTouchStart !== null && (isVerticalSwipe() || isTap()) && props.value !== valueAtTouchStart) {
    commit(valueAtTouchStart)
  }
  // The native control can apply a trailing value change after touchend; keep
  // guarding briefly, then snap the thumb to the store value and end touch mode.
  if (touchEndTimer) clearTimeout(touchEndTimer)
  touchEndTimer = setTimeout(() => {
    pinThumbTo(props.value)
    isTouching = false
    touchEndTimer = null
  }, 80)
}

// Filled portion of the slider track, 0–100%. Drives the gradient/progress fill
// in the scoped styles below. Reactive on the store value, so it follows drags,
// preset applies, and inline edits alike. Updating this (a style custom property)
// mid-drag is safe — unlike rewriting the input's `value`, it doesn't cancel the
// drag (see the selfWrite note above).
const pct = computed(() => {
  const { min, max } = props.range
  if (max <= min) return 0
  const clamped = Math.max(min, Math.min(max, props.value))
  return ((clamped - min) / (max - min)) * 100
})
</script>

<template>
  <div class="mt-3">
    <input
      ref="sliderEl"
      type="range"
      :min="range.min"
      :max="range.max"
      :step="def.step"
      :aria-labelledby="labelId"
      :aria-valuetext="valueText"
      class="range-slider"
      :style="{ '--range-pct': pct + '%' }"
      @input="setValue($event.target.value)"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    />
    <ul v-if="def.zones" class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
      <li v-for="z in def.zones" :key="z">{{ z }}</li>
    </ul>
  </div>
</template>

<style scoped>
/* Custom range slider in the page's slate palette. Native `accent-color` only
 * tints the control; here we shape the track and thumb and draw a filled
 * progress portion up to --range-pct (set inline from the reactive `pct`).
 * Colours are the themed slate variables from tailwind.config.js, so the
 * slider follows dark mode like the classes around it (Design.md §7).
 */
.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 1.25rem; /* generous hit area; visual track is thinner */
  background: transparent;
  cursor: pointer;
  /* Let the browser own vertical panning so a downward scroll that starts on a
   * slider scrolls the page instead of being captured as a value change. Only
   * deliberate horizontal drags adjust the value. Critical on mobile, where the
   * full-width sliders otherwise swallow scroll gestures. */
  touch-action: pan-y;
}
.range-slider:focus {
  outline: none;
}

/* Track — WebKit/Blink. Gradient gives the filled-then-empty look. */
.range-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    rgb(var(--c-slate-900)) 0%,
    rgb(var(--c-slate-900)) var(--range-pct, 0%),
    rgb(var(--c-slate-200)) var(--range-pct, 0%),
    rgb(var(--c-slate-200)) 100%
  );
}
/* Track + progress — Firefox draws the fill for us via ::-moz-range-progress. */
.range-slider::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: rgb(var(--c-slate-200));
}
.range-slider::-moz-range-progress {
  height: 6px;
  border-radius: 9999px;
  background: rgb(var(--c-slate-900));
}

/* Thumb */
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  margin-top: -5px; /* centre the 16px thumb on the 6px track */
  border-radius: 9999px;
  background: rgb(var(--c-slate-900));
  border: 2px solid rgb(var(--c-white));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 1px rgb(var(--c-slate-300));
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.range-slider::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 9999px;
  background: rgb(var(--c-slate-900));
  border: 2px solid rgb(var(--c-white));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 1px rgb(var(--c-slate-300));
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.range-slider:hover::-webkit-slider-thumb {
  transform: scale(1.15);
}
.range-slider:hover::-moz-range-thumb {
  transform: scale(1.15);
}
.range-slider:active::-webkit-slider-thumb,
.range-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 4px rgba(15, 23, 42, 0.2);
}
.range-slider:active::-moz-range-thumb,
.range-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25), 0 0 0 4px rgba(15, 23, 42, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .range-slider::-webkit-slider-thumb,
  .range-slider::-moz-range-thumb {
    transition: none;
  }
}
</style>
