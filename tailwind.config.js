import colors from 'tailwindcss/colors.js'
import plugin from 'tailwindcss/plugin.js'
import { THEMED_FAMILIES, SHADES, darkColour } from './src/ui/theme.js'

// Dark mode: themed colours are CSS variables holding an RGB triplet, light
// values on :root and the mapped ones from src/ui/theme.js under
// prefers-color-scheme: dark. `.light-palette` brings the light values back for
// surfaces that are dark by design (the hero). See Design.md §7.
const NAMES = ['white', ...THEMED_FAMILIES.flatMap((family) => SHADES.map((shade) => `${family}-${shade}`))]
const hex = (name) => (name === 'white' ? colors.white : colors[name.split('-')[0]][name.split('-')[1]])
// Tailwind writes white as #fff, so expand the short form first.
const triplet = (value) =>
  (value.length === 4 ? [...value.slice(1)].map((c) => c + c).join('') : value.slice(1))
    .match(/../g)
    .map((h) => parseInt(h, 16))
    .join(' ')
const themed = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

function vars(dark) {
  return Object.fromEntries(
    NAMES.map((name) => {
      if (!dark) return [`--c-${name}`, triplet(hex(name))]
      const [family, shade] = name === 'white' ? ['white'] : name.split('-')
      const to = darkColour(family, Number(shade))
      return [`--c-${name}`, triplet(hex(to === 'white' ? 'white' : to.join('-')))]
    }),
  )
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        white: themed('white'),
        ...Object.fromEntries(
          THEMED_FAMILIES.map((family) => [family, Object.fromEntries(SHADES.map((shade) => [shade, themed(`${family}-${shade}`)]))]),
        ),
        zone: {
          safe: '#16a34a',
          warn: '#d97706',
          danger: '#dc2626',
          kswapd: '#0ea5e9',
        },
      },
      // A bare `border` follows the scheme too (preflight's default is gray-200).
      borderColor: { DEFAULT: themed('slate-200') },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...vars(false), 'color-scheme': 'light dark' },
        '@media (prefers-color-scheme: dark)': { ':root': vars(true) },
        '.light-palette': { ...vars(false), 'color-scheme': 'light' },
      })
    }),
  ],
}
