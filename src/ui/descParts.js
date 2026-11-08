/**
 * The labelled parts of a def's `longDesc`, in the order the card's "Learn
 * more" shows them (Design.md §7 "Three layers per parameter"). `what` is
 * required; the others are left out when a parameter has nothing to say there.
 */
export const DESC_PARTS = Object.freeze([
  { key: 'what', label: 'What it does' },
  { key: 'when', label: 'When to change it' },
  { key: 'watch', label: 'Watch out' },
])

/**
 * Provide key for the guide lookup `(paramKey) => chapter id | null` (the
 * chapter of the tuner's guide that pins that key). A tuner page provides it
 * once; a card's `howItWorks` prop overrides it. Used only while the tuner's
 * registry `guide.status` is 'live' (Design.md §7).
 */
export const HOW_IT_WORKS_KEY = Symbol('how-it-works')
