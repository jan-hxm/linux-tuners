/**
 * The one set of chart colours. Charts and simulations name a tone (simulation
 * segments carry `tone: 'error'`, never a hex value), and read them from this
 * reactive table, which swaps to the dark set while the system prefers a dark
 * scheme. `text` and `grid` feed Chart.js's defaults (chartSetup.js).
 *
 * The tones are the colour tokens in `ui/theme.js` (Design.md §7), so a legend
 * styled with the same token classes matches its chart: `ink` for the main
 * series, `quiet` and `rule` for context, `fit` for what comes from the
 * visitor's machine, `mine` for the visitor's own value, `error` for danger.
 * The `*Text` tones are the matching text tokens, for words drawn on the
 * canvas (a series' end label), and `paper` fills the probe's dots. Soft
 * fills (area under a line, a shaded band) come from `tint()`, never a hex.
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
    quiet: t('quiet'), // a secondary series
    rule: t('rule'), // context, such as sibling slices
    fit: t('fit'), // the profile's default
    mine: t('mine'), // the visitor's value
    error: t('error'), // danger
    text: t('quiet'), // tick and axis labels
    grid: t('rule'), // grid lines
    paper: t('paper'), // the page, behind the probe's dots
    inkText: t('ink'), // canvas words in each tone (end labels)
    ink2Text: t('ink-2'),
    fitText: t('fit-text'),
    mineText: t('mine-text'),
    errorText: t('error'),
  }
}

export const LIGHT = Object.freeze(designTones(0))
export const DARK = Object.freeze(designTones(1))

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

/**
 * A tone at an alpha, for soft fills: the area under a series (0.1) or a
 * shaded band. Reads the current scheme, so call it while building a chart.
 * @param {keyof typeof LIGHT} name
 * @param {number} a 0..1
 */
export function tint(name, a) {
  return alpha(tone(name), a)
}

/** The text tone that goes with a mark tone, for words drawn in that tone. */
export function textTone(name) {
  return tone({ fit: 'fitText', mine: 'mineText', error: 'errorText', ink: 'inkText' }[name] ?? 'ink2Text')
}
