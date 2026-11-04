/**
 * The one set of chart colours. Charts and simulations name a tone (simulation
 * segments carry `tone: 'danger'`, never a hex value), and read them from this
 * reactive table, which swaps to the dark set while the system prefers a dark
 * scheme. `text` and `grid` feed Chart.js's defaults (chartSetup.js).
 *
 * The design tones come from the semantic tokens in `ui/theme.js` (REDESIGN.md
 * §3): `ink` for the main series, `quiet` and `rule` for context, `fit` for the
 * profile's default, `mine` for the visitor's value, `error` for danger.
 *
 * The legacy tones (`muted`, `faint`, `ok`, `info`, `warn`, `danger`) keep their
 * Tailwind colours, mapped like the classes by `ui/theme.js`, so the
 * Tailwind-styled legends next to charts that aren't restyled yet stay in step.
 * They go once no chart names them (WS8).
 */
import { reactive, readonly, ref } from 'vue'
import { TOKENS } from '../theme.js'

/** `#rrggbb` at an alpha, as `rgba()`. */
function alpha(hex, a) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** @param {0 | 1} scheme 0 light, 1 dark */
function designTones(scheme) {
  const t = (name) => TOKENS[name][scheme]
  return {
    ink: t('ink'), // the main series
    inkFill: alpha(t('ink'), 0.08), // area under the main series
    quiet: t('quiet'), // a secondary series
    rule: t('rule'), // context, such as sibling slices
    fit: t('fit'), // the profile's default
    mine: t('mine'), // the visitor's value
    error: t('error'), // danger
    text: t('quiet'), // tick and axis labels
    grid: t('rule'), // grid lines
  }
}

export const LIGHT = Object.freeze({
  ...designTones(0),
  muted: '#64748b', // slate-500
  faint: '#cbd5e1', // slate-300
  ok: '#16a34a', // green-600
  info: '#0ea5e9', // sky-500
  warn: '#d97706', // amber-600
  danger: '#dc2626', // red-600
})

export const DARK = Object.freeze({
  ...designTones(1),
  muted: '#94a3b8', // slate-400
  faint: '#475569', // slate-600
  ok: '#4ade80', // green-400
  info: '#0ea5e9', // sky-500
  warn: '#fbbf24', // amber-400
  danger: '#f87171', // red-400
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
