/**
 * Contract suite: runs over every tuner in TUNER_DOMAINS, so a new tuner gets
 * these checks without writing them. See Design.md §9 "Contract tests" and
 * §10 "Automated guards". A tuner's own *.test.js covers only its math.
 */
import { describe, it, expect } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { TUNER_DOMAINS } from './domains.js'
import { assertTuner } from '@/core/defineTuner.js'
import { restoreState } from '@/core/createTunerStore.js'
import { parseRichText } from '@/ui/richText.js'

const NOW = new Date('2026-01-01T00:00:00Z')
const CONTROLS = ['slider', 'toggle', 'segmented']
const EM_DASH = '—'

/**
 * Settings that make the consumer run a program (Design.md §10). Checked
 * against every non-comment output line.
 */
const FORBIDDEN_DIRECTIVES = [
  /^\s*(RUN|PROGRAM)\s*[+:!]?=/,
  /IMPORT\{program\}/,
  /^\s*Exec[A-Za-z]*\s*=/,
  /^\s*\[script\]/i,
  /^\s*script\s*=/i,
  /^\s*kernel\.(core_pattern|modprobe|poweroff_cmd|hotplug)\b/,
]

/** Characters no generated file may contain: control chars other than \n, and Unicode line breaks. */
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)
const CONTROL_CHARS = new RegExp(`[\x00-\x09\x0b-\x1f\x7f${LS}${PS}]`)

// ── State builders ──────────────────────────────────────────────────────────

function profilesFor(domain) {
  return [
    domain.defaultHardware,
    ...domain.workloads.map((w) => ({ ...domain.defaultHardware, [domain.workloadField]: w })),
  ]
}

/** The same merge the store's applyPreset does. */
function presetParams(domain, hw, preset) {
  return { ...domain.deriveDefaults(hw), ...preset.values }
}

function configFor(domain, { hardware, params, activePreset = null }) {
  const preset = activePreset ? domain.presetsById[activePreset] : null
  return domain.generateConfig({
    hardware,
    params,
    presetLabel: preset?.label ?? null,
    customised: preset ? Object.entries(preset.values).some(([k, v]) => params[k] !== v) : false,
    now: NOW,
  })
}

/** Every legitimate state: each profile with its defaults and with each preset. */
function legitimateStates(domain) {
  const states = []
  for (const hardware of profilesFor(domain)) {
    states.push({ hardware, params: domain.deriveDefaults(hardware), activePreset: null })
    for (const preset of domain.presets) {
      states.push({ hardware, params: presetParams(domain, hardware, preset), activePreset: preset.id })
    }
  }
  return states
}

/** Hash from a raw envelope, bypassing encodeState so any JSON can be sent. */
function rawHash(envelope) {
  return compressToEncodedURIComponent(typeof envelope === 'string' ? envelope : JSON.stringify(envelope))
}

function envelope(domain, { hardware = domain.defaultHardware, params, activePreset = null, activeTab = null } = {}) {
  return { v: 1, hardware, params: params ?? domain.deriveDefaults(hardware), activePreset, activeTab }
}

const INJECTIONS = [
  'x\nkernel.core_pattern=|/bin/sh -c id',
  'x\r\nExecStartPre=/bin/sh',
  `x${LS}RUN+="/bin/sh"`,
  '../../etc/passwd',
  'a b',
  '$(id)',
  '#',
  '',
]

const HOSTILE_VALUES = [
  ...INJECTIONS,
  -1, 0, 1, 0.5, 1e-9, 2 ** 53, 1e308, -1e308,
  null, true, false, [], {}, ['general'], { toString: 'x' },
  '__proto__', 'toString', 'constructor', '1',
]

/** Small seeded PRNG so failures reproduce. */
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Random envelopes that mix valid and hostile values field by field, so some
 * survive restore and exercise the generator with edge values.
 */
function fuzzEnvelopes(domain, count, seed = 1) {
  const rand = mulberry32(seed)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const out = []
  for (let i = 0; i < count; i++) {
    const base = pick(profilesFor(domain))
    const hardware = {}
    for (const [field, value] of Object.entries(base)) {
      hardware[field] = rand() < 0.85 ? value : pick(HOSTILE_VALUES)
    }
    if (rand() < 0.2) hardware[pick(['__proto__', 'extra', 'constructor'])] = pick(HOSTILE_VALUES)
    const defaults = domain.deriveDefaults(base)
    const params = {}
    for (const key of domain.parameterKeys) {
      const r = rand()
      params[key] = r < 0.6 ? defaults[key] : r < 0.9 ? pick([-1, 0, 1, 0.5, 1e9, -1e9, 2 ** 53, 1e308]) : pick(HOSTILE_VALUES)
    }
    const activePreset = rand() < 0.5 ? pick(domain.presets).id : pick(HOSTILE_VALUES)
    out.push({ v: rand() < 0.95 ? 1 : pick([0, 2, '1', null]), hardware, params, activePreset, activeTab: pick(['x', null, 1, domain.defaultTab]) })
  }
  return out
}

// ── Output grammar ──────────────────────────────────────────────────────────

