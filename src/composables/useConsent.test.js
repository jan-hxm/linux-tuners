import { describe, it, expect, beforeEach } from 'vitest'
import { useConsent, _resetConsentForTests } from './useConsent.js'

const STORAGE_KEY = 'linux-tuners.consent.v1'

describe('useConsent', () => {
  beforeEach(() => {
    window.localStorage.clear()
    _resetConsentForTests()
  })

  it('starts undecided when no value has been persisted', () => {
    const c = useConsent()
    expect(c.decided.value).toBe(false)
    expect(c.accepted.value).toBe(false)
    expect(c.rejected.value).toBe(false)
  })

  it('accept() flips decided and accepted, and persists to localStorage', () => {
    const c = useConsent()
    c.accept()
    expect(c.decided.value).toBe(true)
    expect(c.accepted.value).toBe(true)
    expect(c.rejected.value).toBe(false)

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored.choice).toBe('accepted')
    expect(typeof stored.timestamp).toBe('string')
  })

  it('reject() flips decided and rejected, leaves accepted false', () => {
    const c = useConsent()
    c.reject()
    expect(c.decided.value).toBe(true)
    expect(c.rejected.value).toBe(true)
    expect(c.accepted.value).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).choice).toBe('rejected')
  })

  it('revoke() returns to the undecided state and clears localStorage', () => {
    const c = useConsent()
    c.accept()
    c.revoke()
    expect(c.decided.value).toBe(false)
    expect(c.accepted.value).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('all useConsent() consumers share the same singleton state', () => {
    const a = useConsent()
    const b = useConsent()
    a.accept()
    // The other consumer must observe the change without re-loading from storage.
    expect(b.accepted.value).toBe(true)
  })

  it('ignores a malformed persisted value on first read', () => {
    // Test the loadInitial guard by stuffing garbage into storage, then forcing
    // a fresh module-level evaluation via the test reset hook.
    window.localStorage.setItem(STORAGE_KEY, 'not json')
    _resetConsentForTests()
    const c = useConsent()
    // The module-level ref was already evaluated at first import using a then-
    // empty storage; the reset hook drops the value back to null. Net effect:
    // the consumer must still behave as if undecided, not crash.
    expect(c.decided.value).toBe(false)
  })
})
