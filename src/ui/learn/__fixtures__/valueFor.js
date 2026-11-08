/**
 * A local stand-in for L1's valueFor(ref, imageId) (src/learn/evidence.js),
 * reading DEMO_EVIDENCE with the frozen return shape:
 * `{ status, value, kernel, capturedAt }`, or `{ status: 'missing' }` when the
 * image has no capture or the capture has no entry for the probe. Delete at
 * the L1 merge.
 */
import { DEMO_EVIDENCE } from './demo.learn.js'

export function valueFor(ref, imageId) {
  const capture = Object.hasOwn(DEMO_EVIDENCE, imageId) ? DEMO_EVIDENCE[imageId] : null
  const entry = capture && Object.hasOwn(capture.probes, ref.probe) ? capture.probes[ref.probe] : null
  if (!entry) return { status: 'missing' }
  const meta = { kernel: capture.kernel, capturedAt: capture.capturedAt }
  if (entry.status !== 'ok') return { status: entry.status, reason: entry.reason, value: undefined, ...meta }
  let value = entry.value
  for (const step of ref.path ? ref.path.split('.') : []) {
    value = value && typeof value === 'object' && Object.hasOwn(value, step) ? value[step] : undefined
  }
  if (value === undefined) return { status: 'missing' }
  return { status: 'ok', value, ...meta }
}
