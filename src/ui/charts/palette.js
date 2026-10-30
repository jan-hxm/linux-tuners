/**
 * The one set of chart colours. Charts and simulations name a tone (simulation
 * segments carry `tone: 'danger'`, never a hex value), so a later dark mode only
 * has to swap this table. Values are Tailwind colours, noted alongside, so the
 * Tailwind-styled legends next to each canvas stay in step.
 */
export const PALETTE = Object.freeze({
  ink: '#0f172a', // slate-900: the main series
  inkFill: 'rgba(15, 23, 42, 0.08)', // slate-900 at 8%: area under the main series
  muted: '#64748b', // slate-500: a secondary series
  faint: '#cbd5e1', // slate-300: context, such as sibling slices
  ok: '#16a34a', // green-600
  info: '#0ea5e9', // sky-500
  warn: '#d97706', // amber-600
  danger: '#dc2626', // red-600
})

/** @param {keyof typeof PALETTE} name */
export function tone(name) {
  const color = PALETTE[name]
  if (!color) throw new Error(`Unknown chart tone "${name}"`)
  return color
}
