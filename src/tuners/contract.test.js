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
import { GLOSSARY } from '@/ui/glossary.js'
import { downloadNames } from '@/ui/fileActions.js'
import { combineFiles, isSafeConfigPath } from '@/core/output/files.js'
import { installSteps } from '@/core/output/installSteps.js'
import { differingKeys, elementRange, valueTypeOf } from '@/core/valueTypes.js'
import { CONTROLS } from '@/ui/controls/index.js'
import { DESC_PARTS } from '@/ui/descParts.js'
import { normalizeField } from '@/core/profile.js'
import { MACHINE_FIELDS, MACHINE_FACTS, DEFAULT_MACHINE, RAM_FIELD, machineValues, factValues, factsReadBy } from '@/core/machine.js'
import { LIVE_TUNERS } from './registry.js'

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

/**
 * Every combination of the machine profile's choice fields, plus the RAM
 * floor and ceiling, so each option of each machine field is mapped at least
 * once alongside every other.
 */
function machineProfiles() {
  let profiles = [DEFAULT_MACHINE]
  for (const field of MACHINE_FIELDS.filter((f) => f.type === 'choice')) {
    profiles = profiles.flatMap((m) => field.options.map((o) => ({ ...m, [field.key]: o.value })))
  }
  return [...profiles, { ...DEFAULT_MACHINE, ramGiB: RAM_FIELD.min }, { ...DEFAULT_MACHINE, ramGiB: RAM_FIELD.max }]
}

/** Facts low enough that every rule reading them fires. */
const LOW_FACTS = Object.freeze(Object.fromEntries(MACHINE_FACTS.map((f) => [f, 1024])))

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

/** Every sysctl name a def writes: its sysctlName and any `alsoSets` twins. A sysfs or udev def writes none. */
function emittedNames(def) {
  if (def.sysfsPath || def.udevAttr) return []
  return [def.sysctlName.split(' ')[0], ...(def.alsoSets ?? [])]
}

/** A tmpfiles.d `w` line: the sysfs path and the value written to it. */
const TMPFILES_WRITE = /^w (\/sys\/\S+) - - - - ([A-Za-z0-9_+.-]+)$/

/**
 * A udev rule: `==` match clauses on the event, subsystem, kernel name, a
 * device property or a sysfs attribute, then one `ATTR{<attr>}="<value>"`.
 * Captures the attribute and the value.
 */
