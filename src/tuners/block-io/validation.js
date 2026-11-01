/**
 * Cross-parameter and profile-aware notes. The cards offer only values the
 * kernel accepts (the scheduler list follows the profile), so nothing here
 * blocks the output: settings that cost seeks or latency are warnings, and
 * trade-offs are info notes.
 *
 * @typedef {Object} ValidationIssue
 * @property {string}   id        Stable identifier (used as banner key)
 * @property {'warn' | 'info'} level
 * @property {string[]} params    Parameter keys this issue relates to
 * @property {string}   message
 * @property {boolean}  blocking  Always false here
 */

import { seeks } from './calculations.js'

/** Read-ahead above this, on random I/O, mostly fills the cache with pages nobody asked for. */
const RANDOM_READ_AHEAD_KB = 512

/**
 * @param {import('./profile.js').BlockIoSpec} hw
 * @param {import('./defs.js').BlockIoValues} p
 * @returns {ValidationIssue[]}
 */
export function validate(hw, p) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const warn = (id, params, message) => issues.push({ id, level: 'warn', blocking: false, params, message })
  const info = (id, params, message) => issues.push({ id, level: 'info', blocking: false, params, message })

  if (seeks(hw) && p.scheduler === 'none') {
    warn('none-hdd', ['scheduler'],
      'Without a scheduler, requests reach the hard disk in the order programs issue them, and it seeks between them. mq-deadline or bfq sort them by sector first.')
  }
  if (seeks(hw) && p.scheduler === 'kyber') {
    info('kyber-hdd', ['scheduler'],
      'Kyber is built for fast multi-queue devices and doesn\'t sort requests by sector, which a hard disk depends on. mq-deadline or bfq suit it better.')
  }
  if (hw.device === 'nvme' && p.scheduler === 'bfq') {
    info('bfq-nvme', ['scheduler'],
      'BFQ\'s own docs measured 250 to 400 thousand requests a second on desktop CPUs, below what a fast NVMe drive does, so it can cap the drive\'s throughput. Keep it where responsiveness under load matters more.')
  }

  if (p.read_ahead_kb === 0) {
    warn('read-ahead-off', ['read_ahead_kb'],
      'With no read-ahead, a sequential read fetches only what each read() asks for, so a program reading a file in small pieces waits on the disk for every one.')
  } else if (hw.workload === 'database' && p.read_ahead_kb > RANDOM_READ_AHEAD_KB) {
    info('read-ahead-random', ['read_ahead_kb'],
      'Database reads are mostly random, so a large read-ahead window reads data no query asked for and pushes useful pages out of the cache.')
  }

  if (p.nomerges === 2) {
    info('nomerges-off', ['nomerges'],
      'With merging off, every request goes to the device on its own, sequential ones included. That saves CPU time only for loads that are purely random.')
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
