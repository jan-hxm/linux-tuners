import { inject } from 'vue'

/**
 * Injection keys used to thread the *active* tuner store and its domain module
 * down to the shared UI components. TunerPage provides both from its `store`
 * and `domain` props.
 *
 * Components call useActiveTuner() / useTunerDomain() instead of importing a
 * concrete store, so the same ParameterCard / ConfigOutput / … work for every
 * tuner.
 */
export const TUNER_STORE_KEY = Symbol('tuner-store')
export const TUNER_DOMAIN_KEY = Symbol('tuner-domain')

/**
 * The active tuner store. There is no fallback: shared UI never picks a tuner,
 * so a component mounted outside TunerPage (e.g. in a unit test) must be given
 * both keys through `provide`.
 */
export function useActiveTuner() {
  return required(TUNER_STORE_KEY, 'store')
}

/**
 * The active tuner domain.
 * @returns {import('@/core/types.js').TunerDomain}
 */
export function useTunerDomain() {
  return required(TUNER_DOMAIN_KEY, 'domain')
}

function required(key, what) {
  const value = inject(key, null)
  if (!value) throw new Error(`No tuner ${what} provided; render inside TunerPage or provide it`)
  return value
}
