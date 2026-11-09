/**
 * The one open figure tooltip on the page (Design.md §5 "Learning pages >
 * Figures"). FigureTip opens and closes it; TipStrip shows it under its
 * figure below `md`. A module-level ref, so opening one tooltip closes any
 * other on the page.
 */
import { shallowRef } from 'vue'

/** How long a mouse rests on a part before its tooltip opens. */
export const HOVER_DELAY_MS = 150

/** @type {import('vue').ShallowRef<{ id: string, scope: string, label: string, tip: string, value: string } | null>} */
export const openTip = shallowRef(null)

/** Closes the open tooltip, or only the one with this id. */
export function closeTip(id = null) {
  if (!id || openTip.value?.id === id) openTip.value = null
}
