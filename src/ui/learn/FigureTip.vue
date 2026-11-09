<script setup>
/**
 * A part of a figure that says what it does in a tooltip (Design.md §5
 * "Learning pages > Figures"). The trigger is the part itself, a real
 * button; the caller styles it (a card's frame, a legend entry's dotted
 * underline) through ordinary attributes. Its sentence and value are always
 * in the page as the button's description (`aria-describedby` to a hidden
 * span), so a screen reader hears them with the part's name.
 *
 * The tooltip opens after the mouse rests 150 ms, on keyboard focus and on a
 * tap or click (a second click closes it); Escape, a tap outside, the mouse
 * leaving and focus moving away close it. One is open at a time on the page
 * (tipState.js). From `md` up it floats under the part, placed in the
 * viewport so it never makes the page scroll sideways; below `md` it shows
 * as a strip under the figure instead (TipStrip, matched by `scope`). It
 * holds one sentence and an optional value line, never a link or a control.
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import TipWords from './TipWords.vue'
import { HOVER_DELAY_MS, closeTip, openTip } from './tipState.js'
import { plainTip } from './figureText.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  /** The part's name, said first in the tooltip. */
  label: { type: String, required: true },
  /** One sentence of RichText (code and bold only): what the part does. */
  tip: { type: String, default: '' },
  /** The measured value line, with its kernel, or ''. */
  value: { type: String, default: '' },
  /** The figure the strip below `md` belongs to. */
  scope: { type: String, default: '' },
})

const uid = useId()
const descId = `${uid}-tip`
const button = ref(null)
const isOpen = computed(() => openTip.value?.id === uid)
const description = computed(() => [plainTip(props.tip), props.value].filter(Boolean).join(' '))

let timer = null
let openedBy = null
const place = ref({})

function measure() {
  const el = button.value
  if (!el?.getBoundingClientRect) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth || document.documentElement.clientWidth || 1024
  const vh = window.innerHeight || document.documentElement.clientHeight || 768
  const width = Math.max(160, Math.min(320, vw - 16))
  const left = Math.min(Math.max(8, r.left), vw - 8 - width)
  const above = r.bottom + 160 > vh && r.top > 160
  place.value = above
    ? { left: `${left}px`, bottom: `${vh - r.top + 8}px`, width: `${width}px` }
    : { left: `${left}px`, top: `${r.bottom + 8}px`, width: `${width}px` }
}

function open(by) {
  clearTimeout(timer)
  timer = null
  openedBy = by
  measure()
  openTip.value = { id: uid, scope: props.scope, label: props.label, tip: props.tip, value: props.value }
}

function close() {
  clearTimeout(timer)
  timer = null
  closeTip(uid)
}

function onEnter(event) {
  if (event.pointerType === 'touch') return
  clearTimeout(timer)
  timer = setTimeout(() => open('hover'), HOVER_DELAY_MS)
}

function onLeave(event) {
  if (event.pointerType === 'touch') return
  close()
}

function onFocus() {
  if (!isOpen.value) open('focus')
}

function onClick() {
  if (isOpen.value && openedBy === 'click') close()
  else open('click')
}

function onKey(event) {
  if (event.key === 'Escape') close()
}

function onOutside(event) {
  if (button.value && !button.value.contains(event.target)) close()
}

watch(isOpen, (now) => {
  const method = now ? 'addEventListener' : 'removeEventListener'
  document[method]('keydown', onKey)
  document[method]('pointerdown', onOutside, true)
  window[method]('scroll', measure, { passive: true })
  window[method]('resize', measure)
})

onBeforeUnmount(() => {
  close()
  for (const [target, type, fn] of [[document, 'keydown', onKey], [document, 'pointerdown', onOutside], [window, 'scroll', measure], [window, 'resize', measure]]) {
    target.removeEventListener(type, fn, type === 'pointerdown')
  }
})
</script>

<template>
  <button
    ref="button"
    type="button"
    v-bind="$attrs"
    :aria-describedby="description ? descId : undefined"
    :data-tip-open="isOpen || undefined"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @focus="onFocus"
    @blur="close"
    @click="onClick"
  ><slot /></button>
  <span v-if="description" :id="descId" hidden>{{ description }}</span>
  <Teleport to="body">
    <Transition enter-active-class="motion-safe:transition-opacity motion-safe:duration-150" enter-from-class="opacity-0">
      <div
        v-if="isOpen"
        aria-hidden="true"
        class="pointer-events-none fixed z-50 hidden bg-ink px-3.5 py-3 text-[15px] leading-[1.45] text-paper md:block"
        :style="place"
        data-tip
      >
        <span class="font-semibold">{{ label }}.</span>
        <template v-if="tip">{{ ' ' }}<TipWords :text="tip" /></template>
        <span v-if="value" class="mt-1 block font-mono text-[13px]">{{ value }}</span>
      </div>
    </Transition>
  </Teleport>
</template>
