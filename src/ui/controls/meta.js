/**
 * What each control in the registry (./index.js) can do, without its
 * component, so plain JS (the static page text in src/static/) can read it
 * without loading Vue. index.js adds the components.
 *
 * - `types`: the value types the control can edit (checked by the contract suite)
 * - `editable`: the card offers click-to-type on the value
 * - `showsRange`: the card prints the min–max range under the value
 */

export const CONTROL_META = Object.freeze({
  slider: Object.freeze({ types: ['int'], editable: true, showsRange: true }),
  toggle: Object.freeze({ types: ['bool'], editable: false, showsRange: true }),
  segmented: Object.freeze({ types: ['int'], editable: false, showsRange: true }),
  select: Object.freeze({ types: ['enum'], editable: false, showsRange: false }),
  tuple: Object.freeze({ types: ['tuple'], editable: false, showsRange: true }),
})

/** The metadata for a def's control; throws on an unknown or inherited name. */
export function controlMetaFor(def) {
  if (!Object.hasOwn(CONTROL_META, def.control)) throw new Error(`Unknown control "${def.control}" on ${def.key}`)
  return CONTROL_META[def.control]
}
