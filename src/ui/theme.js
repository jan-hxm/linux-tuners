/**
 * Dark mode as a shade mapping (Design.md §7). Tailwind's `white` and the
 * colour families below resolve to CSS variables (tailwind.config.js), and
 * under `prefers-color-scheme: dark` each variable takes the colour named here,
 * so components keep their light-mode classes and need no `dark:` variants.
 * The chart palette (`ui/charts/palette.js`) follows the same mapping, so the
 * Tailwind legends next to each canvas stay in step.
 */

/** Families whose classes follow the scheme. Others keep their literal colour. */
export const THEMED_FAMILIES = ['slate', 'amber', 'red', 'emerald', 'green', 'sky', 'violet']
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// Slate carries the surfaces and the text, so it isn't a plain mirror: white
// cards turn slate-900 on a slate-950 page, and text-slate-500 turns
// slate-400, which keeps the §7 contrast floor on the dark surfaces.
const SLATE_DARK = { 50: 950, 100: 800, 200: 700, 300: 600, 400: 500, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 'white' }

/**
 * The colour a light-mode colour turns into in dark mode, as `'white'` or
 * `[family, shade]`. Tints mirror (50 to 950, 100 to 900, ..., 500 stays).
 * @param {'white' | string} family
 * @param {number} [shade]
 * @returns {'white' | [string, number]}
 */
export function darkColour(family, shade) {
  if (family === 'white') return ['slate', 900]
  if (family === 'slate') {
    const dark = SLATE_DARK[shade]
    return dark === 'white' ? 'white' : ['slate', dark]
  }
  return [family, shade === 50 ? 950 : shade === 950 ? 50 : 1000 - shade]
}

/**
 * The semantic colour tokens of the "Scale" design (REDESIGN.md §3), as
 * `[light, dark]` hex pairs. tailwind.config.js writes them to CSS variables
 * (`--t-<name>`, light on :root, dark under prefers-color-scheme: dark) and
 * exposes them as Tailwind colours (`bg-paper`, `text-ink-2`, `border-rule`),
 * and the chart palette reads them too. theme.test.js measures every text and
 * mark pair in both schemes.
 *
 * Measured adjustments to the spec: dark `quiet` is #90908A (the spec's
 * #8E8E88 is 4.44:1 on `fit-tint`, under the 4.5:1 text floor).
 */
export const TOKENS = Object.freeze({
  paper: ['#FAFAF8', '#151514'], // page background
  'paper-hover': ['#F2F2EF', '#1C1C1A'], // row hover, secondary button hover
  ink: ['#161616', '#ECECE8'], // text, strong rules, primary fill, kernel-default tick, focus ring
  'ink-2': ['#4A4A46', '#B8B8B2'], // second text (descriptions)
  quiet: ['#6B6B66', '#90908A'], // labels, captions, [n] marks
  rule: ['#DEDED9', '#2E2E2B'], // hairlines between rows
  'rule-strong': ['#8C8C86', '#4E4E4A'], // secondary button borders, minor ticks
  fit: ['#1F7A6B', '#4FB8A3'], // "fits your machine" mark, selected radio dot
  'fit-text': ['#1A6658', '#5CC9B4'], // "fits your machine" text
  'fit-tint': ['#EEF4F2', '#1A2C28'], // selected row background
  mine: ['#B57D24', '#D69A35'], // "changed by you" mark
  'mine-text': ['#8A5A0E', '#E9B259'], // "changed by you" text, warnings
  'mine-tint': ['#FBF1E0', '#33270F'], // behind a changed value
  error: ['#B3301E', '#FF7A66'], // blocking issues only
})

/** Surfaces text and marks sit on. */
export const SURFACE_TOKENS = ['paper', 'paper-hover', 'fit-tint', 'mine-tint']
/** Tokens used for text: 4.5:1 on every surface, in both schemes. */
export const TEXT_TOKENS = ['ink', 'ink-2', 'quiet', 'fit-text', 'mine-text', 'error']
/** Tokens used for marks (ticks, bars, dots, the focus ring): 3:1 on every surface. */
export const MARK_TOKENS = ['ink', 'fit', 'mine', 'error']

/**
 * Font stacks. The webfonts are self-hosted (src/assets/fonts, @font-face in
 * main.css); each is followed by a metric-matched local fallback face, so the
 * swap after the font arrives barely moves the text, then the system stacks.
 */
export const FONT_SANS = ['"Host Grotesk"', '"Host Grotesk Fallback"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif']
export const FONT_MONO = ['"Fragment Mono"', '"Fragment Mono Fallback"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
