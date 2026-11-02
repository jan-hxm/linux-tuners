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
