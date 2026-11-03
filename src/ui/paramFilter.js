/**
 * The parameter panel's pro tools (Design.md §7 "Filter, changed only and
 * compact"): a text filter, a "Changed only" switch and a compact density.
 * They appear only where a tuner has enough parameters to need them, decided
 * from the domain's defs so no tuner is named here.
 */

/** A tuner with at least this many parameters gets the filter, "Changed only" and compact. */
export const PRO_TOOLS_MIN_PARAMS = 15

/** @param {{ defsByKey: Record<string, unknown> }} domain */
export function hasProTools(domain) {
  return Object.keys(domain.defsByKey).length >= PRO_TOOLS_MIN_PARAMS
}

/**
 * Lower case, with the separators of sysctl and directive names (`.`, `_`,
 * `-`, `/`) and runs of white space turned into one space, so
 * "tcp_rmem", "tcp rmem" and "net.ipv4.tcp_rmem" find the same card.
 * @param {string} text
 */
function normalise(text) {
  return text.toLowerCase().replace(/[\s._/-]+/g, ' ').trim()
}

/**
 * The query's terms; empty when there is nothing to filter by.
 * @param {string} query
 * @returns {string[]}
 */
export function queryTerms(query) {
  const n = normalise(query ?? '')
  return n ? n.split(' ') : []
}

/** Every text of a def a filter looks at: its names and its descriptions. */
function haystack(def) {
  const parts = [def.title, def.sysctlName, def.key, def.shortDesc, def.tuningTip, ...(def.alsoSets ?? [])]
  for (const paras of Object.values(def.longDesc ?? {})) {
    if (Array.isArray(paras)) parts.push(...paras)
  }
  return ` ${normalise(parts.filter((p) => typeof p === 'string').join(' '))} `
}

/** @type {WeakMap<object, string>} */
const haystacks = new WeakMap()

/**
 * Whether a def matches every term of a query (from `queryTerms`), each one
 * anywhere in its title, name or description text. No terms match everything.
 * @param {object} def
 * @param {string[]} terms
 */
export function defMatches(def, terms) {
  if (!terms.length) return true
  let text = haystacks.get(def)
  if (text === undefined) {
    text = haystack(def)
    haystacks.set(def, text)
  }
  return terms.every((t) => text.includes(t))
}
