/**
 * The colour tokens (Design.md §7), as `[light, dark]` hex pairs: the only
 * colours the page has. tailwind.config.js writes them to CSS variables
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

/** WCAG relative luminance contrast of two hex colours. */
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => {
      const c = parseInt(h, 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
