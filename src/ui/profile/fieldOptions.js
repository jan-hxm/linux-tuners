/**
 * Shared pick lists, ceilings and field fragments for the tuners' profile
 * field lists (src/tuners/<id>/profile.js), so the tuners present the *same*
 * quick-pick chips and limits for the fields they have in common (RAM above
 * all). Rendered by ProfileForm.vue through NumberPickField.vue.
 *
 * Pick lists are arrays of either a bare number (label = the number) or a
 * `{ value, label }` object when the chip needs custom text.
 */

/** Total-RAM quick picks (GiB) — shared by both tuners so they never drift. */
export const RAM_PICKS = [
  { value: 0.5, label: '512 MiB' },
  1, 2, 4, 8, 16, 32, 64, 128, 192, 256, 512,
]

/** Swap-size quick picks (GiB) — swap tuner only; 0 means "no swap". */
export const SWAP_PICKS = [
  { value: 0, label: 'No swap' },
  { value: 0.5, label: '512 MiB' },
  1, 2, 4, 8, 16, 32, 64, 128, 192, 256, 384, 512,
]

/** Logical-CPU quick picks — systemd tuner. */
export const CORE_PICKS = [1, 2, 4, 8, 16, 32, 64, 128]

/** kernel.pid_max quick picks — systemd tuner. */
export const PID_PICKS = [
  { value: 32768, label: '32768 (legacy)' },
  { value: 131072, label: '131072' },
  { value: 1048576, label: '1048576' },
  { value: 4194304, label: '4194304 (systemd 64-bit)' },
]

// Sanity ceilings: 2304 TiB of RAM/swap covers even very high-end server racks
// while keeping derived values and the card layout bounded — without a cap,
// pasting something like 1e65 produces astronomically long parameter values.
export const RAM_MAX_GIB = 2304 * 1024
export const SWAP_MAX_GIB = 2304 * 1024
export const CORE_MAX = 4096
export const PID_MAX_CEIL = 4194304

// Floors for the sizes, low enough to model sub-GiB hosts (a 1 GiB box might
// only have 512 MiB free for the workload). RAM can't be 0; swap can (= none).
export const RAM_MIN_GIB = 0.25 // 256 MiB
export const SWAP_MIN_GIB = 0

// Sizes snap to MiB, so sub-GiB hosts are expressible without accumulating
// binary-float noise (0.1 + 0.2 etc.); whole-GiB values stay exact.
export const SIZE_SNAP_GIB = 1 / 1024

// Spinner step for the size fields. 0.25 GiB (256 MiB) lets the spinner reach
// the common sub-GiB sizes; any typed value still works, since apply snaps it
// to SIZE_SNAP_GIB.
export const SIZE_STEP_GIB = 0.25

/** The Total RAM field; a tuner spreads it and adds its `default`. */
export const RAM_FIELD = Object.freeze({
  key: 'ramGiB',
  type: 'number',
  label: 'Total RAM (GiB)',
  min: RAM_MIN_GIB,
  max: RAM_MAX_GIB,
  step: SIZE_SNAP_GIB,
  inputStep: SIZE_STEP_GIB,
  picks: RAM_PICKS,
  help: ['Fractional values are allowed for small hosts, e.g. 0.5 = 512 MiB.'],
})

/** cgroup v1/v2 options; each tuner supplies the note shown for the selection. */
export function cgroupField({ v1, v2 }) {
  return {
    key: 'cgroupVersion',
    type: 'choice',
    control: 'segmented',
    label: 'cgroup version',
    options: [
      { value: 'v1', label: 'v1', note: v1 },
      { value: 'v2', label: 'v2', note: v2 },
    ],
    default: 'v2',
    half: true,
  }
}
