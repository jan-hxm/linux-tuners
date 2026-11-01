// Config for the VM tests (npm run test:vm, vm/README.md): each vm/*.vm.test.js
// boots one distro image, so files run in parallel and tests get long timeouts.
import { defineConfig } from 'vitest/config'
import base from './vite.config.js'

export default defineConfig({
  ...base,
  test: {
    environment: 'node',
    include: ['vm/**/*.vm.test.js'],
    testTimeout: 600_000,
    hookTimeout: 900_000,
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: Number(process.env.VM_PARALLEL ?? 5) } },
  },
})
