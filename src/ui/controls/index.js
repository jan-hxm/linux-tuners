/**
 * Controls registry (Design.md §9 "Controls"). `def.control` names an entry;
 * ParameterCard draws the frame and swaps in the entry's component. Every
 * component takes `def`, `value`, `range`, `labelId` and `valueText`, and
 * emits `update` with the new value, which the store then clamps by type.
 *
 * What each entry can do (`types`, `editable`, `showsRange`) lives in
 * ./meta.js, which plain JS (src/static/) reads without the components.
 */

import SliderControl from './SliderControl.vue'
import ToggleControl from './ToggleControl.vue'
import SegmentedControl from './SegmentedControl.vue'
import SelectControl from './SelectControl.vue'
import TupleControl from './TupleControl.vue'
import { CONTROL_META, controlMetaFor } from './meta.js'

const COMPONENTS = {
  slider: SliderControl,
  toggle: ToggleControl,
  segmented: SegmentedControl,
  select: SelectControl,
  tuple: TupleControl,
}

export const CONTROLS = Object.freeze(
  Object.fromEntries(Object.entries(CONTROL_META).map(([name, meta]) => [name, { ...meta, component: COMPONENTS[name] }])),
)

/** The registry entry for a def; throws on an unknown or inherited name. */
export function controlFor(def) {
  controlMetaFor(def)
  return CONTROLS[def.control]
}
