<script setup>
// The box every chart renders into. A <canvas> is opaque to assistive tech, so
// the frame requires the text alternative, and it sets the height Chart.js
// sizes itself to (charts use maintainAspectRatio: false). Chart.js copies its
// defaults into a chart when it builds it, so the frame rebuilds its chart when
// the colour scheme changes (Design.md §7). vue-chartjs gives its canvas
// role="img" with no label of its own, so the canvas is hidden from assistive
// tech and the frame alone carries the label.
//
// The frame also runs the probe (probe.js): hover, a tap or the arrow keys
// (the frame is focusable) rest it on one of the chart's stops, and a square
// tooltip says what that point means. Keyboard moves are announced, debounced,
// through a polite live region beside the image (an image's children are
// presentational, so the region can't sit inside it).
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { Chart } from 'chart.js'
import './chartSetup.js'
import { prefersDark } from './palette.js'
import { anchorOf, nearestStop, stepIndex, stopText, stopsOf } from './probe.js'

defineProps({
  ariaLabel: { type: String, required: true },
  height: { type: String, default: '16rem', validator: (v) => /^\d+(\.\d+)?rem$/.test(v) },
})

/** How long the keyboard has to rest on a stop before it is announced. */
const ANNOUNCE_DELAY = 300

const frame = ref(null)
const tip = ref(null) // { title, lines, left, top, ready }
const announcement = ref('')
const hintId = `chart-hint-${useId()}`
let current = null // the active stop's index
let source = null // 'pointer' | 'touch' | 'key'
let announceTimer

function chartOf() {
  const canvas = frame.value?.querySelector('canvas')
  return canvas ? Chart.getChart(canvas) : undefined
}

function show(index, from) {
  const chart = chartOf()
  const stops = stopsOf(chart)
  if (!chart || index < 0 || index >= stops.length || !anchorOf(chart, stops[index])) return hide()
  current = index
  source = from
  chart.$probe = { index, refresh: () => current !== null && place(chart) }
  chart.draw()
  place(chart)
  if (from === 'key') {
    clearTimeout(announceTimer)
    announceTimer = setTimeout(() => (announcement.value = stopText(stops[index])), ANNOUNCE_DELAY)
  }
}

// Put the tooltip beside the stop: right of the crosshair (left past the
// middle), above or below a bar, then nudged to stay inside the frame. Runs
// again after the chart updates (new data, a resize), so the words follow.
function place(chart) {
  const stop = stopsOf(chart)[current]
  const a = stop && anchorOf(chart, stop)
  if (!a) return hide()
  tip.value = { title: stop.title, lines: stop.lines, left: a.x, top: a.y, ready: false }
  nextTick(() => {
    const el = frame.value?.querySelector('[data-chart-tip]')
    if (!el || !tip.value) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const W = chart.width
    const H = chart.height
    let left
    let top
    if (a.box) {
      left = a.x - w / 2
      top = a.box.top - 8 - h >= 0 ? a.box.top - 8 - h : a.box.bottom + 8
    } else {
      left = a.x > W / 2 ? a.x - 14 - w : a.x + 14
      top = Math.min(Math.max(0, a.y > H * 0.45 ? a.y - 14 - h : a.y + 14), Math.max(0, H - h))
    }
    tip.value = { ...tip.value, left: Math.min(Math.max(0, left), Math.max(0, W - w)), top, ready: true }
  })
}

function hide() {
  const chart = chartOf()
  if (chart?.$probe) {
    chart.$probe = null
    chart.draw()
  }
  current = null
  source = null
  tip.value = null
  clearTimeout(announceTimer)
  document.removeEventListener('pointerdown', onOutside, true)
}

function stopAt(e) {
  const chart = chartOf()
  if (!chart?.chartArea) return -1
  const rect = chart.canvas.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  const { left, right, top, bottom } = chart.chartArea
  if (px < left - 12 || px > right + 12 || py < top - 12 || py > bottom + 12) return -1
  return nearestStop(chart, stopsOf(chart), px, py)
}

function onPointerMove(e) {
  if (e.pointerType === 'touch' || source === 'key') return
  const i = stopAt(e)
  if (i === -1) {
    if (source === 'pointer') hide()
  } else if (i !== current) show(i, 'pointer')
}

function onPointerLeave(e) {
  if (e.pointerType !== 'touch' && source === 'pointer') hide()
}

// A tap shows the nearest stop; a tap outside the chart hides it again.
function onPointerDown(e) {
  if (e.pointerType !== 'touch') return
  const i = stopAt(e)
  if (i === -1) return hide()
  show(i, 'touch')
  document.addEventListener('pointerdown', onOutside, true)
}

function onOutside(e) {
  if (!frame.value?.contains(e.target)) hide()
}

function onKeydown(e) {
  const next = stepIndex(e.key, source === 'key' ? current : null, stopsOf(chartOf()).length)
  if (next === undefined) return
  e.preventDefault()
  if (next === null) hide()
  else show(next, 'key')
}

function onBlur() {
  if (source === 'key') hide()
}

onBeforeUnmount(() => {
  clearTimeout(announceTimer)
  document.removeEventListener('pointerdown', onOutside, true)
})
</script>

<template>
  <div class="relative">
    <!-- The key changes with the scheme, so the chart is rebuilt with its colours. -->
    <div
      ref="frame"
      :key="prefersDark ? 'dark' : 'light'"
      role="img"
      :aria-label="ariaLabel"
      :aria-describedby="hintId"
      tabindex="0"
      class="relative"
      :style="{ height }"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
      @keydown="onKeydown"
      @blur="onBlur"
    >
      <div class="h-full" aria-hidden="true">
        <slot />
      </div>
      <div
        v-if="tip"
        aria-hidden="true"
        data-chart-tip
        class="pointer-events-none absolute z-10 w-max max-w-[17rem] border border-ink bg-paper px-3 py-2"
        :style="{ left: `${tip.left}px`, top: `${tip.top}px`, visibility: tip.ready ? 'visible' : 'hidden' }"
      >
        <p class="text-[13px] leading-snug text-ink-2">{{ tip.title }}</p>
        <p
          v-for="(line, i) in tip.lines"
          :key="i"
          class="mt-0.5 leading-snug text-ink"
          :class="i === 0 ? 'font-mono text-[14px]' : 'text-[13px]'"
        >
          {{ line }}
        </p>
      </div>
    </div>
    <p :id="hintId" class="sr-only">Use the left and right arrow keys to read the chart point by point.</p>
    <p class="sr-only" aria-live="polite" data-chart-live>{{ announcement }}</p>
  </div>
</template>
