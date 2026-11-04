<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { pctOf, inRange, scaleTicks } from './scale.js'

const props = defineProps({
  def: { type: Object, required: true },
  value: { type: Number, required: true },
  range: { type: Object, required: true },
  labelId: { type: String, required: true },
  valueText: { type: String, required: true },
  // The value that fits the profile (the store's profileDefaults), drawn as
  // the verdigris bar; null draws none.
  fitValue: { type: Number, default: null },
  // The value differs from fitValue (the card's "changed by you" state),
  // which adds the ochre dot above the scale.
  changed: { type: Boolean, default: false },
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

// A value change can resize things above the slider (a validation message in
// an earlier card, a section's issue count wrapping its header on a phone),
// which would shift the track under the pointer mid-drag. After the DOM
// updates, scroll by however far the track moved so it stays put on screen.
function commit(v) {
  selfWrite = true
  const el = sliderEl.value
  const top = el?.getBoundingClientRect().top
  emit('update', v)
  if (el) {
    nextTick(() => {
      const shift = el.getBoundingClientRect().top - top
      // Instant: the page's smooth scrolling would lag behind the drag.
      if (shift) window.scrollBy({ top: shift, behavior: 'instant' })
    })
  }
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

// Where the value sits on the scale, 0-100%. Drives the ink fill and the
// "changed by you" dot. Reactive on the store value, so it follows drags,
// preset applies and inline edits alike. Updating a style mid-drag is safe;
// unlike rewriting the input's `value`, it doesn't cancel the drag (see the
// selfWrite note above).
const pct = computed(() => pctOf(props.value, props.range))

// The three marks (REDESIGN §3): a thin ink tick at the kernel (or systemd)
// default, a heavier verdigris bar at the value that fits the profile, and an
// ochre dot above the scale at the value once it differs from that. Each is
// drawn only inside the range. The dot never replaces the thumb: the thumb
// is the handle, the dot says whose value it is.
const defaultPct = computed(() => (inRange(props.def.kernelDefault, props.range) ? pctOf(props.def.kernelDefault, props.range) : null))
const fitPct = computed(() => (inRange(props.fitValue, props.range) ? pctOf(props.fitValue, props.range) : null))
// Where the fit bar and the default tick share a spot, the bar sits just
// right of the tick instead of hiding it.
const fitBesideDefault = computed(() => fitPct.value !== null && fitPct.value === defaultPct.value)

const ticks = computed(() => scaleTicks(props.range))
const labelledTicks = computed(() => ticks.value.major.filter((t) => t.label))

/**
 * Keeps the numbers inside the scale: one at or near the start begins at its
 * tick, one at or near the end finishes at it, the rest are centred on theirs.
 */
function labelShift(p) {
  if (p <= 8) return 'translateX(0)'
  if (p >= 92) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

/** The zone holding the value: the first whose min..max does. */
const currentZone = computed(() =>
  props.def.zones?.find((z) => z.min !== undefined && z.min <= props.value && props.value <= z.max) ?? null,
)
</script>

<template>
  <div class="mt-4">
    <!-- 80px tall whatever the value, so the card holds its height mid-drag.
         The marks sit in a box inset by half the thumb (12px), the stretch
         the thumb's centre travels, so a mark lines up with the thumb at its
         value. -->
    <div class="relative h-20">
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-3 inset-y-0">
        <span class="absolute inset-x-0 top-[33px] h-px bg-rule-strong" />
        <span data-mark="fill" class="absolute left-0 top-[32px] h-0.5 bg-ink" :style="{ width: `${pct}%` }" />
        <span
          v-for="p in ticks.minor"
          :key="`m${p}`"
          class="absolute top-[27px] h-1.5 w-px -translate-x-1/2 bg-rule-strong"
          :style="{ left: `${p}%` }"
        />
        <span
          v-for="t in ticks.major"
          :key="`M${t.value}`"
          data-mark="major"
          class="absolute top-[22px] h-[11px] w-px -translate-x-1/2 bg-ink"
          :style="{ left: `${t.pct}%` }"
        />
        <span
          v-if="defaultPct !== null"
          data-mark="default"
          class="absolute top-[15px] h-[18px] w-0.5 -translate-x-1/2 bg-ink"
          :style="{ left: `${defaultPct}%` }"
        />
        <span
          v-if="fitPct !== null"
          data-mark="fit"
          class="absolute top-[9px] h-6 w-1 bg-fit"
          :class="fitBesideDefault ? 'translate-x-px' : '-translate-x-1/2'"
          :style="{ left: `${fitPct}%` }"
        />
        <span
          v-if="changed"
          data-mark="mine"
          class="absolute top-0 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-mine"
          :style="{ left: `${pct}%` }"
        />
        <span
          v-for="t in labelledTicks"
          :key="`l${t.value}`"
          class="absolute top-[58px] whitespace-nowrap font-mono text-[13px] leading-none text-quiet"
          :style="{ left: `${t.pct}%`, transform: labelShift(t.pct) }"
        >{{ t.label }}</span>
      </div>
      <!-- No :value binding: see the selfWrite note in the script. -->
      <input
        ref="sliderEl"
        type="range"
        :min="range.min"
        :max="range.max"
        :step="def.step"
        :aria-labelledby="labelId"
        :aria-valuetext="valueText"
        class="range-slider absolute inset-x-0 top-[11px]"
        @input="setValue($event.target.value)"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      />
    </div>
    <!-- Zones stay a list rather than labels under their stretch, which is
         mostly too narrow for them (Design.md §7). -->
    <ul v-if="def.zones" class="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]">
      <li
        v-for="z in def.zones"
        :key="z.label"
        :class="z === currentZone ? 'font-semibold text-ink' : 'text-quiet'"
      >{{ z.label }}</li>
    </ul>
  </div>
</template>

<style scoped>
/* The input is only the handle: its track is transparent over the printed
 * scale, and its thumb is what says "drag me" (REDESIGN §4 decision 8): a
 * filled ink disc of 24px with a 3px paper ring on a 44px tall hit area,
 * larger on hover and while dragged. The focus ring is the global one from
 * main.css, around the hit area. Colours are the theme tokens, so the slider
 * follows dark mode.
 */
.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 44px;
  margin: 0;
  background: transparent;
  cursor: grab;
  /* Let the browser own vertical panning so a downward scroll that starts on a
   * slider scrolls the page instead of being captured as a value change. Only
   * deliberate horizontal drags adjust the value. Critical on mobile, where the
   * full-width sliders otherwise swallow scroll gestures. */
  touch-action: pan-y;
}
.range-slider:active {
  cursor: grabbing;
}

.range-slider::-webkit-slider-runnable-track {
  height: 44px;
  background: transparent;
}
.range-slider::-moz-range-track {
  height: 44px;
  background: transparent;
}
.range-slider::-moz-range-progress {
  background: transparent;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  margin-top: 10px; /* centre the thumb in the 44px track */
  border-radius: 9999px;
  background: rgb(var(--t-ink));
  border: 3px solid rgb(var(--t-paper));
  /* A 1px ink ring outside the paper one, so the thumb reads over any mark. */
  box-shadow: 0 0 0 1px rgb(var(--t-ink));
  transition: transform 0.12s ease;
}
.range-slider::-moz-range-thumb {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: rgb(var(--t-ink));
  border: 3px solid rgb(var(--t-paper));
  box-shadow: 0 0 0 1px rgb(var(--t-ink));
  transition: transform 0.12s ease;
}

/* Larger on hover and while dragged. A transform rather than a new size, so
 * the thumb's centre, and the marks lined up with it, stay put. */
.range-slider:hover::-webkit-slider-thumb,
.range-slider:active::-webkit-slider-thumb {
  transform: scale(1.25);
}
.range-slider:hover::-moz-range-thumb,
.range-slider:active::-moz-range-thumb {
  transform: scale(1.25);
}

/* One rule per engine: a selector list with a pseudo-element the browser
 * doesn't know is dropped whole. */
@media (prefers-reduced-motion: reduce) {
  .range-slider::-webkit-slider-thumb {
    transition: none;
  }
  .range-slider::-moz-range-thumb {
    transition: none;
  }
}
</style>
