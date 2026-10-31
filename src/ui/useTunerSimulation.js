import { computed } from 'vue'

/**
 * Turns a tuner's simulation module, pure functions of (hardware, params), into
 * one computed per function, keyed by the function's name. Each re-runs only
 * when the store's hardware or params change.
 *
 * TunerPage passes the store it provides (a component can't inject what it
 * provides itself); chart components pass `useActiveTuner()`.
 *
 * @param {{ hardware: object, params: object }} store
 * @param {Record<string, unknown>} simulation  e.g. `import * as simulation from './simulation.js'`
 * @returns {Record<string, import('vue').ComputedRef<any>>}
 */
export function useTunerSimulation(store, simulation) {
  const out = {}
  for (const [name, fn] of Object.entries(simulation)) {
    if (typeof fn === 'function') out[name] = computed(() => fn(store.hardware, store.params))
  }
  return out
}
