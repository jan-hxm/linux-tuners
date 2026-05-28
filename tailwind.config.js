/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        zone: {
          safe: '#16a34a',
          warn: '#d97706',
          danger: '#dc2626',
          kswapd: '#0ea5e9',
        },
      },
    },
  },
  plugins: [],
}