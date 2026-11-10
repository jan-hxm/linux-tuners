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
    // A test that needs a DOM says so in its own file, never through path
    // globs: see src/testEnvironment.test.js.
    environment: 'node',
    setupFiles: ['src/testSetup.js'],
    include: ['src/**/*.test.js', 'scripts/**/*.test.js', 'vm/lib/**/*.test.js'],
  },
})