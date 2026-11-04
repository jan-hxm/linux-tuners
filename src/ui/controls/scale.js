/**
 * The printed scale under a slider (REDESIGN "Scale", the ruler motif): where
 * a value sits on the range, and the major and minor ticks with their numbers.
 * Pure, so the slider, the landing specimen and tests share it.
 */

/** Where `v` sits on `range`, as 0..100, clamped; 0 for an empty range. */
export function pctOf(v, { min, max }) {
  if (!(max > min) || typeof v !== 'number' || !Number.isFinite(v)) return 0
  return ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100
}

/** Whether `v` is a number inside `range` (a mark outside it isn't drawn). */
export function inRange(v, { min, max }) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

// Intervals of 1, 2, 2.5 or 5 times a power of ten, aiming at about four
// between the ends. Values are integers, so a step under 1 or a 2.5 below 10
// is skipped.
function majorStep(span) {
  const raw = span / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * pow
    if (!Number.isInteger(step) || step < 1) continue
    if (step >= raw) return step
  }
  return Math.max(1, 10 * pow)
}

const SUFFIXES = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
]

/**
 * A short label for a tick: 2500, 50k, 1.5M, 2.1G. Only values of 10 000 and
 * up are shortened, so most scales print their numbers as they are.
 */
export function tickLabel(v) {
  const abs = Math.abs(v)
  if (abs < 10000) return String(v)
  const [div, suffix] = SUFFIXES.find(([d]) => abs >= d)
  const n = v / div
  return `${Number.isInteger(n) ? n : Number(n.toFixed(1))}${suffix}`
}

// Ends closer than this (in % of the track) to a major tick drop their own
// label, so two numbers never print on top of each other.
const END_GAP = 10
const MAX_MINOR = 60

/**
 * Ticks for a range: `major` ticks carry a number, `minor` ones are bare.
 * Both ends always get a tick; an end's number is left out when a major tick
 * sits right beside it.
 *
 * @param {{ min: number, max: number }} range
 * @returns {{ major: { value: number, pct: number, label: string }[], minor: number[] }}
 */
export function scaleTicks({ min, max }) {
  if (!(max > min)) return { major: [{ value: min, pct: 0, label: tickLabel(min) }], minor: [] }
  const span = max - min
  const step = majorStep(span)
  const values = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) values.push(v)

  const major = values.map((value) => ({ value, pct: pctOf(value, { min, max }), label: tickLabel(value) }))
  if (!major.length || major[0].value !== min) {
    const near = major.length && major[0].pct < END_GAP
    major.unshift({ value: min, pct: 0, label: near ? '' : tickLabel(min) })
  }
  if (major[major.length - 1].value !== max) {
    const near = 100 - major[major.length - 1].pct < END_GAP
    major.push({ value: max, pct: 100, label: near ? '' : tickLabel(max) })
  }

  // Five minor intervals per major one, or two, or none, when they're whole.
  const minorStep = [step / 5, step / 2].find((s) => Number.isInteger(s) && s >= 1 && span / s <= MAX_MINOR)
  const minor = []
  if (minorStep) {
    for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
      if (v % step !== 0 && v !== min && v !== max) minor.push(pctOf(v, { min, max }))
    }
  }
  return { major, minor }
}
