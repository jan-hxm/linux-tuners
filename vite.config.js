import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environmentMatchGlobs: [
      ['src/ui/**', 'happy-dom'],
      ['src/tuners/*/components/**', 'happy-dom'],
    ],
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})