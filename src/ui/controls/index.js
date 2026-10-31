/**
 * Controls registry (Design.md §9 "Controls"). `def.control` names an entry;
 * ParameterCard draws the frame and swaps in the entry's component. Every
 * component takes `def`, `value`, `range`, `labelId` and `valueText`, and
 * emits `update` with the new value, which the store then clamps by type.
 *
 * - `types`: the value types the control can edit (checked by the contract suite)
 * - `editable`: the card offers click-to-type on the value
 * - `showsRange`: the card prints the min–max range under the value
 */

import SliderControl from './SliderControl.vue'
import ToggleControl from './ToggleControl.vue'
import SegmentedControl from './SegmentedControl.vue'
import SelectControl from './SelectControl.vue'
import TupleControl from './TupleControl.vue'

export const CONTROLS = Object.freeze({
  slider: { component: SliderControl, types: ['int'], editable: true, showsRange: true },
  toggle: { component: ToggleControl, types: ['bool'], editable: false, showsRange: true },
  segmented: { component: SegmentedControl, types: ['int'], editable: false, showsRange: true },
  select: { component: SelectControl, types: ['enum'], editable: false, showsRange: false },
  tuple: { component: TupleControl, types: ['tuple'], editable: false, showsRange: true },
})

/** The registry entry for a def; throws on an unknown or inherited name. */
export function controlFor(def) {
  if (!Object.hasOwn(CONTROLS, def.control)) throw new Error(`Unknown control "${def.control}" on ${def.key}`)
  return CONTROLS[def.control]
}
