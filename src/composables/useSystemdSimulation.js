import { computed } from 'vue'
import { useActiveTuner } from '@/composables/useActiveTuner.js'
import { cpuShares, memoryBudget, tasksUsage, impactSummary } from '@/model/systemd/simulation.js'

/**
 * Reactive wrapper around the pure systemd simulation functions, mirroring
 * useSimulation for the swap tuner.
 *
 * Pass an explicit store when calling this from the *same* component that
 * `provide()`s the tuner store (a component cannot inject its own provided
 * value). Chart components, which are descendants of the providing view, can
 * omit it and fall back to the injected active store.
 *
 * @param {object} [store]
 */
export function useSystemdSimulation(store) {
  const tuner = store ?? useActiveTuner()

  return {
    cpu: computed(() => cpuShares(tuner.hardware, tuner.params)),
    memory: computed(() => memoryBudget(tuner.hardware, tuner.params)),
    tasks: computed(() => tasksUsage(tuner.hardware, tuner.params)),
    impact: computed(() => impactSummary(tuner.hardware, tuner.params)),
  }
}