/** An install-step command: a program and plain arguments, no shell syntax. */
const PLAIN_COMMAND = /^(?:sudo )?[a-z][a-z-]*(?: [A-Za-z0-9_./*@=-]+)*$/

const UDEV_ATTR_RULE = /^(?:(?:ACTION|SUBSYSTEM|KERNEL|ENV\{[A-Z_]+\}|ATTR\{[a-z_/]+\})=="[A-Za-z0-9_|*?[\]-]+", )+ATTR\{([a-z_/]+)\}="([A-Za-z0-9_+.-]+)"$/


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
  return { v: domain.linkVersion, hardware, params: params ?? domain.deriveDefaults(hardware), activePreset, activeTab }
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
    out.push({ v: rand() < 0.95 ? domain.linkVersion : pick([domain.linkVersion - 1, domain.linkVersion + 1, String(domain.linkVersion), null]), hardware, params, activePreset, activeTab: pick(['x', null, 1, domain.defaultTab]) })
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
  const sysfsPaths = new Set(Object.values(domain.defsByKey).map((d) => d.sysfsPath).filter(Boolean))
  const udevAttrs = new Set(Object.values(domain.defsByKey).map((d) => d.udevAttr).filter(Boolean))
  const bad = []
  for (const line of config.split('\n')) {
    if (line === '' || line.startsWith('#')) continue
    if (/^\[[A-Z][A-Za-z]*\]$/.test(line)) continue
    const w = TMPFILES_WRITE.exec(line)
    if (w && sysfsPaths.has(w[1])) continue
    const u = UDEV_ATTR_RULE.exec(line)
    if (u && udevAttrs.has(u[1])) continue
    const m = /^([A-Za-z][\w.-]*)(?: = |=)([A-Za-z0-9:%_]+(?: [A-Za-z0-9:%_]+)*)$/.exec(line)
    if (m && names.has(m[1])) continue
    bad.push(line)
  }
  return bad
}

/**
 * sysctl, tmpfiles and udev lines whose value isn't exactly what the def's value
 * type prints for the param. ini lines are exempt: the tuner wraps typed
 * values in ini syntax (`50%`, `yes`), and the grammar check holds those to
 * plain tokens.
 */
function typeFormatterViolations(domain, config, params) {
  const defs = Object.values(domain.defsByKey)
  const defsByName = new Map(defs.flatMap((d) => emittedNames(d).map((name) => [name, d])))
  const defsByPath = new Map(defs.filter((d) => d.sysfsPath).map((d) => [d.sysfsPath, d]))
  const defsByAttr = new Map(defs.filter((d) => d.udevAttr).map((d) => [d.udevAttr, d]))
  const bad = []
  for (const line of config.split('\n')) {
    const u = UDEV_ATTR_RULE.exec(line)
    if (u) {
      const def = defsByAttr.get(u[1])
      if (!def || u[2] !== valueTypeOf(def).format(params[def.key], def)) bad.push(line)
      continue
    }
    const m = /^([a-z][\w.-]*) = (.*)$/.exec(line) ?? TMPFILES_WRITE.exec(line)
    if (!m) continue
    const def = defsByName.get(m[1]) ?? defsByPath.get(m[1])
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

/**
 * Checks a string RichText renders: links are https, glossary ids exist, and
 * no markup is left over in plain text (a typo like `[[term]` or an unclosed
 * code span would show literally).
 */
function expectCleanRichText(text) {
  for (const seg of parseRichText(text)) {
    if (seg.type === 'link') expect(seg.href).toMatch(/^https:\/\/[^\s"'<>]+$/)
    if (seg.type === 'term') expect(Object.hasOwn(GLOSSARY, seg.id), `unknown glossary id "${seg.id}" in: ${text}`).toBe(true)
    if (seg.type === 'text') expect(seg.text, text).not.toMatch(/`|\*\*|(^|\s)\*\S|\]\(|\[\[|\]\]/)
  }
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

    // Design.md §7 "Where a value comes from".
    it('formats every default for the card and bounds every zone inside the kernel range', () => {
      for (const hw of profilesFor(domain)) {
        for (const def of Object.values(domain.defsByKey)) {
          expect(domain.formatValue(def.kernelDefault, def, hw), def.key).toEqual(expect.any(String))
        }
      }
      for (const def of Object.values(domain.defsByKey)) {
        for (const zone of def.zones ?? []) {
          expect(typeof zone.label, def.key).toBe('string')
          if (zone.min === undefined && zone.max === undefined) continue
          expect(def.kernelMin <= zone.min && zone.min <= zone.max && zone.max <= def.kernelMax, `${def.key} ${zone.label}`).toBe(true)
        }
      }
    })

    it('summarises every profile as rich text with no stray markup', () => {
      const label = (key, value) => domain.profile.fields.find((f) => f.key === key).options.find((o) => o.value === value).label
      for (const hw of profilesFor(domain)) {
        expectCleanRichText(domain.profile.summary(hw, label).join(' · '))
      }
    })

    // Design.md §7 "Three layers per parameter".
    it('gives every def a short plain-language title, unique in the tuner', () => {
      const titles = domain.parameterKeys.map((key) => domain.defsByKey[key].title)
      for (const [i, title] of titles.entries()) {
        expect(typeof title, domain.parameterKeys[i]).toBe('string')
        expect(title.length, title).toBeGreaterThan(0)
        expect(title.length, title).toBeLessThanOrEqual(40)
        expect(title, title).not.toMatch(/[.:]$/)
      }
      expect(new Set(titles).size).toBe(titles.length)
    })

    it('gives every def a tier, and every section an essential parameter', () => {
      for (const key of domain.parameterKeys) {
        expect(['essential', 'advanced'], key).toContain(domain.defsByKey[key].tier)
      }
      for (const section of domain.sections) {
        expect(section.keys.some((key) => domain.defsByKey[key].tier === 'essential'), section.id).toBe(true)
      }
    })

    it('splits every longDesc into the labelled parts, with what it does first', () => {
      const parts = DESC_PARTS.map((p) => p.key)
      for (const key of domain.parameterKeys) {
        const { longDesc } = domain.defsByKey[key]
        expect(Object.keys(longDesc).every((k) => parts.includes(k)), key).toBe(true)
        expect(longDesc.what?.length, key).toBeGreaterThan(0)
        for (const paras of Object.values(longDesc)) {
          expect(paras.length, key).toBeGreaterThan(0)
          for (const para of paras) {
            expect(typeof para === 'string' && para.trim().length > 0, key).toBe(true)
            expectCleanRichText(para)
          }
        }
      }
    })

    it('gives a try-it command only as one of the shared plain forms', () => {
      for (const state of legitimateStates(domain)) {
        for (const key of domain.parameterKeys) {
          const def = domain.defsByKey[key]
          const command = domain.tryCommand(def, valueTypeOf(def).format(state.params[key], def))
          if (command === null) continue
          // The value is plain tokens, so the command has no shell syntax beyond the one pipe.
          expect(command, key).toMatch(/^(sudo sysctl -w( [a-z0-9_.-]+=("[A-Za-z0-9_. -]+"|[A-Za-z0-9_.-]+))+|echo [A-Za-z0-9_+.-]+ \| sudo tee \/sys(\/[a-z0-9_]+)+)$/)
          expect(command, key).toContain(def.sysfsPath ?? def.sysctlName)
        }
      }
    })

    it('has a def with docs, descriptions, a known type and a control for that type', () => {
      for (const key of domain.parameterKeys) {
        const def = domain.defsByKey[key]
        expect(def.key, key).toBe(key)
        expect(def.kernelDocsUrl, key).toMatch(/^https:\/\//)
        expect(def.shortDesc, key).toBeTruthy()
        expect(Object.hasOwn(CONTROLS, def.control), `${key}: control ${def.control}`).toBe(true)
        expect(() => valueTypeOf(def), key).not.toThrow()
        expect(CONTROLS[def.control].types, `${key}: ${def.control} edits ${def.type ?? 'int'}`).toContain(def.type ?? 'int')
        // Enum values are emitted verbatim by every writer, so they must be plain tokens.
        for (const opt of def.options ?? []) {
          expect(opt.value, key).toMatch(/^[A-Za-z0-9_.+-]+$/)
          if (opt.sysctlValue !== undefined) expect(opt.sysctlValue, key).toMatch(/^[A-Za-z0-9_.+-]+$/)
        }
        if (def.sysfsPath) {
          // A sysfs def shows the tail of its path as its name.
          expect(def.sysfsPath, key).toMatch(/^\/sys(\/[a-z0-9_]+)+$/)
          expect(def.sysfsPath.endsWith(`/${def.sysctlName}`), key).toBe(true)
        } else if (def.udevAttr) {
          // A udev def names the attribute under the device's sysfs directory.
          expect(def.udevAttr, key).toMatch(/^[a-z_]+(\/[a-z_]+)*$/)
          expect(def.sysctlName, key).toBe(def.udevAttr)
        } else {
          expect(def.sysctlName, key).toMatch(/^[A-Za-z][\w.-]*( \(\w+\))?$/)
        }
        expect(Number.isInteger(def.kernelMin) && Number.isInteger(def.kernelMax), key).toBe(true)
        expect(def.kernelMin, key).toBeLessThanOrEqual(def.kernelMax)
        if (def.elementLimits) {
          // One limit per tuple element, inside the def's outer bounds.
          expect(def.type, key).toBe('tuple')
          expect(def.elementLimits.length, key).toBe(def.length)
          for (const { min, max } of def.elementLimits) {
            expect(Number.isInteger(min) && Number.isInteger(max) && min <= max, key).toBe(true)
            expect(min >= def.kernelMin && max <= def.kernelMax, key).toBe(true)
          }
        }
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

    // Design.md §7 "Export steps": the steps follow from the files alone.
    it('gives every config plain install, check and undo commands', () => {
      for (const state of legitimateStates(domain)) {
        const label = `${profileLabel(domain, state.hardware)} / ${state.activePreset ?? 'defaults'}`
        const files = configFor(domain, state)
        const steps = installSteps(files)
        for (const command of [...steps.save, ...steps.apply, ...steps.check, ...steps.undo]) {
          expect(command, label).toMatch(PLAIN_COMMAND)
        }
        expect(steps.save, label).toEqual(expect.arrayContaining(files.map((f) => `sudo nano ${f.path}`)))
        expect(steps.undo, label).toEqual(expect.arrayContaining(files.map((f) => `sudo rm ${f.path}`)))
        expect(steps.apply.length, label).toBeGreaterThan(0)
        expect(steps.check.length, label).toBeGreaterThan(0)
      }
    })
  })

  // Design.md §5 "Guided setup": a setup step's profile is the tuner's
  // defaults with the machine's values laid over them.
  describe('machine profile', () => {
    it('maps the machine role onto the workload, and copies RAM and the cgroup version', () => {
      const byKey = Object.fromEntries(domain.profile.fields.map((f) => [f.key, f]))
      expect(byKey[domain.workloadField].machine?.from).toBe('role')
      if (byKey.ramGiB) expect(byKey.ramGiB.machine).toBe('ramGiB')
      if (byKey.cgroupVersion) expect(byKey.cgroupVersion.machine).toBe('cgroupVersion')
    })

    it('maps every machine profile to a profile a link restores unchanged, with no blocking issue', () => {
      for (const machine of machineProfiles()) {
        const hardware = { ...domain.defaultHardware, ...machineValues(domain.profile.fields, machine) }
        const state = { hardware, params: domain.deriveDefaults(hardware), activePreset: null, activeTab: domain.defaultTab }
        const label = JSON.stringify(machine)
        expect(restoreState(domain, domain.encodeState(state))?.hardware, label).toEqual(hardware)
        expect(domain.validate(hardware, state.params).filter((i) => i.blocking).map((i) => i.id), label).toEqual([])
      }
    })

    it('provides only known facts, as numbers, and the same facts in every state', () => {
      const keys = Object.keys(domain.facts(domain.defaultHardware, domain.deriveDefaults(domain.defaultHardware))).sort()
      for (const state of legitimateStates(domain)) {
        const facts = domain.facts(state.hardware, state.params)
        expect(Object.keys(facts).sort()).toEqual(keys)
        for (const [fact, value] of Object.entries(facts)) {
          expect(MACHINE_FACTS).toContain(fact)
          expect(Number.isFinite(value), `${fact} = ${value}`).toBe(true)
        }
      }
    })

    it('reads in validate only the facts it declares', () => {
      const facts = new Proxy(LOW_FACTS, {
        get(target, key) {
          if (typeof key === 'string' && !domain.readsFacts.includes(key)) throw new Error(`validate reads undeclared fact "${key}"`)
          return target[key]
        },
      })
      for (const state of legitimateStates(domain)) domain.validate(state.hardware, state.params, facts)
    })

    it('restores every value another tuner gives a fact-fed field unchanged, with no blocking issue', () => {
      for (const provider of TUNER_DOMAINS) {
        for (const state of legitimateStates(provider)) {
          const facts = provider.facts(state.hardware, state.params)
          const fed = factValues(domain.profile.fields, facts)
          if (Object.keys(fed).length === 0) continue
          const hardware = { ...domain.defaultHardware, ...fed }
          const params = domain.deriveDefaults(hardware)
          const label = `${provider.id}: ${JSON.stringify(facts)}`
          const restored = restoreState(domain, domain.encodeState({ hardware, params, activePreset: null, activeTab: domain.defaultTab }))
          expect(restored?.hardware, label).toEqual(hardware)
          expect(domain.validate(hardware, params, facts).filter((i) => i.blocking).map((i) => i.id), label).toEqual([])
        }
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
      for (const bad of ['', 'not json', 'null', '[]', '1', JSON.stringify({ ...ok, v: domain.linkVersion + 1 }), JSON.stringify({ ...ok, hardware: [] }), JSON.stringify({ ...ok, params: null })]) {
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
          const range = domain.rangeFor(key, restored.hardware)
          ;[restored.params[key]].flat().forEach((element, i) => {
            const { min, max } = elementRange(range, i)
            expect(Number.isInteger(element), `${key} = ${n}`).toBe(true)
            expect(element).toBeGreaterThanOrEqual(min)
            expect(element).toBeLessThanOrEqual(max)
          })
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
      for (const text of [domain.page.intro, ...strings(domain.about)]) expectCleanRichText(text)
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
        domain.defaultLabel,
        ...strings(domain.page),
        ...strings(domain.about),
        ...strings(domain.profile),
        ...strings(domain.graphTabs.map(({ label, blurb }) => ({ label, blurb }))),
      ]
      for (const state of legitimateStates(domain)) {
        shown.push(...domain.validate(state.hardware, state.params).map((i) => i.message))
        shown.push(...domain.validate(state.hardware, state.params, LOW_FACTS).map((i) => i.message))
        shown.push(combineFiles(configFor(domain, state)))
      }
      expect(shown.filter((s) => s.includes(EM_DASH))).toEqual([])
    })
  })
})

// Design.md §5 "Guided setup": a fact flows forward through the setup order,
// which is the registry's order.
describe('guided setup facts', () => {
  it('has every fact provided by one tuner, earlier in the setup order than every tuner reading it', () => {
    const byId = Object.fromEntries(TUNER_DOMAINS.map((d) => [d.id, d]))
    const providedBy = {}
    for (const { id } of LIVE_TUNERS) {
      const domain = byId[id]
      for (const fact of factsReadBy(domain)) expect(providedBy[fact], `${id} reads ${fact}`).toBeDefined()
      for (const fact of Object.keys(domain.facts(domain.defaultHardware, domain.deriveDefaults(domain.defaultHardware)))) {
        expect(providedBy[fact], `${fact} from ${id} and ${providedBy[fact]}`).toBeUndefined()
        providedBy[fact] = id
      }
    }
    expect(Object.keys(providedBy).sort()).toEqual([...MACHINE_FACTS].sort())
  })

  // A step's defaults already agree with the defaults before it, so a machine
  // nobody tuned gets no warning from the facts.
  it('raises no issue from the facts when every step keeps its defaults', () => {
    const byId = Object.fromEntries(TUNER_DOMAINS.map((d) => [d.id, d]))
    for (const machine of machineProfiles()) {
      const facts = {}
      for (const { id } of LIVE_TUNERS) {
        const domain = byId[id]
        const hardware = { ...domain.defaultHardware, ...machineValues(domain.profile.fields, machine), ...factValues(domain.profile.fields, facts) }
        const params = domain.deriveDefaults(hardware)
        const ids = (f) => domain.validate(hardware, params, f).map((i) => i.id)
        expect(ids(facts), `${id} on ${JSON.stringify(machine)}`).toEqual(ids({}))
        Object.assign(facts, domain.facts(hardware, params))
      }
    }
  })
})

// Design.md §5 "Guided setup", "Output": the setup writes every tuner's files
// side by side, so none may fight over a value. sysctl.d's lexical order would
// otherwise pick the winner silently.
describe('guided setup output', () => {
  /** What a def writes: its sysctl names, its sysfs path or its udev attribute. */
  const targets = (def) => (def.sysfsPath ? [def.sysfsPath] : def.udevAttr ? [`udev ${def.udevAttr}`] : emittedNames(def))

  it('has no two tuners write the same sysctl key or sysfs path', () => {
    const owner = {}
    for (const domain of TUNER_DOMAINS) {
      for (const def of Object.values(domain.defsByKey)) {
        for (const target of targets(def)) {
          expect(owner[target] ?? domain.id, `${target} from ${domain.id} and ${owner[target]}`).toBe(domain.id)
          owner[target] = domain.id
        }
      }
    }
  })

  it('has no two tuners write the same file, and gives every file its own download name', () => {
    const byPath = {}
    for (const domain of TUNER_DOMAINS) {
      for (const state of legitimateStates(domain)) {
        for (const { path } of configFor(domain, state)) {
          expect(byPath[path] ?? domain.id, `${path} from ${domain.id} and ${byPath[path]}`).toBe(domain.id)
          byPath[path] = domain.id
        }
      }
    }
    const names = downloadNames(Object.keys(byPath))
    expect(new Set(names).size).toBe(names.length)
  })
})
