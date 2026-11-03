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
 * Optional: `(field) => string | null`, a note under a profile field saying
 * where its value came from. The guided setup provides it; a tuner page
 * doesn't, and ProfileForm then shows none.
 */
export const PROFILE_FIELD_NOTE_KEY = Symbol('profile-field-note')
/**
 * Optional: the profile form's draft (ui/profile/useProfileDraft.js), which
 * the page provides so ProfileDraftNotice can repeat "Unsaved changes" above
 * the parameters. Without it, ProfileForm keeps its own draft.
 */
export const PROFILE_DRAFT_KEY = Symbol('profile-draft')

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
