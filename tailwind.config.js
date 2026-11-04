import plugin from 'tailwindcss/plugin.js'
import { TOKENS, FONT_SANS, FONT_MONO } from './src/ui/theme.js'

// The colour tokens (src/ui/theme.js, Design.md §7) are the whole palette:
// CSS variables holding an RGB triplet, light values on :root and dark ones
// under prefers-color-scheme: dark, so components need no `dark:` variants.
// Tailwind's own colour families are not offered at all (theme.test.js).
const triplet = (hex) => hex.slice(1).match(/../g).map((h) => parseInt(h, 16)).join(' ')
const token = (name) => `rgb(var(--t-${name}) / <alpha-value>)`
const vars = (scheme) => Object.fromEntries(Object.entries(TOKENS).map(([name, pair]) => [`--t-${name}`, triplet(pair[scheme])]))

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      // The drawer's scrim dims the page in either scheme.
      black: '#000',
      ...Object.fromEntries(Object.keys(TOKENS).map((name) => [name, token(name)])),
    },
    extend: {
      fontFamily: {
        sans: FONT_SANS,
        mono: FONT_MONO,
      },
      // A bare `border` is a hairline (preflight's default is gray-200).
      borderColor: { DEFAULT: token('rule') },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...vars(0), 'color-scheme': 'light dark' },
        '@media (prefers-color-scheme: dark)': { ':root': vars(1) },
      })
    }),
  ],
}
