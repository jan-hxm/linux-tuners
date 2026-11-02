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
