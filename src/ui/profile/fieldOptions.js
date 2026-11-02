/**
 * Shared pick lists, ceilings and field fragments for the tuners' profile
 * field lists (src/tuners/<id>/profile.js), so the tuners present the *same*
 * quick-pick chips and limits for the fields they have in common (RAM above
 * all). Rendered by ProfileForm.vue through NumberPickField.vue.
 *
 * Pick lists are arrays of either a bare number (label = the number) or a
 * `{ value, label }` object when the chip needs custom text.
 */

// RAM is a machine field of the guided setup, so its definition lives in core.
export { RAM_FIELD, RAM_PICKS, SIZE_SNAP_GIB, SIZE_STEP_GIB } from '@/core/machine.js'

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

// Sanity ceilings: 2304 TiB of swap covers even very high-end server racks
// while keeping derived values and the card layout bounded — without a cap,
// pasting something like 1e65 produces astronomically long parameter values.
export const SWAP_MAX_GIB = 2304 * 1024
export const CORE_MAX = 4096
export const PID_MAX_CEIL = 4194304

// Swap can be 0 (= none).
export const SWAP_MIN_GIB = 0

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
    machine: 'cgroupVersion',
    half: true,
  }
}
