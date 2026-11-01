/**
 * Contract suite: runs over every tuner in TUNER_DOMAINS, so a new tuner gets
 * these checks without writing them. See Design.md §9 "Contract tests" and
 * §10 "Automated guards". A tuner's own *.test.js covers only its math.
 */
import { describe, it, expect } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { TUNER_DOMAINS } from './domains.js'
import { assertTuner } from '@/core/defineTuner.js'
import { restoreState, presetParams } from '@/core/createTunerStore.js'
import { parseRichText } from '@/ui/richText.js'
import { combineFiles, isSafeConfigPath } from '@/core/output/files.js'
import { differingKeys, valueTypeOf } from '@/core/valueTypes.js'
import { CONTROLS } from '@/ui/controls/index.js'
import { normalizeField } from '@/core/profile.js'

const NOW = new Date('2026-01-01T00:00:00Z')
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

/** A value the UI could produce: its type parses it and clamping leaves it unchanged. */
function isValidValue(domain, key, value, hw) {
  const def = domain.defsByKey[key]
  const type = valueTypeOf(def)
  return type.restore(value, def) !== undefined && type.equals(type.clamp(value, def, domain.rangeFor(key, hw)), value)
}

// ── State builders ──────────────────────────────────────────────────────────

/**
 * The default profile, each workload, each option of every other choice
 * field, and each `samples` value of a text field (such as an old kernel
 * version) with every workload.
 */
function profilesFor(domain) {
  const variants = domain.profile.fields
    .filter((f) => f.type === 'choice' && f.key !== domain.workloadField)
    .flatMap((f) => f.options.filter((o) => o.value !== f.default).map((o) => ({ ...domain.defaultHardware, [f.key]: o.value })))
  const samples = domain.profile.fields
    .filter((f) => f.samples)
    .flatMap((f) => f.samples.flatMap((v) => domain.workloads.map((w) => ({ ...domain.defaultHardware, [domain.workloadField]: w, [f.key]: v }))))
  return [
    domain.defaultHardware,
    ...domain.workloads.map((w) => ({ ...domain.defaultHardware, [domain.workloadField]: w })),
    ...variants,
    ...samples,
  ]
}

/** "workload=k8s" for a profile that differs from the default in one field. */
function profileLabel(domain, hw) {
  const diff = Object.keys(hw).filter((k) => hw[k] !== domain.defaultHardware[k])
  return diff.map((k) => `${k}=${hw[k]}`).join(', ') || 'default'
}

/** Every name a def writes: its sysctlName and any `alsoSets` twins. */
function emittedNames(def) {
  return [def.sysctlName.split(' ')[0], ...(def.alsoSets ?? [])]
}


function configFor(domain, { hardware, params, activePreset = null }) {
  const preset = activePreset ? domain.presetsById[activePreset] : null
  return domain.generateConfig({
    hardware,
    params,
    presetLabel: preset?.label ?? null,
    customised: preset ? differingKeys(domain.defsByKey, preset.values, params).length > 0 : false,
    now: NOW,
  })
}

