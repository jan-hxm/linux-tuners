/**
 * Display helpers shared by more than one tuner. Kept dependency-free.
 */

/** A byte count for display: "6 MiB", "1.5 GiB", "512 KiB", "300 B". */
export function formatBytes(bytes) {
  const trim = (n) => String(Math.round(n * 10) / 10)
  if (bytes >= 1024 ** 3) return `${trim(bytes / 1024 ** 3)} GiB`
  if (bytes >= 1024 ** 2) return `${trim(bytes / 1024 ** 2)} MiB`
  if (bytes >= 1024) return `${trim(bytes / 1024)} KiB`
  return `${bytes} B`
}

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
