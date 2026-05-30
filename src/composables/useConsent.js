/**
 * Cookie / ad-script consent state.
 *
 * Module-level `ref` so every importer shares the same state — clicking
 * Accept in the banner immediately reveals AdSlots elsewhere on the page,
 * and clicking the "Cookie-Einstellungen" revoke link in the footer hides
 * them again without a route change.
 *
 * State shape: `{ choice: 'accepted' | 'rejected', timestamp: ISO8601 }` or
 * `null` (not decided yet). Persisted to localStorage under a versioned key
 * so we can change the consent semantics later without re-asking users who
 * already decided under the new model.
 */

import { ref, computed } from 'vue'

const STORAGE_KEY = 'linux-tuners.consent.v1'

function loadInitial() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && (parsed.choice === 'accepted' || parsed.choice === 'rejected')) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function persist(value) {
  if (typeof window === 'undefined') return
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    }
  } catch {
    // localStorage may throw in private mode or when disabled; ignore.
  }
}

const state = ref(loadInitial())

export function useConsent() {
  return {
    /** The raw state — `null` when no decision has been made yet. */
    state,
    /** True once the user has accepted or rejected at least once. */
    decided: computed(() => state.value !== null),
    /** True only when the user explicitly accepted. */
    accepted: computed(() => state.value?.choice === 'accepted'),
    /** True only when the user explicitly rejected. */
    rejected: computed(() => state.value?.choice === 'rejected'),

    accept() {
      const v = { choice: 'accepted', timestamp: new Date().toISOString() }
      state.value = v
      persist(v)
    },
    reject() {
      const v = { choice: 'rejected', timestamp: new Date().toISOString() }
      state.value = v
      persist(v)
    },
    /** Drop the recorded choice — banner re-appears. Used by the footer link. */
    revoke() {
      state.value = null
      persist(null)
    },
  }
}

/** For tests only — reset the singleton between cases. */
export function _resetConsentForTests() {
  state.value = null
  persist(null)
}
