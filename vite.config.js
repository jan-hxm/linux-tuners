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
      ['src/components/**', 'happy-dom'],
    ],
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})