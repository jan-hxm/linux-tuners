const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps Tab inside a dialog (Design.md §7: `aria-modal` alone doesn't stop
 * focus escaping to the page behind the overlay). Call from the dialog's
 * keydown handler.
 *
 * @param {KeyboardEvent} e
 * @param {HTMLElement | null} root
 */
export function trapTab(e, root) {
  if (e.key !== 'Tab' || !root) return
  const focusables = root.querySelectorAll(FOCUSABLE)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
