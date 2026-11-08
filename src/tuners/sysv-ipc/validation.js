/**
 * Cross-parameter and profile-aware notes. The ranges start at the kernel
 * default and end where the kernel stops accepting values, so nothing here
 * blocks the output: costly or surprising settings are warnings, and what a
 * database asks for is an info note.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {string}   [fix]     What to change to resolve it, in one plain sentence
 * @property {boolean}  blocking  Always false here
 */

import { db2Minimums, queueMemoryBytes, queueRamShare } from './calculations.js'
import { formatBytes } from '@/core/formatting.js'

/** Worst-case queue memory past which it is worth a warning. */
const QUEUE_RAM_WARN = 0.25

/**
 * @param {import('./profile.js').IpcSpec} hw
 * @param {import('./defs.js').IpcValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message, fix) => issues.push({ id, level: 'warn', blocking: false, params, message, fix })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  if (p.msgmax > p.msgmnb) {
    warn('msgmax-above-queue', ['msgmax', 'msgmnb'],
      'A message this large doesn\'t fit in a queue of the default size, so msgsnd() waits for space that never comes (or fails with EAGAIN) unless the program raises its queue\'s size.',
      `Raise kernel.msgmnb to ${p.msgmax.toLocaleString()} or more, or lower kernel.msgmax.`)
  }

  if (queueRamShare(hw, p) > QUEUE_RAM_WARN && p.msgmnb > 16384) {
    warn('queue-memory', ['msgmnb', 'msgmni'],
      `If every message queue were full, the kernel would hold about ${formatBytes(queueMemoryBytes(p))} of messages that can't be swapped, ${Math.round(queueRamShare(hw, p) * 100)}% of RAM. Any local user can create queues; the memory is only used by messages waiting in them.`,
      `Lower kernel.msgmnb or kernel.msgmni until full queues take ${Math.round(QUEUE_RAM_WARN * 100)}% of RAM or less.`)
  }

  if (p.shm_rmid_forced === 1) {
    if (hw.workload === 'oracle' || hw.workload === 'db2') {
      warn('rmid-database', ['shm_rmid_forced'],
        'Databases keep shared memory segments that their tools and restarted processes attach to later. Leave this off on a database host unless the vendor says otherwise.',
        'Set kernel.shm_rmid_forced to 0.')
    } else {
      info('rmid-tools', ['shm_rmid_forced'],
        'A program that creates a segment and exits before another attaches to it loses the segment. Check that nothing on the machine works that way.')
    }
  }

  const [semmsl, semmns, , semmni] = p.sem
  if (semmns < semmsl * semmni) {
    info('semmns-total', ['sem'],
      `SEMMNS caps all semaphores together below SEMMSL × SEMMNI (${(semmsl * semmni).toLocaleString()}), so not every array can be full size. That is fine unless one program needs that many.`)
  }

  if (hw.workload === 'db2') {
    const db2 = db2Minimums(hw)
    const low = [
      p.shmmni < db2.shmmni && 'shmmni',
      p.sem[3] < db2.semmni && 'sem',
      p.msgmni < db2.msgmni && 'msgmni',
      p.msgmax < db2.msgmax && 'msgmax',
      p.msgmnb < db2.msgmnb && 'msgmnb',
    ].filter(Boolean)
    if (low.length) {
      info('db2-minimums', low,
        'This is below the minimum Db2 asks for with this much RAM. Db2 raises it when an instance starts, but not at boot, so other programs see the lower value until then.')
    }
  }

  if (hw.workload === 'container') {
    info('ipc-namespace', ['shmmni', 'msgmnb'],
      'Each container gets its own IPC namespace, which starts at the kernel defaults, not at these values. Set them per container instead: docker run --sysctl, or a pod\'s securityContext.sysctls, where the kubelet has to allow every key but kernel.shm_rmid_forced (--allowed-unsafe-sysctls).')
  }

  return issues
}

/**
 * @param {ValidationIssue[]} issues
 * @returns {boolean}
 */
export function hasBlockingIssue(issues) {
  return issues.some((i) => i.blocking)
}