/**
 * The lines a tuner's config may contain: blank, comment, an ini section
 * header, or `<def name> = <value>` / `<def name>=<value>` with a plain token
 * value. Anything else means input reached the output as structure. Returns
 * the offending lines.
 */
function grammarViolations(domain, config) {
  // sysctlName may carry a display suffix ("DefaultLimitNOFILE (soft)"); the
  // emitted name is the part before it.
  const names = new Set(Object.values(domain.defsByKey).map((d) => d.sysctlName.split(' ')[0]))
  const bad = []
  for (const line of config.split('\n')) {
    if (line === '' || line.startsWith('#')) continue
    if (/^\[[A-Z][A-Za-z]*\]$/.test(line)) continue
    const m = /^([A-Za-z][\w.]*)(?: = |=)([A-Za-z0-9:%]+)$/.exec(line)
    if (m && names.has(m[1])) continue
    bad.push(line)
  }
  return bad
}

function directiveViolations(config) {
  return config
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .filter((line) => FORBIDDEN_DIRECTIVES.some((re) => re.test(line)))
}

function expectSafeConfig(domain, config) {
  expect(config).not.toMatch(CONTROL_CHARS)
  expect(grammarViolations(domain, config)).toEqual([])
  expect(directiveViolations(config)).toEqual([])
}

/** Every string reachable from a value, for the copy checks. */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out))
  return out
}

// ── The suite ───────────────────────────────────────────────────────────────

