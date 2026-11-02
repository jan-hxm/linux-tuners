/**
 * Limits the kernel and systemd size from the machine at boot, which more
 * than one tuner reads. Both were measured on the VM images (vm/suite.mjs).
 */

const GiB = 1024 ** 3

/** Bytes of kernel stack per thread on x86_64: the kernel defaults threads-max to RAM / (8 × this). */
export const THREAD_STACK_BYTES = 16384

/** systemd's DefaultTasksMax: this share of min(pid_max, threads-max). */
export const TASKS_MAX_SHARE = 0.15

/**
 * kernel.threads-max as the kernel sizes it at boot: thread stacks in an
 * eighth of RAM. The kernel counts RAM before freeing its boot memory, so the
 * value it sets is about 1% below this.
 *
 * @param {number} ramGiB
 */
export function bootThreadsMax(ramGiB) {
  return Math.floor((ramGiB * GiB) / (8 * THREAD_STACK_BYTES))
}

/**
 * The DefaultTasksMax systemd sets when it starts: 15% of the smaller of
 * kernel.pid_max and kernel.threads-max, rounded down.
 *
 * @param {number} pidMax
 * @param {number} threadsMax
 */
export function systemdTasksMax(pidMax, threadsMax) {
  return Math.floor(TASKS_MAX_SHARE * Math.min(pidMax, threadsMax))
}
