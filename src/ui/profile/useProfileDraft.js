import { reactive, ref, computed, watch } from 'vue'
import { normalizeField } from '@/core/profile.js'

/**
 * The profile form's draft: the values the user is editing, their errors,
 * whether they differ from the applied profile, and the form's collapsed
 * state. The page that renders the form creates it and `provide()`s it under
 * PROFILE_DRAFT_KEY, so ProfileForm and ProfileDraftNotice (the repeat of
 * "Unsaved changes" above the parameters) share one draft. A component can't
 * inject what it provides, so the page passes its store in explicitly.
 *
 * @param {Object} tuner  The store the form edits: `hardware` and `setHardware`
 * @param {Object} profile  The domain's profile (`fields`, `summary`, ...)
 * @param {Object} [options]
 * @param {boolean} [options.collapsed]  Start on the summary line, because the
 *   profile is already set (a shared link, a setup step). Apply then keeps the
 *   form open, as after "Edit".
 */
export function useProfileDraft(tuner, profile, { collapsed: startCollapsed = false } = {}) {
  const fields = profile.fields

  function toDraft(hw) {
    return Object.fromEntries(fields.map((f) => [f.key, f.type === 'text' ? (hw[f.key] ?? '') : hw[f.key]]))
  }

  // Local draft: lets the user edit several fields and apply atomically.
  const draft = reactive(toDraft(tuner.hardware))
  const errors = reactive({})
  const collapsed = ref(startCollapsed)
  // Auto-collapse to the one-line summary only on the very first apply (the
  // initial guided flow). After the user has explicitly re-opened with "Edit",
  // keep the form open on apply so they can keep tweaking without re-expanding.
  const hasApplied = ref(startCollapsed)

  /** The draft value as the store would hold it, before snapping. */
  function draftValue(field) {
    if (field.type === 'number') return Number(draft[field.key])
    if (field.type === 'text') return String(draft[field.key] ?? '').trim() || null
    return draft[field.key]
  }

  const differsFrom = (hw) => fields.some((f) => draftValue(f) !== hw[f.key])
  const dirty = computed(() => differsFrom(tuner.hardware))

  /**
   * Validate and apply the draft.
   * @returns {string|null}  null when applied, else the first invalid field's key
   */
  function apply() {
    const hw = {}
    for (const field of fields) {
      const value = normalizeField(field, draft[field.key])
      errors[field.key] = value === undefined ? (field.invalidMessage ?? 'Invalid value.') : null
      hw[field.key] = value
    }
    const invalid = fields.find((f) => errors[f.key])
    if (invalid) return invalid.key
    // Write the normalised values back into the draft so the form shows what was
    // actually applied (otherwise an out-of-range entry would keep showing
    // "Unsaved changes" against the clamped store value).
    Object.assign(draft, toDraft(hw))
    tuner.setHardware(hw)
    if (!hasApplied.value) collapsed.value = true
    hasApplied.value = true
    return null
  }

  // If something else replaces store.hardware, mirror it into the draft unless
  // the user has unsaved edits against the previous profile.
  watch(
    () => tuner.hardware,
    (hw, previous) => {
      if (!differsFrom(previous)) Object.assign(draft, toDraft(hw))
    },
    { deep: true },
  )

  return { draft, errors, collapsed, dirty, apply }
}