describe.each(TUNER_DOMAINS.map((d) => [d.id, d]))('tuner contract: %s', (_id, domain) => {
  describe('definition', () => {
    it('passes the defineTuner structural checks', () => {
      expect(() => assertTuner(domain)).not.toThrow()
    })

    it('has a def with docs, descriptions and a known control for every key', () => {
      for (const key of domain.parameterKeys) {
        const def = domain.defsByKey[key]
        expect(def.key, key).toBe(key)
        expect(def.kernelDocsUrl, key).toMatch(/^https:\/\//)
        expect(def.shortDesc, key).toBeTruthy()
        expect(def.longDesc?.length, key).toBeGreaterThan(0)
        expect(CONTROLS, key).toContain(def.control)
        expect(def.sysctlName, key).toMatch(/^[A-Za-z][\w.]*( \(\w+\))?$/)
        expect(Number.isInteger(def.kernelMin) && Number.isInteger(def.kernelMax), key).toBe(true)
        expect(def.kernelMin, key).toBeLessThanOrEqual(def.kernelMax)
      }
    })
  })

  describe('defaults and presets', () => {
    it.each(profilesFor(domain).map((hw) => [hw[domain.workloadField], hw]))(
      'derives in-range integer defaults for the %s profile',
      (_w, hw) => {
        const params = domain.deriveDefaults(hw)
        expect(Object.keys(params).sort()).toEqual([...domain.parameterKeys].sort())
        for (const key of domain.parameterKeys) {
          const { min, max } = domain.rangeFor(key, hw)
          expect(Number.isInteger(params[key]), key).toBe(true)
          expect(params[key], key).toBeGreaterThanOrEqual(min)
          expect(params[key], key).toBeLessThanOrEqual(max)
        }
      },
    )

    it('has presets that name only known keys with in-range integer values', () => {
      const hw = domain.defaultHardware
      for (const preset of domain.presets) {
        expect(preset.label && preset.description && preset.source, preset.id).toBeTruthy()
        for (const [key, value] of Object.entries(preset.values)) {
          expect(domain.parameterKeys, `${preset.id}.${key}`).toContain(key)
          const { min, max } = domain.rangeFor(key, hw)
          expect(Number.isInteger(value), `${preset.id}.${key}`).toBe(true)
          expect(value, `${preset.id}.${key}`).toBeGreaterThanOrEqual(min)
          expect(value, `${preset.id}.${key}`).toBeLessThanOrEqual(max)
        }
      }
    })

    it('generates a non-blocked config for every profile default and every preset', () => {
      for (const state of legitimateStates(domain)) {
        const label = `${state.hardware[domain.workloadField]} / ${state.activePreset ?? 'defaults'}`
        const blocking = domain.validate(state.hardware, state.params).filter((i) => i.blocking)
        expect(blocking.map((i) => i.id), label).toEqual([])
        expectSafeConfig(domain, configFor(domain, state))
      }
    })
  })

  describe('shared-link state', () => {
    it('round-trips encodeState → restoreState', () => {
      for (const state of legitimateStates(domain)) {
        const hash = domain.encodeState({ ...state, activeTab: domain.defaultTab })
        expect(restoreState(domain, hash)).toEqual({ ...state, activeTab: domain.defaultTab })
      }
    })

    it('rejects a link with an injected or mistyped profile field', () => {
      for (const field of Object.keys(domain.defaultHardware)) {
        for (const value of [...INJECTIONS, [], {}, true, 1e308]) {
          if (value === '' && domain.defaultHardware[field] === null) continue
          const hash = rawHash(envelope(domain, { hardware: { ...domain.defaultHardware, [field]: value } }))
          expect(restoreState(domain, hash), `${field} = ${JSON.stringify(value)}`).toBeNull()
        }
      }
    })

    it('rejects a link with a missing or non-numeric parameter', () => {
      for (const key of domain.parameterKeys) {
        const params = domain.deriveDefaults(domain.defaultHardware)
        for (const value of [undefined, null, '1', '1\nx=1', [], {}, true]) {
          const hash = rawHash(envelope(domain, { params: { ...params, [key]: value } }))
          expect(restoreState(domain, hash), `${key} = ${JSON.stringify(value)}`).toBeNull()
        }
      }
    })

    it('rejects malformed envelopes', () => {
      const ok = envelope(domain)
      for (const bad of ['', 'not json', 'null', '[]', '1', JSON.stringify({ ...ok, v: 2 }), JSON.stringify({ ...ok, hardware: [] }), JSON.stringify({ ...ok, params: null })]) {
        expect(restoreState(domain, rawHash(bad)), bad).toBeNull()
      }
      expect(restoreState(domain, '%%%not-lz')).toBeNull()
    })

    it('clamps out-of-range and fractional parameters into the slider range', () => {
      for (const key of domain.parameterKeys) {
        for (const value of [-1e308, -1, 0.5, 1e308]) {
          const params = { ...domain.deriveDefaults(domain.defaultHardware), [key]: value }
          const restored = restoreState(domain, rawHash(envelope(domain, { params })))
          const { min, max } = domain.rangeFor(key, restored.hardware)
          expect(Number.isInteger(restored.params[key]), `${key} = ${value}`).toBe(true)
          expect(restored.params[key]).toBeGreaterThanOrEqual(min)
          expect(restored.params[key]).toBeLessThanOrEqual(max)
        }
      }
    })

    it('drops unknown and inherited preset ids and non-string tabs', () => {
      for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'no-such-preset', 1, {}]) {
        const restored = restoreState(domain, rawHash(envelope(domain, { activePreset: id, activeTab: 1 })))
        expect(restored.activePreset, String(id)).toBeNull()
        expect(restored.activeTab).toBeNull()
      }
    })

    it('drops unknown keys, including __proto__, instead of copying them', () => {
      const json = JSON.stringify(envelope(domain)).replace(
        '"hardware":{',
        '"hardware":{"__proto__":{"polluted":1},"extra":"x\\nfoo=1",',
      )
      const restored = restoreState(domain, rawHash(json))
      expect(Object.keys(restored.hardware).sort()).toEqual(Object.keys(domain.defaultHardware).sort())
      expect({}.polluted).toBeUndefined()
    })
  })

  describe('hostile links (Design.md §10)', () => {
    it('never lets a fuzzed link add a line, a directive or a control char to the config', () => {
      let survived = 0
      for (const env of fuzzEnvelopes(domain, 400)) {
        const restored = restoreState(domain, rawHash(env))
        if (!restored) continue
        survived++
        for (const key of domain.parameterKeys) {
          const { min, max } = domain.rangeFor(key, restored.hardware)
          expect(Number.isInteger(restored.params[key])).toBe(true)
          expect(restored.params[key]).toBeGreaterThanOrEqual(min)
          expect(restored.params[key]).toBeLessThanOrEqual(max)
        }
        expectSafeConfig(domain, configFor(domain, restored))
      }
      // The fuzz is only meaningful if some links get through to the generator.
      expect(survived).toBeGreaterThan(20)
    })
  })

  describe('page copy', () => {
    it('has the fields TunerPage and AboutSection render', () => {
      const { page, about } = domain
      expect(page.title && page.intro && page.adSlot).toBeTruthy()
      expect(page.profileStep.id).toMatch(/^[a-z]+$/)
      expect(page.profileStep.label && page.profileStep.title && page.tuneSubtitle).toBeTruthy()
      expect(page.exportStep.title && page.exportStep.subtitle).toBeTruthy()
      expect(about.heading).toBeTruthy()
      for (const section of about.sections) {
        expect(section.title).toBeTruthy()
        for (const block of section.blocks) expect(Boolean(block.p) !== Array.isArray(block.ul)).toBe(true)
      }
    })

    it('links only to https URLs and leaves no stray markup', () => {
      for (const text of [domain.page.intro, ...strings(domain.about)]) {
        for (const seg of parseRichText(text)) {
          if (seg.type === 'link') expect(seg.href).toMatch(/^https:\/\/[^\s"'<>]+$/)
          if (seg.type === 'text') expect(seg.text, text).not.toMatch(/`|\*\*|\]\(/)
        }
      }
    })
  })

  describe('copy (Design.md §8)', () => {
    it('has no em dash in any displayed string or generated config', () => {
      const shown = [
        ...strings(Object.values(domain.defsByKey)),
        ...strings(domain.presets),
        ...strings(domain.sections),
        domain.context.label,
        domain.context.badge,
        domain.docsLabel,
        ...strings(domain.page),
        ...strings(domain.about),
      ]
      for (const state of legitimateStates(domain)) {
        shown.push(...domain.validate(state.hardware, state.params).map((i) => i.message))
        shown.push(configFor(domain, state))
      }
      expect(shown.filter((s) => s.includes(EM_DASH))).toEqual([])
    })
  })
})
