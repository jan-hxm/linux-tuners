/**
 * Display helpers shared by more than one tuner. Kept dependency-free.
 */

/**
 * Render a GiB size for display, dropping to MiB below 1 GiB so sub-GiB hosts
 * read naturally ("512 MiB" rather than "0.5 GiB"). Whole numbers stay clean.
 * @param {number} gib
 * @returns {string} e.g. "16 GiB", "1.5 GiB", "512 MiB"
 */
export function formatSizeGiB(gib) {
  if (gib < 1) return `${Math.round(gib * 1024)} MiB`
  const n = Number.isInteger(gib) ? String(gib) : gib.toFixed(2).replace(/\.?0+$/, '')
  return `${n} GiB`
}
