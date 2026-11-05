// Vitest setup (vite.config.js `setupFiles`), run before every test file.
import { beforeEach } from 'vitest'

// Each tuner store debounces a location.hash write on a real timer, and a
// new store restores its state from the hash. A write still pending from an
// earlier test could land before the next test creates its store and hand it
// that test's values. The write is skipped once the path has changed, so
// every test starts on a path of its own with no hash.
let n = 0
beforeEach(() => {
  if (typeof window === 'undefined') return
  history.replaceState(null, '', `/__test-${++n}`)
})
