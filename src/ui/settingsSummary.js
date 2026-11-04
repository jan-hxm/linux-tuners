/**
 * The one-line count of where a set of settings stands, as the group rows and
 * the export say it: "5 settings. All fit your machine." or "9 settings. 7 fit
 * your machine, 2 changed by you." (REDESIGN §4 decision 10). Built from the
 * keys shown and the store's `changedKeys`, never hand-typed.
 *
 * @param {string[]} keys      The settings being counted
 * @param {Iterable<string>} changed  Keys whose value differs from the profile's default
 * @returns {string}
 */
export function settingsSummary(keys, changed) {
  const changedSet = new Set(changed)
  const total = keys.length
  const mine = keys.filter((k) => changedSet.has(k)).length
  const fit = total - mine
  const count = `${total} setting${total === 1 ? '' : 's'}.`
  if (!total) return count
  const all = total === 1 ? '' : total === 2 ? 'Both ' : 'All '
  if (!mine) return `${count} ${all ? `${all}fit` : 'Fits'} your machine.`
  if (!fit) return `${count} ${all ? `${all}changed` : 'Changed'} by you.`
  return `${count} ${fit} fit${fit === 1 ? 's' : ''} your machine, ${mine} changed by you.`
}
