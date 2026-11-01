import { PARAMETER_DEFS_BY_KEY, IPC_ID_MAX, SEM_DEFAULT } from './defs.js'

const GiB = 1024 ** 3

/** Db2's per-GB minimums (IBM, "Kernel parameter requirements (Linux)"). */
const DB2_SHMMNI_PER_GB = 256
const DB2_SEMMNI_PER_GB = 256
const DB2_MSGMNI_PER_GB = 1024
export const DB2_MSG_BYTES = 65536

/** RAM in whole GB as Db2 counts it, rounded up so its minimums hold. */
function ramGB(hw) {
  return Math.ceil(hw.ramGiB)
}

/** A Db2 per-GB minimum, never below the kernel default nor above IPCMNI. */
function db2Count(perGB, hw, kernelDefault) {
  return Math.min(IPC_ID_MAX, Math.max(kernelDefault, perGB * ramGB(hw)))
}

/**
 * Db2's enforced minimums for this RAM, where they pass the kernel default.
 *
 * @param {import('./profile.js').IpcSpec} hw
 */
export function db2Minimums(hw) {
  return {
    shmmni: db2Count(DB2_SHMMNI_PER_GB, hw, PARAMETER_DEFS_BY_KEY.shmmni.kernelDefault),
    semmni: db2Count(DB2_SEMMNI_PER_GB, hw, SEM_DEFAULT[3]),
    msgmni: db2Count(DB2_MSGMNI_PER_GB, hw, PARAMETER_DEFS_BY_KEY.msgmni.kernelDefault),
    msgmax: DB2_MSG_BYTES,
    msgmnb: DB2_MSG_BYTES,
  }
}

/**
 * Kernel memory in bytes if every message queue were full: queued messages
 * can't be swapped.
 *
 * @param {import('./defs.js').IpcValues} p
 */
export function queueMemoryBytes(p) {
  return p.msgmni * p.msgmnb
}

/** The share of RAM that worst case is. */
export function queueRamShare(hw, p) {
  return queueMemoryBytes(p) / (hw.ramGiB * GiB)
}

/**
 * Profile-aware starting values: the kernel defaults, which already pass
 * what Oracle asks for, and Db2's RAM-based minimums where they are higher.
 * Rounded up to each slider's step.
 *
 * @param {import('./profile.js').IpcSpec} hw
 * @returns {import('./defs.js').IpcValues}
 */
export function deriveDefaults(hw) {
  const values = Object.fromEntries(Object.values(PARAMETER_DEFS_BY_KEY).map((d) => [d.key, d.kernelDefault]))
  if (hw.workload !== 'db2') return /** @type {import('./defs.js').IpcValues} */ ({ ...values, sem: [...SEM_DEFAULT] })
  const db2 = db2Minimums(hw)
  const up = (key, n) => Math.min(PARAMETER_DEFS_BY_KEY[key].kernelMax, Math.ceil(n / PARAMETER_DEFS_BY_KEY[key].step) * PARAMETER_DEFS_BY_KEY[key].step)
  return {
    ...values,
    shmmni: up('shmmni', db2.shmmni),
    sem: [SEM_DEFAULT[0], SEM_DEFAULT[1], SEM_DEFAULT[2], db2.semmni],
    msgmni: up('msgmni', db2.msgmni),
    msgmax: db2.msgmax,
    msgmnb: db2.msgmnb,
  }
}

/**
 * The values the controls offer: the def's range on every profile, and for
 * kernel.sem one range per field.
 *
 * @param {string} key
 * @returns {import('@/core/valueTypes.js').Range}
 */
export function rangeFor(key) {
  const def = PARAMETER_DEFS_BY_KEY[key]
  if (!def) throw new Error(`Unknown System V IPC parameter: ${key}`)
  return def.elementLimits
    ? { min: def.kernelMin, max: def.kernelMax, elements: def.elementLimits }
    : { min: def.kernelMin, max: def.kernelMax }
}
