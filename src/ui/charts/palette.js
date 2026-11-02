/**
 * The one set of chart colours. Charts and simulations name a tone (simulation
 * segments carry `tone: 'danger'`, never a hex value), and read them from this
 * reactive table, which swaps to the dark set while the system prefers a dark
 * scheme. Values are Tailwind colours, noted alongside, and the dark ones follow
 * `ui/theme.js`, so the Tailwind-styled legends next to each canvas stay in step.
 * `text` and `grid` feed Chart.js's defaults (chartSetup.js).
 */
import { reactive, readonly, ref } from 'vue'

export const LIGHT = Object.freeze({
  ink: '#0f172a', // slate-900: the main series
  inkFill: 'rgba(15, 23, 42, 0.08)', // slate-900 at 8%: area under the main series
  muted: '#64748b', // slate-500: a secondary series
  faint: '#cbd5e1', // slate-300: context, such as sibling slices
  ok: '#16a34a', // green-600
  info: '#0ea5e9', // sky-500
  warn: '#d97706', // amber-600
  danger: '#dc2626', // red-600
  text: '#666', // Chart.js's own default
  grid: 'rgba(0, 0, 0, 0.1)', // Chart.js's own default
})

export const DARK = Object.freeze({
  ink: '#f8fafc', // slate-50
  inkFill: 'rgba(248, 250, 252, 0.08)', // slate-50 at 8%
  muted: '#94a3b8', // slate-400
  faint: '#475569', // slate-600
  ok: '#4ade80', // green-400
  info: '#0ea5e9', // sky-500
  warn: '#fbbf24', // amber-400
  danger: '#f87171', // red-400
  text: '#94a3b8', // slate-400
  grid: 'rgba(255, 255, 255, 0.1)',
})

const current = reactive({ ...LIGHT })
export const PALETTE = readonly(current)
const dark = ref(false)
/** True while the system prefers a dark scheme. */
export const prefersDark = readonly(dark)

const darkQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined
function applyScheme() {
  dark.value = Boolean(darkQuery?.matches)
  Object.assign(current, dark.value ? DARK : LIGHT)
}
applyScheme()
darkQuery?.addEventListener?.('change', applyScheme)

/** @param {keyof typeof LIGHT} name */
export function tone(name) {
  const color = PALETTE[name]
  if (!color) throw new Error(`Unknown chart tone "${name}"`)
  return color
}
