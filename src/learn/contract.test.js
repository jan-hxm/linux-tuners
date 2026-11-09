/**
 * Guide contract suite (Design.md §5 "Learning pages > Guide data and checks").
 * Every guide passes validateGuide() with no issues; the fixture guide passes
 * as draft and as live; and each rule fails a broken copy of the fixture with
 * an issue naming the path and the rule.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { IMAGES } from '../../vm/lib/images.mjs'
import { GLOSSARY } from '@/ui/glossary.js'
import { TUNER_DOMAINS } from '@/tuners/domains.js'
import { TUNERS } from '@/tuners/registry.js'
import { validateGuide, answerValueIssue, commandIssues, footnotes, visibleText, sentences, wordCount, TEMPLATE_PARTS, BANNED_WORDS } from './schema.js'
import { IMAGES_ORDER, GUEST_MEMORY_MIB, loadEvidence, valueFor, validateEvidence, resolvePath } from './evidence.js'
import { LEARN as DEMO, DEFS_BY_KEY as DEMO_DEFS } from './__fixtures__/demo.learn.js'
import { PROBES as DEMO_PROBES } from './__fixtures__/demo.probes.js'

const FIXTURE_EVIDENCE = loadEvidence(import.meta.glob('./__fixtures__/evidence/*.json', { eager: true, import: 'default' }))
const COMMITTED_EVIDENCE = loadEvidence()

/** Test names in vm/suite.mjs a side-by-side figure may cite as `backedBy.vmTest`. */
const VM_TESTS = new Set(
  [...readFileSync(new URL('../../vm/suite.mjs', import.meta.url), 'utf8').matchAll(/\bit\(\s*(['"])((?:(?!\1).)+)\1/g)].map((m) => m[2]),
)

// ── The guides ──────────────────────────────────────────────────────────────

/**
 * Every real guide: each tuner folder's learn.js with its probes.js, the
 * domain's defs and the registry's guide status (draft until set). L5's
 * guides.js must list exactly these slugs; see PROGRESS.md.
 */
const LEARN_MODULES = import.meta.glob('../tuners/*/learn.js', { eager: true })
const PROBE_MODULES = import.meta.glob('../tuners/*/probes.js', { eager: true })

const GUIDE_CASES = Object.entries(LEARN_MODULES).map(([file, mod]) => {
  const tunerId = file.split('/').at(-2)
  const domain = TUNER_DOMAINS.find((d) => d.id === tunerId)
  const entry = TUNERS.find((t) => t.id === tunerId)
  return {
    name: tunerId,
    guide: mod.LEARN,
    entry,
    ctx: {
      defsByKey: domain?.defsByKey ?? {},
      probes: PROBE_MODULES[file.replace(/learn\.js$/, 'probes.js')]?.PROBES ?? {},
      evidence: COMMITTED_EVIDENCE,
      glossary: GLOSSARY,
      status: entry?.guide?.status ?? 'draft',
    },
  }
})

/**
 * Guides still drawn in the first figure style, whose labels and tips may
 * break the figure-words budget (labels of at most four words, tips of one
 * sentence) until their package moves them to the new figures (PROGRESS.md).
 * Every other rule holds for them. The list only shrinks: take a guide out
 * when it moves.
 */
const FIGURES_V1 = new Set(['filesystem', 'hugepages', 'kernel', 'network', 'security', 'systemd'])

const DEMO_CTX = { defsByKey: DEMO_DEFS, probes: DEMO_PROBES, evidence: FIXTURE_EVIDENCE, glossary: GLOSSARY, status: 'live' }
const ALL_CASES = [{ name: 'demo (fixture, live)', guide: DEMO, ctx: DEMO_CTX }, ...GUIDE_CASES]

/** vmTest names a guide cites, with their paths. */
function vmTestRefs(guide) {
  return (guide.chapters ?? []).flatMap((ch, i) => (ch.figure?.backedBy?.vmTest ? [{ path: `chapters[${i}].figure.backedBy.vmTest`, name: ch.figure.backedBy.vmTest }] : []))
}

describe.each(ALL_CASES.map((c) => [c.name, c]))('guide contract: %s', (name, { guide, ctx, entry }) => {
  it('passes every check', () => {
    const issues = validateGuide(guide, ctx).filter((i) => !(FIGURES_V1.has(name) && i.rule === 'figure words'))
    expect(issues).toEqual([])
  })

  it('cites only tests that exist in vm/suite.mjs', () => {
    expect(vmTestRefs(guide).filter((r) => !VM_TESTS.has(r.name))).toEqual([])
  })

  if (entry) {
    it("has the registry entry's slug, and a tuner with defs", () => {
      expect(Object.keys(ctx.defsByKey).length).toBeGreaterThan(0)
      if (entry.guide) expect(guide.slug).toBe(entry.guide.slug)
    })
  }
})

describe('guides together', () => {
  it('have unique slugs, none of them the fixture slug', () => {
    const slugs = GUIDE_CASES.map((c) => c.guide.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).not.toContain(DEMO.slug)
  })

  it('the fixture also passes as a draft without evidence', () => {
    expect(validateGuide(DEMO, { ...DEMO_CTX, status: 'draft', evidence: {} })).toEqual([])
  })

  it('lists only guides that exist under FIGURES_V1', () => {
    for (const name of FIGURES_V1) expect(GUIDE_CASES.map((c) => c.name)).toContain(name)
  })

  it('the fixture uses every figure kind, every optional field and every template part', () => {
    const kinds = DEMO.chapters.map((c) => c.figure.kind)
    expect(new Set(kinds)).toEqual(new Set(['stack', 'timeline', 'sideBySide', 'gauge', 'compare', 'tree', 'modes']))
    for (const ch of DEMO.chapters) expect(Object.keys(ch)).toEqual(['id', 'title', ...TEMPLATE_PARTS])
    const json = JSON.stringify(DEMO)
    for (const needle of [
      '"tone":"fit"', '"tone":"error"', '"bands":[', '"sub":', '"layer":', '"vmTest":', '"backedBy":{"probe"', '"leave":true', '"dir":"raise"', '"dir":"lower"', '"to":', '[^', '[[', '**', '`',
      // Figures v2: tips, the scale bar, side-by-side cells, the gauge and its parts.
      '"does":', '"scale":{', '"start":', '"asked":', '"legend":{', '"kind":"gauge"', '"axis":', '"range":{', '"zoom":{', '"fullPerUnit":', '"curve":{"points"', '"events":[', '"mark":', '"from":', '"value":{"probe"',
      // Figures v3: compare (log scale, groups, an index path, a mark, pins), tree, modes (bits, groups, a pin, allValues), ValueRef labels.
      '"kind":"compare"', '"scale":"log"', '"groups":[', '"group":', '"path":"2"', '"marks":[', '"bar":', '"kind":"tree"', '"children":[', '"node":',
      '"kind":"modes"', '"bits":true', '"allValues":true', '"pin":', '"options":[', '"label":"Largest buffer"',
    ]) {
      expect(json, needle).toContain(needle)
    }
    const gauge = DEMO.chapters.find((c) => c.figure.kind === 'gauge').figure
    expect(gauge.pins.some((p) => p.mark) && gauge.pins.some((p) => p.from && p.to)).toBe(true)
    expect(DEMO.parts.scale.segments.at(-1).value).toBeUndefined()
    expect(DEMO.chapters[0].choose.some((q) => q.no === undefined)).toBe(true)
  })
})

// ── Images and evidence ─────────────────────────────────────────────────────

describe('IMAGES_ORDER', () => {
  it('lists the VM images in vm/lib/images.mjs order', () => {
    expect(IMAGES_ORDER.map((i) => i.id)).toEqual(Object.keys(IMAGES))
  })

  it('labels each image by its distribution and release', () => {
    for (const { id, label } of IMAGES_ORDER) {
      const [name, version] = id.split('-')
      expect(label).toBe(`${name[0].toUpperCase()}${name.slice(1)} ${version}`)
    }
  })
})

describe('evidence files', () => {
  it.each(Object.entries({ ...COMMITTED_EVIDENCE }))('committed %s has the frozen shape', (id, file) => {
    expect(validateEvidence(file, id)).toEqual([])
  })

  it('the fixture files cover every image and have the frozen shape', () => {
    expect(Object.keys(FIXTURE_EVIDENCE)).toEqual(IMAGES_ORDER.map((i) => i.id))
    for (const [id, file] of Object.entries(FIXTURE_EVIDENCE)) expect(validateEvidence(file, id)).toEqual([])
  })

  const good = () => structuredClone(FIXTURE_EVIDENCE['debian-13'])
  it.each([
    ['wrong image name', (f) => (f.image = 'debian-12'), 'debian-13.image'],
    ['unknown field', (f) => (f.extra = 1), 'debian-13.extra'],
    ['other guest memory', (f) => (f.guestMemoryMiB = 2048), 'debian-13.guestMemoryMiB'],
    ['bad capture time', (f) => (f.capturedAt = 'yesterday'), 'debian-13.capturedAt'],
    ['kernel with spaces', (f) => (f.kernel = '6.1 <b>'), 'debian-13.kernel'],
    ['unknown status', (f) => (f.probes['demo.worker'].status = 'maybe'), 'debian-13.probes.demo.worker.status'],
    ['absent without a reason', (f) => (f.probes['demo.zram'] = { status: 'absent' }), 'debian-13.probes.demo.zram'],
    ['null value', (f) => (f.probes['demo.reserve'].value = null), 'debian-13.probes.demo.reserve.value'],
    ['infinite value', (f) => (f.probes['demo.reserve'].value = Infinity), 'debian-13.probes.demo.reserve.value'],
    ['em dash in a string', (f) => (f.probes['demo.stalls'].value[0] = 'a—b'), 'debian-13.probes.demo.stalls.value[0]'],
    ['line break in a string', (f) => (f.probes['demo.stalls'].value[0] = 'a\nb'), 'debian-13.probes.demo.stalls.value[0]'],
  ])('rejects %s', (_name, mutate, path) => {
    const file = good()
    mutate(file)
    const issues = validateEvidence(file, 'debian-13')
    expect(issues.map((i) => i.path)).toContain(path)
    expect(issues.every((i) => i.message.startsWith('evidence: '))).toBe(true)
  })

  it('rejects a file for an image the VM suite does not boot', () => {
    const file = { ...good(), image: 'arch' }
    expect(validateEvidence(file, 'arch').map((i) => i.path)).toContain('arch')
  })
})

describe('valueFor', () => {
  const ref = { probe: 'demo.watermarks', path: 'Normal.min', unit: 'pages' }

  it('returns the value with the kernel and capture time', () => {
    expect(valueFor(ref, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'ok', value: 2000, kernel: '0.0.0-fixture', capturedAt: '2000-01-01T00:00:00Z' })
    expect(valueFor({ probe: 'demo.worker' }, 'fedora-43', FIXTURE_EVIDENCE)).toMatchObject({ status: 'ok', value: true })
  })

  it('says absent, with the reason, where the image lacks the thing', () => {
    expect(valueFor({ probe: 'demo.zram' }, 'ubuntu-24.04', FIXTURE_EVIDENCE)).toEqual({
      status: 'absent', value: undefined, reason: 'fixture: no zram module', kernel: '0.0.1-fixture', capturedAt: '2000-01-01T00:00:00Z',
    })
  })

  it('says missing for an unknown image, probe or path, never a number', () => {
    expect(valueFor(ref, 'arch', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    expect(valueFor({ probe: 'demo.nope' }, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    expect(valueFor({ ...ref, path: 'Normal.max' }, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    expect(valueFor(ref, 'debian-13', {})).toEqual({ status: 'missing' })
    expect(valueFor(null, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
  })

  it('walks own properties only', () => {
    for (const path of ['constructor', '__proto__', 'Normal.toString', 'Normal.min.toFixed']) {
      expect(valueFor({ ...ref, path }, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    }
    expect(valueFor({ probe: 'toString' }, 'debian-13', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    expect(valueFor(ref, 'toString', FIXTURE_EVIDENCE)).toEqual({ status: 'missing' })
    expect(resolvePath({ a: [5, 6] }, 'a.1')).toBe(6)
  })

  it('picks one word of a string by a numeric path, as a number when it is one', () => {
    expect(resolvePath('4096 131072 6291456', '2')).toBe(6291456)
    expect(resolvePath('4096\t131072  6291456 ', '1')).toBe(131072)
    expect(resolvePath('cubic reno', '0')).toBe('cubic')
    expect(resolvePath('4096 131072', '2')).toBeUndefined()
    expect(resolvePath('4096 131072', 'x')).toBeUndefined()
    expect(resolvePath({ a: '1 2 3' }, 'a.0')).toBe(1)
    expect(resolvePath('1 2 3', '0.1')).toBeUndefined()
    const sizes = { probe: 'demo.bufSizes', path: '1', unit: 'bytes' }
    expect(valueFor(sizes, 'debian-13', FIXTURE_EVIDENCE)).toMatchObject({ status: 'ok', value: 131072 })
    expect(valueFor(sizes, 'ubuntu-18.04', FIXTURE_EVIDENCE)).toMatchObject({ status: 'ok', value: 87380 })
  })

  it('reads the committed captures by default', () => {
    expect(valueFor(ref, 'debian-13')).toEqual(COMMITTED_EVIDENCE['debian-13'] ? expect.any(Object) : { status: 'missing' })
    expect(GUEST_MEMORY_MIB).toBe(3072)
  })
})

// ── Text helpers ────────────────────────────────────────────────────────────

describe('text helpers', () => {
  it('finds footnotes and leaves them out of what a reader sees', () => {
    expect(footnotes('A.[^vm] B `x.y`.[^proc-5]')).toEqual(['vm', 'proc-5'])
    expect(visibleText('Free `vm.min_free_kbytes` and [[reclaim]].[^vm]', { codeAs: 'code' })).toBe('Free code and reclaim.')
  })

  it('counts words and splits sentences', () => {
    expect(wordCount('  one two\tthree ')).toBe(3)
    expect(sentences('One. Two? Three! Four')).toEqual(['One.', 'Two?', 'Three!', 'Four'])
  })
})

describe('answerValueIssue', () => {
  const options = { options: [{ value: 'none' }, { value: 'blocked', sysctlValue: '0' }], kernelMin: 0, kernelMax: 0 }
  const bool = { kernelMin: 0, kernelMax: 1, step: 1 }
  const stepped = { kernelMin: 100, kernelMax: 1000, step: 100 }

  it('takes an option value of a def with options, and only that', () => {
    expect(answerValueIssue(options, 'none')).toBeNull()
    expect(answerValueIssue(options, 'blocked')).toBeNull()
    expect(answerValueIssue(options, '0')).toContain('not one of')
    expect(answerValueIssue(options, 0)).toContain('not one of')
  })

  it('takes a number in the range and on the step of a numeric def', () => {
    expect(answerValueIssue(bool, 0)).toBeNull()
    expect(answerValueIssue(bool, 1)).toBeNull()
    expect(answerValueIssue(stepped, 300)).toBeNull()
    expect(answerValueIssue({ kernelMin: 0, kernelMax: 10 }, 7)).toBeNull()
    expect(answerValueIssue(bool, 2)).toContain('outside')
    expect(answerValueIssue(bool, -1)).toContain('outside')
    expect(answerValueIssue(bool, 0.5)).toContain('step')
    expect(answerValueIssue(stepped, 250)).toContain('step')
    expect(answerValueIssue(bool, '1')).toContain('not a number')
    expect(answerValueIssue(bool, Infinity)).toContain('not a number')
  })

  it('refuses a def with neither options nor a range', () => {
    for (const def of [{}, null, { kernelMin: 0 }, { kernelMin: 0, kernelMax: 0 }]) expect(answerValueIssue(def, 1)).toContain('dir')
  })
})

describe('commandIssues', () => {
  it.each([
    'cat /proc/swaps',
    "grep -E '^(swap_ra|pswpin) ' /proc/vmstat",
    "awk '/MemAvailable/ {print $2}' /proc/meminfo",
    'free -m',
    'swapon --show',
    'swapon --show=NAME,SIZE --noheadings',
    'sysctl vm.swappiness',
    'sysctl -a',
    'dmesg -T',
    'sudo dmesg --level=err',
    'systemctl show -p MemoryMax user.slice',
    'ls /sys/block',
    'findmnt /',
    'udevadm info /dev/sda',
    'cat /proc/meminfo | grep -i swap',
    "sysctl -a | grep vm.dirty | awk '{print $3}'",
  ])('allows %s', (cmd) => {
    expect(commandIssues(cmd)).toEqual([])
  })

  it.each([
    ['rm -rf /', 'starts with'],
    ['cat /proc/swaps > /tmp/x', '">"'],
    ['cat a; reboot', '";"'],
    ['cat `whoami`', 'backtick'],
    ['cat $(whoami)', '"$("'],
    ['cat a && reboot', '"&"'],
    ['cat a | tee /etc/x', 'tee'],
    ['cat a | sh', 'pipes into "sh"'],
    ['cat a || reboot', 'empty pipe stage'],
    ['sysctl -w vm.swappiness=10', '-w'],
    ['sysctl vm.swappiness=10', 'could write'],
    ['sysctl -p', 'could write'],
    ['sysctl --system', 'could write'],
    ['sudo cat /etc/shadow', 'starts with'],
    ['sudo sysctl vm.swappiness', 'starts with'],
    ['dmesg -C', 'clear the log'],
    ['sudo dmesg -c', 'clear the log'],
    ['dmesg -n 1', 'console'],
    ['swapon -a --show', 'starts with'],
    ['swapon --show -a', 'display flags'],
    ['udevadm info --cleanup-db', 'clean the database'],
    ["awk 'BEGIN{system(\"reboot\")}'", 'runs a command'],
    ["awk '{print | \"sh\"}' /proc/meminfo", 'runs a command'],
    ['awk -i inplace 1 /etc/fstab', 'edits in place'],
    ["grep 'x", 'unclosed quote'],
    ['cat a\nreboot', 'line break'],
    ['', 'empty'],
  ])('rejects %j', (cmd, why) => {
    expect(commandIssues(cmd).join(' | ')).toContain(why)
  })
})

// ── Each rule fails a broken copy of the fixture ────────────────────────────

/** The fixture with one change, as a live guide with the fixture evidence. */
function broken(mutate, ctx = {}) {
  const guide = structuredClone(DEMO)
  mutate(guide)
  return validateGuide(guide, { ...DEMO_CTX, ...ctx })
}

const words = (n, w = 'word') => Array(n).fill(w).join(' ')
/** n words as short sentences, so only the word budget trips, not the sentence length. */
const shortSentences = (n) => Array.from({ length: n }, (_, i) => (i % 10 === 9 ? 'word.' : 'word')).join(' ')
const ch0 = (g) => g.chapters[0]

/** Rebuilds a chapter with its keys in a given order. */
const reorder = (ch, keys) => Object.fromEntries(keys.map((k) => [k, ch[k]]))

const RULE_CASES = [
  // template
  ['parts out of order', (g) => (g.chapters[0] = reorder(ch0(g), ['id', 'title', 'oneLine', 'picture', 'body', 'figure', 'pins', 'choose', 'symptoms', 'look', 'sources'])), 'chapters[0]', 'template order'],
  ['a missing part', (g) => delete ch0(g).look, 'chapters[0]', 'shape'],
  ['an unknown field', (g) => (ch0(g).notes = 'x'), 'chapters[0].notes', 'shape'],
  ['a chapter id that is not kebab case', (g) => (ch0(g).id = 'Keeping A Reserve'), 'chapters[0].id', 'unique id'],
  ['two chapters with one id', (g) => (g.chapters[1].id = ch0(g).id), 'chapters[1].id', 'unique id'],
  ['a slug that is not kebab case', (g) => (g.slug = 'Demo Guide'), 'slug', 'shape'],
  ['minutes that are not a whole number', (g) => (g.minutes = 2.5), 'minutes', 'shape'],
  ['no parts map', (g) => delete g.parts, 'guide', 'shape'],
  ['the last question without a no', (g) => delete ch0(g).choose[1].no, 'chapters[0].choose[1].no', 'shape'],
  ['an answer that is neither', (g) => (ch0(g).choose[1].no = { leave: false, why: 'x' }), 'chapters[0].choose[1].no.leave', 'shape'],
  ['an answer direction that is not raise or lower', (g) => (ch0(g).choose[0].yes.dir = 'up'), 'chapters[0].choose[0].yes.dir', 'shape'],
  ['an answer value that is not an option', (g) => (g.chapters[3].choose[0].yes.to = 'loose'), 'chapters[3].choose[0].yes.to', 'answer value'],
  ['an answer value by sysctlValue, not option value', (g) => (g.chapters[3].choose[0].yes.to = '0'), 'chapters[3].choose[0].yes.to', 'answer value'],
  ['an answer value on a def with no options or range', (g) => (ch0(g).choose[0].yes = { key: 'reserve_kbytes', to: 8000 }), 'chapters[0].choose[0].yes.to', 'answer value'],
  ['an answer with both a value and a direction', (g) => (g.chapters[3].choose[0].yes.dir = 'raise'), 'chapters[3].choose[0].yes.dir', 'shape'],
  ['an answer value with an unknown key', (g) => (g.chapters[3].choose[0].yes.key = 'nope'), 'chapters[3].choose[0].yes.key', 'def key'],
  ['a two-line symptom', (g) => (ch0(g).symptoms.low = 'One.\nTwo.'), 'chapters[0].symptoms.low', 'shape'],
  ['an empty picture limit', (g) => (ch0(g).picture.limit = ' '), 'chapters[0].picture.limit', 'shape'],
  // budgets
  ['a long oneLine', (g) => (ch0(g).oneLine = shortSentences(31)), 'chapters[0].oneLine', 'word budget'],
  ['a long picture', (g) => (ch0(g).picture.text = shortSentences(71)), 'chapters[0].picture.text', 'word budget'],
  ['four paragraphs', (g) => ch0(g).body.push('Two.', 'Three.'), 'chapters[0].body', 'word budget'],
  ['a long paragraph', (g) => (ch0(g).body[1] = `${shortSentences(71)}[^vm]`), 'chapters[0].body[1]', 'word budget'],
  ['a long pin', (g) => (ch0(g).pins[0].here = shortSentences(41)), 'chapters[0].pins[0].here', 'word budget'],
  ['four questions', (g) => ch0(g).choose.unshift(...structuredClone(ch0(g).choose)), 'chapters[0].choose', 'word budget'],
  ['a three-sentence lead', (g) => (g.lead = 'One. Two. Three.'), 'lead', 'word budget'],
  ['a long sentence', (g) => (ch0(g).symptoms.high = `${words(31)}.`), 'chapters[0].symptoms.high', 'sentence length'],
  ['a long sentence in a figure label', (g) => (ch0(g).figure.title = words(31)), 'chapters[0].figure.title', 'sentence length'],
  // figure words: labels name a part, tips say what it does in one sentence
  ['a long card title', (g) => (g.parts.cards[0].title = words(5)), 'parts.cards[0].title', 'figure words'],
  ['a long edge label', (g) => (g.parts.edges[0].label = words(5)), 'parts.edges[0].label', 'figure words'],
  ['a long band label', (g) => (g.parts.bands[0].label = words(5)), 'parts.bands[0].label', 'figure words'],
  ['a long node', (g) => (ch0(g).figure.layers[0].nodes[0].text = words(5)), 'chapters[0].figure.layers[0].nodes[0].text', 'figure words'],
  ['a long node sub line', (g) => (ch0(g).figure.layers[0].nodes[0].sub = words(5)), 'chapters[0].figure.layers[0].nodes[0].sub', 'figure words'],
  ['a long band', (g) => (ch0(g).figure.layers[1].bands[0].text = words(5)), 'chapters[0].figure.layers[1].bands[0].text', 'figure words'],
  ['a long layer label', (g) => (ch0(g).figure.layers[0].label = words(5)), 'chapters[0].figure.layers[0].label', 'figure words'],
  ['a long timeline event', (g) => (g.chapters[1].figure.events[0].label = words(5)), 'chapters[1].figure.events[0].label', 'figure words'],
  ['a long side-by-side label', (g) => (g.chapters[2].figure.states[0].label = words(5)), 'chapters[2].figure.states[0].label', 'figure words'],
  ['a long mark label', (g) => (g.chapters[4].figure.marks[0].label = words(5)), 'chapters[4].figure.marks[0].label', 'figure words'],
  ['a long zone label', (g) => (g.chapters[4].figure.zones[0].label = words(5)), 'chapters[4].figure.zones[0].label', 'figure words'],
  ['a long scale segment', (g) => (g.parts.scale.segments[0].label = words(5)), 'parts.scale.segments[0].label', 'figure words'],
  ['a two-sentence tip', (g) => (g.parts.cards[0].does = 'One. Two.'), 'parts.cards[0].does', 'figure words'],
  ['a long tip', (g) => (ch0(g).figure.layers[1].bands[0].does = `${shortSentences(26).replace(/\./g, ',')}.`), 'chapters[0].figure.layers[1].bands[0].does', 'figure words'],
  ['a two-sentence zone tip', (g) => (g.chapters[4].figure.zones[0].does = 'One. Two.'), 'chapters[4].figure.zones[0].does', 'figure words'],
  // words and dashes
  ...BANNED_WORDS.map((w) => [`the banned word "${w}"`, (g) => (g.chapters[1].look.for = `Look at it, ${w}, here.`), 'chapters[1].look.for', 'banned word']),
  ['an em dash in a title', (g) => (g.title = 'How it works — a demo'), 'title', 'em dash'],
  ['an em dash in a command', (g) => (ch0(g).look.cmd = 'cat /proc/swaps —'), 'chapters[0].look.cmd', 'em dash'],
  ['an em dash in a source label', (g) => (ch0(g).sources.vm.label = 'vm — docs'), 'chapters[0].sources.vm.label', 'em dash'],
  ['an em dash in a figure', (g) => (g.parts.edges[0].label = 'a — b'), 'parts.edges[0].label', 'em dash'],
  // rich text
  ['italic markup', (g) => (ch0(g).body[0] = 'An *italic* word.[^vm]'), 'chapters[0].body[0]', 'rich text'],
  ['an unclosed code span', (g) => (ch0(g).oneLine = 'Run `free -m to see.'), 'chapters[0].oneLine', 'rich text'],
  ['a broken glossary mark', (g) => (ch0(g).picture.text = 'A [[reclaim] mark.'), 'chapters[0].picture.text', 'rich text'],
  ['markup in a plain-text title', (g) => (ch0(g).title = 'Keeping a **reserve**'), 'chapters[0].title', 'rich text'],
  ['markup in a card title', (g) => (g.parts.cards[0].title = 'Ask for `memory`'), 'parts.cards[0].title', 'rich text'],
  ['a link in a tip', (g) => (g.parts.cards[0].does = 'See [the docs](https://docs.kernel.org/mm/index.html).'), 'parts.cards[0].does', 'tooltip'],
  ['a glossary term in a tip', (g) => (g.parts.cards[0].does = 'Ask for [[reclaim]].'), 'parts.cards[0].does', 'tooltip'],
  ['italic markup in a tip', (g) => (g.parts.cards[0].does = 'Ask for *memory*.'), 'parts.cards[0].does', 'rich text'],
  ['a broken footnote mark', (g) => (ch0(g).body[0] = 'Each zone.[^Vm Docs]'), 'chapters[0].body[0]', 'rich text'],
  // glossary and sources
  ['an unknown glossary id', (g) => (ch0(g).oneLine = 'The [[swap storm]] hits.'), 'chapters[0].oneLine', 'glossary'],
  ['a footnote without a source', (g) => (ch0(g).body[0] += '[^missing]'), 'chapters[0].body[0]', 'footnote'],
  ['a footnote outside the body', (g) => (ch0(g).oneLine += '[^vm]'), 'chapters[0].oneLine', 'footnote'],
  ['a footnote inside bold', (g) => (ch0(g).body[1] = 'The **reserve[^vm]** setting moves all three levels.'), 'chapters[0].body[1]', 'footnote'],
  ['a footnote inside a code span', (g) => (ch0(g).body[1] = 'The `reserve[^vm]` setting moves all three levels.'), 'chapters[0].body[1]', 'footnote'],
  ['a footnote inside a glossary mark', (g) => (ch0(g).body[1] = 'The [[reclaim[^vm]]] worker frees pages.'), 'chapters[0].body[1]', 'footnote'],
  ['a source nobody cites', (g) => (ch0(g).sources.extra = { url: 'https://docs.kernel.org/mm/index.html', label: 'mm' }), 'chapters[0].sources.extra', 'source'],
  ['no sources', (g) => (g.chapters[1].sources = {}), 'chapters[1].sources', 'source'],
  ['a source over http', (g) => (ch0(g).sources.vm.url = 'http://docs.kernel.org/admin-guide/sysctl/vm.html'), 'chapters[0].sources.vm.url', 'source'],
  ['a source on another host', (g) => (ch0(g).sources.vm.url = 'https://wiki.archlinux.org/title/Swap'), 'chapters[0].sources.vm.url', 'source'],
  ['a source on a look-alike host', (g) => (ch0(g).sources.vm.url = 'https://docs.kernel.org.example.com/vm.html'), 'chapters[0].sources.vm.url', 'source'],
  ['an inline link to another host', (g) => (ch0(g).symptoms.low = 'See [the wiki](https://wiki.archlinux.org/title/Swap).'), 'chapters[0].symptoms.low', 'source'],
  // def keys and pins
  ['a pin on an unknown key', (g) => (ch0(g).pins[1].key = 'swappiness'), 'chapters[0].pins[1].key', 'def key'],
  ['an answer with an unknown key', (g) => (ch0(g).choose[0].yes.key = 'nope'), 'chapters[0].choose[0].yes.key', 'def key'],
  ['a side-by-side setting with an unknown key', (g) => (g.chapters[2].figure.states[0].setting.key = 'nope'), 'chapters[2].figure.states[0].setting.key', 'def key'],
  ['a key pinned nowhere', (g) => ch0(g).pins.pop(), 'chapters', 'pins'],
  ['a key pinned in two chapters', (g) => g.chapters[1].pins.push({ key: 'fill_ratio', here: 'Again.' }), 'chapters[1].pins[1]', 'pins'],
  ['a key pinned twice in one chapter', (g) => ch0(g).pins.push({ key: 'fill_ratio', here: 'Again.' }), 'chapters[0].pins[2].key', 'pins'],
  ['a pin layer the figure lacks', (g) => (ch0(g).pins[0].layer = 'nowhere'), 'chapters[0].pins[0].layer', 'pins'],
  ['a chapter with no pins', (g) => (g.chapters[1].pins = []), 'chapters[1].pins', 'shape'],
  // commands
  ['a look command that writes', (g) => (ch0(g).look.cmd = 'sysctl -w vm.swappiness=10'), 'chapters[0].look.cmd', 'command'],
  ['a check that is not read-only', (g) => (ch0(g).choose[0].check = 'swapoff -a'), 'chapters[0].choose[0].check', 'command'],
  ['a check that redirects', (g) => (ch0(g).choose[0].check = 'cat /proc/swaps > /etc/fstab'), 'chapters[0].choose[0].check', 'command'],
  ['a check that pipes into a shell', (g) => (ch0(g).choose[0].check = 'cat /proc/swaps | sh'), 'chapters[0].choose[0].check', 'command'],
  // probes and evidence
  ['a value from an unknown probe', (g) => (ch0(g).figure.layers[1].values[0].probe = 'demo.nope'), 'chapters[0].figure.layers[1].values[0].probe', 'probe'],
  ['a node probe that does not exist', (g) => (ch0(g).figure.layers[0].nodes[1].probe = 'demo.nope'), 'chapters[0].figure.layers[0].nodes[1].probe', 'probe'],
  ['a card probe that does not exist', (g) => (g.parts.cards[1].probe = 'demo.nope'), 'parts.cards[1].probe', 'probe'],
  ['a backing probe that does not exist', (g) => (g.chapters[3].figure.backedBy.probe = 'demo.nope'), 'chapters[3].figure.backedBy.probe', 'probe'],
  ['a timeline line without a unit', (g) => delete g.chapters[1].figure.lines[0].value.unit, 'chapters[1].figure.lines[0].value', 'shape'],
  ['a path into nothing on a live guide', (g) => (g.chapters[1].figure.lines[0].value.path = 'Normal.max'), 'chapters[1].figure.lines[0].value.probe', 'evidence'],
  // A card or node naming an object-valued probe must say which field it shows.
  ['a card probe whose value is an object, with no path', (g) => { delete g.parts.cards[1].path; delete g.parts.cards[1].unit }, 'parts.cards[1].probe', 'evidence'],
  ['a card path into nothing', (g) => (g.parts.cards[1].path = 'Nope'), 'parts.cards[1].probe', 'evidence'],
  ['a card path that is not a dotted path', (g) => (g.parts.cards[1].path = 'a..b'), 'parts.cards[1].path', 'shape'],
  ['a card unit without a probe', (g) => { delete g.parts.cards[1].probe; delete g.parts.cards[1].path }, 'parts.cards[1]', 'shape'],
  // figure ranges
  ['a curve point above 1', (g) => (g.chapters[1].figure.curve[2] = [0.45, 1.2]), 'chapters[1].figure.curve[2]', 'figure range'],
  ['a curve that goes back in time', (g) => (g.chapters[1].figure.curve[2] = [0.1, 0.3]), 'chapters[1].figure.curve[2]', 'figure range'],
  ['a one-point curve', (g) => (g.chapters[1].figure.curve = [[0, 0]]), 'chapters[1].figure.curve', 'shape'],
  ['an event before the start', (g) => (g.chapters[1].figure.events[0].at = -0.1), 'chapters[1].figure.events[0].at', 'figure range'],
  ['an event tone that does not exist', (g) => (g.chapters[1].figure.events[0].tone = 'warn'), 'chapters[1].figure.events[0].tone', 'shape'],
  ['a timeline that is not schematic', (g) => (g.chapters[1].figure.schematic = false), 'chapters[1].figure.schematic', 'shape'],
  ['more lit cells than cells', (g) => (g.chapters[2].figure.states[1].lit = 13), 'chapters[2].figure.states[1].lit', 'figure range'],
  ['one state', (g) => g.chapters[2].figure.states.pop(), 'chapters[2].figure.states', 'shape'],
  ['a side by side backed by nothing', (g) => (g.chapters[2].figure.backedBy = {}), 'chapters[2].figure.backedBy', 'shape'],
  ['an unknown figure kind', (g) => (ch0(g).figure.kind = 'pie'), 'chapters[0].figure.kind', 'shape'],
  ['a bands layer with nodes', (g) => (ch0(g).figure.layers[1].nodes = [{ id: 'n', text: 'n' }]), 'chapters[0].figure.layers[1].nodes', 'shape'],
  ['an edge across rows and columns', (g) => g.parts.edges.push({ from: 'programs', to: 'worker', label: 'x' }), 'parts.edges[4]', 'figure range'],
  ['an edge to a card that does not exist', (g) => (g.parts.edges[0].to = 'nowhere'), 'parts.edges[0].to', 'figure range'],
  ['two cards in one cell', (g) => (g.parts.cards[1].col = 1), 'parts.cards[1]', 'figure range'],
  ['a card at column 0', (g) => (g.parts.cards[0].col = 0), 'parts.cards[0].col', 'figure range'],
  ['a band past the last row', (g) => (g.parts.bands[1].rows = [2, 3]), 'parts.bands[1].rows', 'figure range'],
  ['a band upside down', (g) => (g.parts.bands[1].rows = [2, 1]), 'parts.bands[1].rows', 'figure range'],
  ['a card tone that does not exist', (g) => (g.parts.cards[0].tone = 'error'), 'parts.cards[0].tone', 'shape'],
  // scale bar
  ['a scale segment in another unit', (g) => (g.parts.scale.segments[0].value.unit = 'pages'), 'parts.scale.segments[0].value.unit', 'figure range'],
  ['a scale rest that is not last', (g) => g.parts.scale.segments.reverse(), 'parts.scale.segments[0]', 'figure range'],
  ['a scale without a total', (g) => delete g.parts.scale.total, 'parts.scale', 'shape'],
  ['a scale total from an unknown probe', (g) => (g.parts.scale.total.probe = 'demo.nope'), 'parts.scale.total.probe', 'probe'],
  ['five scale segments', (g) => g.parts.scale.segments.unshift(...structuredClone(g.parts.scale.segments.slice(0, 2)).map((s, i) => ({ ...s, id: `x${i}` }))), 'parts.scale.segments', 'word budget'],
  ['an unknown scale field', (g) => (g.parts.scale.color = 'red'), 'parts.scale.color', 'shape'],
  // side by side cells
  ['lit cells past the end from start', (g) => (g.chapters[2].figure.states[0].start = 12), 'chapters[2].figure.states[0].lit', 'figure range'],
  ['an asked cell that is not lit', (g) => (g.chapters[2].figure.states[1].asked = 9), 'chapters[2].figure.states[1].asked', 'figure range'],
  ['an asked cell with no legend word', (g) => delete g.chapters[2].figure.legend.asked, 'chapters[2].figure.legend', 'shape'],
  // gauge
  ['a gauge without an axis', (g) => delete g.chapters[4].figure.axis, 'chapters[4].figure', 'shape'],
  ['a gauge mark in another unit', (g) => (g.chapters[4].figure.marks[1].value.unit = 'kB'), 'chapters[4].figure.marks[1].value.unit', 'figure range'],
  ['a gauge mark from an unknown probe', (g) => (g.chapters[4].figure.marks[0].value.probe = 'demo.nope'), 'chapters[4].figure.marks[0].value.probe', 'probe'],
  ['a gauge mark path into nothing', (g) => (g.chapters[4].figure.marks[0].value.path = 'Normal.max'), 'chapters[4].figure.marks[0].value.probe', 'evidence'],
  ['gauge marks out of order on the captures', (g) => g.chapters[4].figure.marks.reverse(), 'chapters[4].figure.marks', 'figure range'],
  ['a zone from a mark that does not exist', (g) => (g.chapters[4].figure.zones[1].from = 'nowhere'), 'chapters[4].figure.zones[1].from', 'figure range'],
  ['a zone upside down', (g) => Object.assign(g.chapters[4].figure.zones[1], { from: 'high', to: 'min' }), 'chapters[4].figure.zones[1]', 'figure range'],
  ['a gauge range upside down', (g) => (g.chapters[4].figure.range = { from: 10, to: 0 }), 'chapters[4].figure.range', 'figure range'],
  ['a zoom in another unit without a conversion', (g) => delete g.chapters[4].figure.zoom.fullPerUnit, 'chapters[4].figure.zoom.full.unit', 'figure range'],
  ['a zoom conversion of 0', (g) => (g.chapters[4].figure.zoom.fullPerUnit = 0), 'chapters[4].figure.zoom.fullPerUnit', 'figure range'],
  ['a gauge curve level past the top', (g) => (g.chapters[4].figure.curve.points[0] = [0, 5]), 'chapters[4].figure.curve.points[0]', 'figure range'],
  ['a gauge curve that goes back in time', (g) => (g.chapters[4].figure.curve.points[2] = [0.1, 1]), 'chapters[4].figure.curve.points[2]', 'figure range'],
  ['a gauge curve event after the end', (g) => (g.chapters[4].figure.curve.events[0].at = 1.5), 'chapters[4].figure.curve.events[0].at', 'figure range'],
  ['a gauge pin on a mark that does not exist', (g) => (g.chapters[4].figure.pins[0].mark = 'nowhere'), 'chapters[4].figure.pins[0].mark', 'figure range'],
  ['a gauge gap pin upside down', (g) => Object.assign(g.chapters[4].figure.pins[1], { from: 'high', to: 'low' }), 'chapters[4].figure.pins[1]', 'figure range'],
  ['a gauge pin on an unknown key', (g) => (g.chapters[4].figure.pins[0].key = 'nope'), 'chapters[4].figure.pins[0].key', 'def key'],
  ['a gauge pin the chapter does not pin', (g) => (g.chapters[4].figure.pins[0].key = 'reserve_kbytes'), 'chapters[4].figure.pins[0].key', 'pins'],
  ['a key drawn twice on a gauge', (g) => (g.chapters[4].figure.pins[1].key = 'floor_kbytes'), 'chapters[4].figure.pins[1].key', 'pins'],
  ['a gauge pin with both a mark and a gap', (g) => (g.chapters[4].figure.pins[0].from = 'low'), 'chapters[4].figure.pins[0].from', 'shape'],
  ['a gauge pin value from an unknown probe', (g) => (g.chapters[4].figure.pins[0].value.probe = 'demo.nope'), 'chapters[4].figure.pins[0].value.probe', 'probe'],
  ['a pin layer naming a gauge part that does not exist', (g) => (g.chapters[4].pins[0].layer = 'max'), 'chapters[4].pins[0].layer', 'pins'],
  // value labels
  ['a long value label', (g) => (g.chapters[5].figure.bars[2].value.label = words(5)), 'chapters[5].figure.bars[2].value.label', 'figure words'],
  ['markup in a value label', (g) => (g.chapters[5].figure.bars[2].value.label = 'the `max`'), 'chapters[5].figure.bars[2].value.label', 'rich text'],
  ['a stack value with no path and no label', (g) => ch0(g).figure.layers[1].values.push({ probe: 'demo.reserve', unit: 'kB' }), 'chapters[0].figure.layers[1].values[3]', 'figure words'],
  // compare
  ['a compare scale that is neither', (g) => (g.chapters[5].figure.scale = 'square'), 'chapters[5].figure.scale', 'shape'],
  ['a compare bar in another unit', (g) => (g.chapters[5].figure.bars[1].value.unit = 'kB'), 'chapters[5].figure.bars[1].value.unit', 'figure range'],
  ['a compare mark in another unit', (g) => (g.chapters[5].figure.marks[0].value.unit = 'kB'), 'chapters[5].figure.marks[0].value.unit', 'figure range'],
  ['a long bar label', (g) => (g.chapters[5].figure.bars[0].label = words(5)), 'chapters[5].figure.bars[0].label', 'figure words'],
  ['a long compare axis', (g) => (g.chapters[5].figure.axis = words(5)), 'chapters[5].figure.axis', 'figure words'],
  ['a two-sentence bar tip', (g) => (g.chapters[5].figure.bars[0].does = 'One. Two.'), 'chapters[5].figure.bars[0].does', 'figure words'],
  ['a bar from an unknown probe', (g) => (g.chapters[5].figure.bars[0].value.probe = 'demo.nope'), 'chapters[5].figure.bars[0].value.probe', 'probe'],
  ['a string index past the last word', (g) => (g.chapters[5].figure.bars[2].value.path = '3'), 'chapters[5].figure.bars[2].value.probe', 'evidence'],
  ['a bar in a group that does not exist', (g) => (g.chapters[5].figure.bars[0].group = 'nowhere'), 'chapters[5].figure.bars[0].group', 'figure range'],
  ['a bar outside every group of a grouped figure', (g) => delete g.chapters[5].figure.bars[0].group, 'chapters[5].figure.bars[0]', 'figure range'],
  ['a group on a figure without groups', (g) => delete g.chapters[5].figure.groups, 'chapters[5].figure.bars[0].group', 'figure range'],
  ['thirteen bars', (g) => g.chapters[5].figure.bars.push(...Array.from({ length: 9 }, (_, i) => ({ ...structuredClone(g.chapters[5].figure.bars[0]), id: `extra-${i}` }))), 'chapters[5].figure.bars', 'word budget'],
  ['two bars with one id', (g) => (g.chapters[5].figure.bars[1].id = 'buf-min'), 'chapters[5].figure.bars[1].id', 'unique id'],
  ['a bar tone that does not exist', (g) => (g.chapters[5].figure.bars[0].tone = 'warn'), 'chapters[5].figure.bars[0].tone', 'shape'],
  ['a compare pin on a bar that does not exist', (g) => (g.chapters[5].figure.pins[0].bar = 'nowhere'), 'chapters[5].figure.pins[0].bar', 'figure range'],
  ['a compare pin on a mark that does not exist', (g) => (g.chapters[5].figure.pins[1].mark = 'nowhere'), 'chapters[5].figure.pins[1].mark', 'figure range'],
  ['a compare pin the chapter does not pin', (g) => (g.chapters[5].figure.pins[0].key = 'reserve_kbytes'), 'chapters[5].figure.pins[0].key', 'pins'],
  ['a key drawn twice on a compare figure', (g) => (g.chapters[5].figure.pins[1] = { key: 'buf_sizes', bar: 'buf-min' }), 'chapters[5].figure.pins[1].key', 'pins'],
  ['a pin layer naming a compare part that does not exist', (g) => (g.chapters[5].pins[0].layer = 'nowhere'), 'chapters[5].pins[0].layer', 'pins'],
  // tree
  ['a tree four levels deep', (g) => (g.chapters[6].figure.root.children[0].children[0].children = [{ id: 'deep', label: 'Deep' }]), 'chapters[6].figure.root.children[0].children[0].children', 'figure range'],
  ['a tree of thirteen nodes', (g) => g.chapters[6].figure.root.children[1].children.push(...Array.from({ length: 7 }, (_, i) => ({ id: `extra-${i}`, label: 'Extra' }))), 'chapters[6].figure', 'figure range'],
  ['two tree nodes with one id', (g) => (g.chapters[6].figure.root.children[1].children[0].id = 'web-service'), 'chapters[6].figure.root.children[1].children[0].id', 'unique id'],
  ['a long tree node', (g) => (g.chapters[6].figure.root.label = words(5)), 'chapters[6].figure.root.label', 'figure words'],
  ['a tree node value from an unknown probe', (g) => (g.chapters[6].figure.root.children[0].value.probe = 'demo.nope'), 'chapters[6].figure.root.children[0].value.probe', 'probe'],
  ['an unknown tree node field', (g) => (g.chapters[6].figure.root.colour = 'red'), 'chapters[6].figure.root.colour', 'shape'],
  ['a tree pin on a node that does not exist', (g) => (g.chapters[6].figure.pins[0].node = 'nowhere'), 'chapters[6].figure.pins[0].node', 'figure range'],
  ['a tree pin the chapter does not pin', (g) => (g.chapters[6].figure.pins[0].key = 'reserve_kbytes'), 'chapters[6].figure.pins[0].key', 'pins'],
  ['a tree pin on an unknown key', (g) => (g.chapters[6].figure.pins[0].key = 'nope'), 'chapters[6].figure.pins[0].key', 'def key'],
  // modes
  ['a modes row with one option', (g) => g.chapters[7].figure.rows[0].options.splice(1), 'chapters[7].figure.rows[0].options', 'shape'],
  ['a modes option listed twice', (g) => (g.chapters[7].figure.rows[0].options[1].value = 'always'), 'chapters[7].figure.rows[0].options[1].value', 'figure range'],
  ['a modes option the pinned def does not write', (g) => (g.chapters[7].figure.rows[0].options[2].value = 'sometimes'), 'chapters[7].figure.rows[0].options[2].value', 'mode value'],
  ['a pinned modes row without allValues listing a value the def lacks', (g) => {
    delete g.chapters[7].figure.rows[3].allValues
    delete g.chapters[7].figure.rows[2].pin
    g.chapters[7].figure.rows[3].pin = 'scheduler'
  }, 'chapters[7].figure.rows[3].options[3].value', 'mode value'],
  ['a bits option that is not a power of two', (g) => (g.chapters[7].figure.rows[1].options[0].value = 3), 'chapters[7].figure.rows[1].options[0].value', 'figure range'],
  ['bits set to false', (g) => (g.chapters[7].figure.rows[1].bits = false), 'chapters[7].figure.rows[1].bits', 'shape'],
  ['a long option label', (g) => (g.chapters[7].figure.rows[0].options[0].label = words(5)), 'chapters[7].figure.rows[0].options[0].label', 'figure words'],
  ['a long modes row label', (g) => (g.chapters[7].figure.rows[0].label = words(5)), 'chapters[7].figure.rows[0].label', 'figure words'],
  ['an option value that is neither a number nor a string', (g) => (g.chapters[7].figure.rows[0].options[0].value = null), 'chapters[7].figure.rows[0].options[0].value', 'shape'],
  ['a modes row pin on an unknown key', (g) => (g.chapters[7].figure.rows[0].pin = 'nope'), 'chapters[7].figure.rows[0].pin', 'def key'],
  ['a modes row pin the chapter does not pin', (g) => (g.chapters[7].figure.rows[0].pin = 'reserve_kbytes'), 'chapters[7].figure.rows[0].pin', 'pins'],
  ['a key drawn on two modes rows', (g) => (g.chapters[7].figure.rows[3].pin = 'scheduler'), 'chapters[7].figure.rows[3].pin', 'pins'],
  ['a modes row in a group that does not exist', (g) => (g.chapters[7].figure.rows[0].group = 'nowhere'), 'chapters[7].figure.rows[0].group', 'figure range'],
  ['a modes row value from an unknown probe', (g) => (g.chapters[7].figure.rows[0].value.probe = 'demo.nope'), 'chapters[7].figure.rows[0].value.probe', 'probe'],
]

describe('each rule fails a broken fixture', () => {
  it.each(RULE_CASES)('%s', (_name, mutate, path, rule) => {
    const issues = broken(mutate)
    const hit = issues.find((i) => i.path === path && i.rule === rule)
    expect(hit, `no "${rule}" issue at ${path} in ${JSON.stringify(issues, null, 1)}`).toBeTruthy()
    expect(hit.message.startsWith(`${rule}: `)).toBe(true)
  })

  it('needs evidence for every image once live', () => {
    const { 'fedora-43': _gone, ...four } = FIXTURE_EVIDENCE
    expect(broken(() => {}, { evidence: four })).toContainEqual(expect.objectContaining({ path: 'guide', rule: 'evidence' }))
    expect(broken(() => {}, { evidence: {} }).filter((i) => i.rule === 'evidence')).toHaveLength(IMAGES_ORDER.length)
  })

  it('needs an ok or absent entry for every probe a live figure names', () => {
    const evidence = structuredClone({ ...FIXTURE_EVIDENCE })
    delete evidence['debian-11'].probes['demo.worker']
    const issues = broken(() => {}, { evidence })
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['parts.cards[3].probe', 'chapters[0].figure.layers[0].nodes[1].probe']))
    expect(issues.every((i) => i.rule === 'evidence' && i.message.includes('debian-11'))).toBe(true)
  })

  it('lets a draft miss evidence, but not break any other rule', () => {
    expect(broken(() => {}, { status: 'draft', evidence: {} })).toEqual([])
    expect(broken((g) => (g.title = 'x — y'), { status: 'draft', evidence: {} }).map((i) => i.rule)).toEqual(['em dash'])
  })

  it('rejects an unknown status', () => {
    expect(broken(() => {}, { status: 'beta' })).toContainEqual(expect.objectContaining({ path: 'guide', rule: 'shape' }))
  })

  it('reports a non-object guide without throwing', () => {
    expect(validateGuide(null, DEMO_CTX)).toEqual([{ path: 'guide', rule: 'shape', message: 'shape: must be an object' }])
    expect(() => validateGuide({ chapters: [null, 1, { figure: null }] }, {})).not.toThrow()
  })
})