/** Every legitimate state: each profile with its defaults and with each preset. */
function legitimateStates(domain) {
  const states = []
  for (const hardware of profilesFor(domain)) {
    states.push({ hardware, params: domain.deriveDefaults(hardware), activePreset: null })
    for (const preset of domain.presets) {
      states.push({ hardware, params: presetParams(domain, hardware, preset.values), activePreset: preset.id })
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

const EDGE_NUMBERS = [-1, 0, 1, 0.5, 1e9, -1e9, 2 ** 53, 1e308]

/**
 * An out-of-range value of the def's own shape, so it survives parsing and
 * reaches the clamp: an edge number, a tuple of them (sometimes the wrong
 * length), or an enum option (sometimes an unlisted one).
 */
function edgeValue(def, pick, rand) {
  if (def.type === 'tuple') {
    const length = rand() < 0.9 ? def.length : def.length + 1
    return Array.from({ length }, () => pick(EDGE_NUMBERS))
  }
  if (def.type === 'enum') return rand() < 0.8 ? pick(def.options).value : 'not-an-option'
  return pick(EDGE_NUMBERS)
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
      const def = domain.defsByKey[key]
      const r = rand()
      params[key] = r < 0.6 ? defaults[key] : r < 0.9 ? edgeValue(def, pick, rand) : pick(HOSTILE_VALUES)
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
  const names = new Set(Object.values(domain.defsByKey).flatMap(emittedNames))
  const bad = []
  for (const line of config.split('\n')) {
    if (line === '' || line.startsWith('#')) continue
    if (/^\[[A-Z][A-Za-z]*\]$/.test(line)) continue
    const m = /^([A-Za-z][\w.-]*)(?: = |=)([A-Za-z0-9:%_]+(?: [A-Za-z0-9:%_]+)*)$/.exec(line)
    if (m && names.has(m[1])) continue
    bad.push(line)
  }
  return bad
}

/**
 * sysctl lines whose value isn't exactly what the def's value type prints for
 * the param. ini lines are exempt: the tuner wraps typed values in ini syntax
 * (`50%`, `yes`), and the grammar check holds those to plain tokens.
 */
function typeFormatterViolations(domain, config, params) {
  const defsByName = new Map(Object.values(domain.defsByKey).flatMap((d) => emittedNames(d).map((name) => [name, d])))
  const bad = []
  for (const line of config.split('\n')) {
    const m = /^([a-z][\w.-]*) = (.*)$/.exec(line)
    if (!m) continue
    const def = defsByName.get(m[1])
    if (!def || m[2] !== valueTypeOf(def).format(params[def.key], def)) bad.push(line)
  }
  return bad
}

function directiveViolations(config) {
  return config
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .filter((line) => FORBIDDEN_DIRECTIVES.some((re) => re.test(line)))
}

function expectSafeConfig(domain, files, params) {
  expect(files.length).toBeGreaterThan(0)
  const paths = files.map((f) => f.path)
  expect(paths.filter((p) => !isSafeConfigPath(p))).toEqual([])
  expect(new Set(paths).size).toBe(paths.length)
  for (const { content } of files) {
    expect(content).not.toMatch(CONTROL_CHARS)
    expect(grammarViolations(domain, content)).toEqual([])
    expect(directiveViolations(content)).toEqual([])
    expect(typeFormatterViolations(domain, content, params)).toEqual([])
  }
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

    it('has profile picks and options the field itself accepts', () => {
      for (const field of domain.profile.fields) {
        for (const pick of field.picks ?? []) {
          const value = typeof pick === 'object' ? pick.value : pick
          expect(normalizeField(field, value), `${field.key} pick ${value}`).toBe(value)
        }
        if (field.type === 'choice') {
          const values = field.options.map((o) => o.value)
          expect(new Set(values).size, field.key).toBe(values.length)
        }
      }
    })

    it('summarises every profile as rich text with no stray markup', () => {
      const label = (key, value) => domain.profile.fields.find((f) => f.key === key).options.find((o) => o.value === value).label
      for (const hw of profilesFor(domain)) {
        const text = domain.profile.summary(hw, label).join(' · ')
        for (const seg of parseRichText(text)) {
          if (seg.type === 'text') expect(seg.text, text).not.toMatch(/`|\*\*|\]\(/)
        }
      }
    })

    it('has a def with docs, descriptions, a known type and a control for that type', () => {
      for (const key of domain.parameterKeys) {
        const def = domain.defsByKey[key]
        expect(def.key, key).toBe(key)
        expect(def.kernelDocsUrl, key).toMatch(/^https:\/\//)
        expect(def.shortDesc, key).toBeTruthy()
        expect(def.longDesc?.length, key).toBeGreaterThan(0)
        expect(Object.hasOwn(CONTROLS, def.control), `${key}: control ${def.control}`).toBe(true)
        expect(() => valueTypeOf(def), key).not.toThrow()
        expect(CONTROLS[def.control].types, `${key}: ${def.control} edits ${def.type ?? 'int'}`).toContain(def.type ?? 'int')
        // Enum values are emitted verbatim by every writer, so they must be plain tokens.
        for (const opt of def.options ?? []) expect(opt.value, key).toMatch(/^[A-Za-z0-9_.-]+$/)
        expect(def.sysctlName, key).toMatch(/^[A-Za-z][\w.-]*( \(\w+\))?$/)
        expect(Number.isInteger(def.kernelMin) && Number.isInteger(def.kernelMax), key).toBe(true)
        expect(def.kernelMin, key).toBeLessThanOrEqual(def.kernelMax)
      }
    })
  })

  describe('defaults and presets', () => {
    it.each(profilesFor(domain).map((hw) => [profileLabel(domain, hw), hw]))(
      'derives valid, in-range defaults for the %s profile',
      (_w, hw) => {
        const params = domain.deriveDefaults(hw)
        expect(Object.keys(params).sort()).toEqual([...domain.parameterKeys].sort())
        for (const key of domain.parameterKeys) {
          expect(isValidValue(domain, key, params[key], hw), `${key} = ${params[key]}`).toBe(true)
        }
      },
    )

    // A preset may name a value an older kernel lacks (swappiness 133 for
    // zram): applyPreset holds it to the profile's range there.
    it('has presets that name only known keys, valid on the default profile and held in range on every other', () => {
      for (const preset of domain.presets) {
        expect(preset.label && preset.description && preset.source, preset.id).toBeTruthy()
        for (const [key, value] of Object.entries(preset.values)) {
          expect(domain.parameterKeys, `${preset.id}.${key}`).toContain(key)
          expect(isValidValue(domain, key, value, domain.defaultHardware), `${preset.id}.${key} = ${value}`).toBe(true)
        }
        for (const hw of profilesFor(domain)) {
          const params = presetParams(domain, hw, preset.values)
          for (const key of domain.parameterKeys) {
            expect(isValidValue(domain, key, params[key], hw), `${preset.id}.${key} = ${params[key]} on ${JSON.stringify(hw)}`).toBe(true)
          }
        }
      }
    })

    it('generates a non-blocked config for every profile default and every preset', () => {
      for (const state of legitimateStates(domain)) {
        const label = `${profileLabel(domain, state.hardware)} / ${state.activePreset ?? 'defaults'}`
        const blocking = domain.validate(state.hardware, state.params).filter((i) => i.blocking)
        expect(blocking.map((i) => i.id), label).toEqual([])
        expectSafeConfig(domain, configFor(domain, state), state.params)
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
        const def = domain.defsByKey[key]
        if (def.type === 'enum') continue
        for (const n of [-1e308, -1, 0.5, 1e308]) {
          // A tuple gets the edge number in every element.
          const value = def.type === 'tuple' ? Array(def.length).fill(n) : n
          const params = { ...domain.deriveDefaults(domain.defaultHardware), [key]: value }
          const restored = restoreState(domain, rawHash(envelope(domain, { params })))
          const { min, max } = domain.rangeFor(key, restored.hardware)
          for (const element of [restored.params[key]].flat()) {
            expect(Number.isInteger(element), `${key} = ${n}`).toBe(true)
            expect(element).toBeGreaterThanOrEqual(min)
            expect(element).toBeLessThanOrEqual(max)
          }
        }
      }
    })

    it('rejects an unlisted enum option and a tuple of the wrong length', () => {
      for (const key of domain.parameterKeys) {
        const def = domain.defsByKey[key]
        const bad = def.type === 'enum' ? ['not-an-option', 'toString', def.options[0].value.toUpperCase()]
          : def.type === 'tuple' ? [Array(def.length - 1).fill(4096), Array(def.length + 1).fill(4096), Array(def.length).fill('1')]
          : []
        for (const value of bad) {
          const params = { ...domain.deriveDefaults(domain.defaultHardware), [key]: value }
          expect(restoreState(domain, rawHash(envelope(domain, { params }))), `${key} = ${JSON.stringify(value)}`).toBeNull()
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
          expect(isValidValue(domain, key, restored.params[key], restored.hardware), key).toBe(true)
        }
        expectSafeConfig(domain, configFor(domain, restored), restored.params)
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
        ...strings(domain.profile),
        ...strings(domain.graphTabs.map(({ label, blurb }) => ({ label, blurb }))),
      ]
      for (const state of legitimateStates(domain)) {
        shown.push(...domain.validate(state.hardware, state.params).map((i) => i.message))
        shown.push(combineFiles(configFor(domain, state)))
      }
      expect(shown.filter((s) => s.includes(EM_DASH))).toEqual([])
    })
  })
})
