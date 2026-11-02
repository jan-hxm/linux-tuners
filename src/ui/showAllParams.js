/**
 * The "Show all parameters" switch: one on/off convenience for pros, shared by
 * every parameter panel and remembered in this browser (Design.md §5 "Viewer
 * preferences"). It holds no tuner state and never reaches a link or a server.
 * Storage can be missing or throw (private windows, blocked site data), and
 * then the switch simply starts off.
 */

import { ref } from 'vue'

export const SHOW_ALL_STORAGE_KEY = 'linux-tuners:show-all-parameters'

function readStored() {
  try {
    return globalThis.localStorage?.getItem(SHOW_ALL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const showAllParams = ref(readStored())

/** @param {boolean} on */
export function setShowAllParams(on) {
  showAllParams.value = on
  try {
    if (on) globalThis.localStorage?.setItem(SHOW_ALL_STORAGE_KEY, '1')
    else globalThis.localStorage?.removeItem(SHOW_ALL_STORAGE_KEY)
  } catch {
    // Not remembered, but it still applies until the page closes.
  }
}
