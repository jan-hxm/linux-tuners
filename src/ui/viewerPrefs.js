/**
 * Viewer preferences: on/off conveniences shared by every parameter panel and
 * remembered in this browser (Design.md §5 "Viewer preferences"). They hold no
 * tuner state and never reach a link or a server. Storage can be missing or
 * throw (private windows, blocked site data), and then a switch simply starts
 * off and still works until the page closes.
 */

import { ref } from 'vue'

/**
 * One remembered on/off flag: `'1'` under `key` when on, removed when off.
 * @param {string} key
 */
function storedFlag(key) {
  let initial = false
  try {
    initial = globalThis.localStorage?.getItem(key) === '1'
  } catch {
    // Starts off.
  }
  const flag = ref(initial)
  /** @param {boolean} on */
  function set(on) {
    flag.value = on
    try {
      if (on) globalThis.localStorage?.setItem(key, '1')
      else globalThis.localStorage?.removeItem(key)
    } catch {
      // Not remembered, but it still applies until the page closes.
    }
  }
  return { flag, set }
}

export const SHOW_ALL_STORAGE_KEY = 'linux-tuners:show-all-parameters'
export const COMPACT_STORAGE_KEY = 'linux-tuners:compact-parameters'

const showAll = storedFlag(SHOW_ALL_STORAGE_KEY)
const compact = storedFlag(COMPACT_STORAGE_KEY)

/** The "Show all parameters" switch: every card on every panel. */
export const showAllParams = showAll.flag
export const setShowAllParams = showAll.set

/** The "Compact" switch: cards drop their descriptions (pro-tool panels only). */
export const compactParams = compact.flag
export const setCompactParams = compact.set
