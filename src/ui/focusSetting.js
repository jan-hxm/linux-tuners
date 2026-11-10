/**
 * Links that open a tuner page with one setting in view (the study guides'
 * "Tune it" links, Design.md §5 "Learning pages > Routes and pages").
 *
 * The tuner's location.hash holds the shared-link state (§5 "Shareable URL
 * state"), so the setting can't be a `#setting-<key>` fragment: a link with
 * one would be read as a broken shared link. It is a `focus` query instead,
 * which TunerPage reads once on load, checks against the domain's def keys
 * (anything else is ignored, never rendered), and then removes from the URL.
 * It never touches the tuner's state.
 */

export const FOCUS_QUERY = 'focus'

/** The link to a tuner page with `key` in view, e.g. `/swap?focus=swappiness`. */
export function settingHref(tunerPath, key) {
  return `${tunerPath}?${FOCUS_QUERY}=${encodeURIComponent(key)}`
}

/**
 * The def key a URL's query asks to show, or null: one value, and only an
 * own key of `defsByKey`.
 * @param {string} search  location.search
 * @param {Record<string, unknown>} defsByKey
 */
export function focusKeyFrom(search, defsByKey) {
  let values
  try {
    values = new URLSearchParams(search).getAll(FOCUS_QUERY)
  } catch {
    return null
  }
  if (values.length !== 1) return null
  const [key] = values
  return typeof key === 'string' && Object.hasOwn(defsByKey, key) ? key : null
}

/**
 * The same URL without the focus query, its hash (the tuner state) and other
 * query parameters kept as they were.
 * @param {{ pathname: string, search: string, hash: string }} location
 */
export function withoutFocus({ pathname, search, hash }) {
  const params = new URLSearchParams(search)
  params.delete(FOCUS_QUERY)
  const rest = params.toString()
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`
}
