/**
 * In-page links that leave the URL alone. A tuner's state lives in
 * location.hash (Design.md §5 "Shareable URL state"), so a plain `#about`
 * link would replace it and a copied link would lose every setting. These
 * links keep their href (so they still read as links and work without JS)
 * but scroll and focus the target themselves.
 */

/** Scrolls an anchor under the sticky bars (its scroll-mt) and focuses it. */
export function focusAnchor(id) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  // A section isn't focusable by itself; -1 lets focus land without adding a Tab stop.
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

/**
 * Click handler for `<a href="#id">`: follows it without touching the hash.
 * Modified clicks (new tab, new window) keep the browser's own behaviour.
 */
export function followInPageLink(event, id) {
  if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  focusAnchor(id)
}
