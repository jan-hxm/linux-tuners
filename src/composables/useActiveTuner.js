import { inject } from 'vue'
import { useTunerStore } from '@/stores/tuner.js'
import { swapDomain } from '@/domains/swap/index.js'

/**
 * Injection keys used to thread the *active* tuner store and its domain module
 * down to the shared UI components. A tuner view (SwapTunerView,
 * SystemdTunerView) provides both at its root:
 *
 *   provide(TUNER_STORE_KEY, useSwapStore())
 *   provide(TUNER_DOMAIN_KEY, swapDomain)
 *
 * Components call useActiveTuner() / useTunerDomain() instead of importing a
 * concrete store, so the same ParameterCard / ConfigOutput / … work for both
 * tuners.
 */
export const TUNER_STORE_KEY = Symbol('tuner-store')
export const TUNER_DOMAIN_KEY = Symbol('tuner-domain')

/**
 * The active tuner store. Falls back to the swap store when nothing was provided
 * (i.e. a component mounted in isolation, as in unit tests) so existing
 * swap-oriented tests keep working without a wrapping provider.
 */
export function useActiveTuner() {
  return inject(TUNER_STORE_KEY, () => useTunerStore(), true)
}

/**
 * The active tuner domain. Falls back to the swap domain for the same reason.
 * @returns {import('@/domains/types.js').TunerDomain}
 */
export function useTunerDomain() {
  return inject(TUNER_DOMAIN_KEY, swapDomain)
}
