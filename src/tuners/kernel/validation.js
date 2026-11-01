/**
 * Cross-parameter and profile-aware notes. Every value offered is one the
 * kernel accepts and none locks the machine up, so nothing here blocks the
 * output: settings that leave a crashed machine down are warnings, and the
 * effects on other limits are info notes.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {boolean}  blocking  Always false here
 */

import { defaultTasksMax, effectivePidMax, isEmitted, threadStackRamShare, THREAD_RAM_WARN } from './calculations.js'

/** Bytes per key below which the byte quota runs out before the count. */
const BYTES_PER_KEY = 100

/**
 * @param {import('./profile.js').KernelSpec} hw
 * @param {import('./defs.js').KernelValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message) => issues.push({ id, level: 'warn', blocking: false, params, message })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  if (p.panic === 0 && (p.panic_on_oops === 1 || p.softlockup_panic === 1)) {
    warn('panic-no-reboot', ['panic', 'panic_on_oops', 'softlockup_panic'],
      'With kernel.panic at 0, a panic stops the machine and it stays down until someone resets it. Set kernel.panic above 0 so a panic ends in a reboot.')
  }

  if (p.panic_on_oops === 1 && hw.workload === 'desktop') {
    info('oops-desktop', ['panic_on_oops'],
      'On a desktop an oops is often a driver fault that leaves the rest working. Panicking loses any unsaved work.')
  }

  if (p.softlockup_panic === 1) {
    info('softlockup-vm', ['softlockup_panic'],
      'In a virtual machine, a host too busy to run the guest can make it report a soft lockup, and this then reboots the guest. Leave it off on overcommitted hosts.')
  }

  if (p.sysrq === 'all') {
    info('sysrq-all', ['sysrq'],
      'Anyone at the keyboard or serial console can kill every process, dump memory and registers, or crash the kernel. 176 still lets them restart a hung machine safely.')
  }

  if (isEmitted('threads_max', hw, p)) {
    const pids = effectivePidMax(hw, p)
    if (p.threads_max > pids) {
      info('threads-above-pids', ['threads_max', 'pid_max'],
        `Each thread needs a PID, so kernel.pid_max stops new threads first, at ${pids.toLocaleString()}.`)
    }
    if (threadStackRamShare(hw, p) > THREAD_RAM_WARN) {
      warn('thread-memory', ['threads_max'],
        `Each thread pins 16 KiB of kernel stack, so this many could take ${Math.round(threadStackRamShare(hw, p) * 100)}% of RAM before the limit stops a fork bomb or a thread leak. The kernel default keeps it to an eighth.`)
    }
    info('tasks-max', ['threads_max'],
      `systemd sets each service's default TasksMax to 15% of the smaller of kernel.pid_max and this, ${defaultTasksMax(hw, p).toLocaleString()}, when it starts: after a reboot or systemctl daemon-reexec.`)
  }

  if (p.maxbytes < p.maxkeys * BYTES_PER_KEY) {
    info('keys-bytes', ['maxbytes', 'maxkeys'],
      `That leaves under ${BYTES_PER_KEY} bytes per key, so users run out of bytes before keys. Raise kernel.keys.maxbytes with kernel.keys.maxkeys.`)
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
