import { computed } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'
import { pressureCurve, watermarkBars, dirtyTimeline, impactSummary } from '@/model/simulation.js'

/**
 * Reactive wrapper around the pure simulation functions. Each `computed` here
 * re-runs only when the underlying hardware or params change, so chart
 * components can subscribe to a stable, structurally-shared data shape without
 * recomputing the math on every render.
 */
export function useSimulation() {
  const tuner = useTunerStore()

  return {
    pressure: computed(() => pressureCurve(tuner.hardware, tuner.params)),
    watermarks: computed(() => watermarkBars(tuner.hardware, tuner.params)),
    dirty: computed(() => dirtyTimeline(tuner.hardware, tuner.params)),
    impact: computed(() => impactSummary(tuner.hardware, tuner.params)),
  }
}