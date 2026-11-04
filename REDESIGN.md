# Redesign "Scale": handover for implementing agents

Temporary working document. It breaks the redesign into workstreams that
separate agents can pick up in parallel. When the redesign has shipped, the
lasting decisions go into [Design.md](Design.md) (mainly §5 "Guided setup",
§7 and §8) and **this file is deleted**, like a finished TODO item.

Before you start, read [CLAUDE.md](CLAUDE.md) and the Design.md sections named
in your workstream. Everything in CLAUDE.md "Rules that are easy to break"
still applies. Where this file and Design.md disagree, Design.md wins until
the maintainer updates it, except for the visual rules in "The design system"
below, which this redesign replaces on purpose.

## Contents

1. [Why this redesign](#1-why-this-redesign)
2. [The mockups](#2-the-mockups)
3. [The design system](#3-the-design-system)
4. [Decisions the maintainer makes first](#4-decisions-the-maintainer-makes-first)
5. [Workstreams](#5-workstreams)
6. [Order and parallelism](#6-order-and-parallelism)
7. [Rules for every agent](#7-rules-for-every-agent)
8. [Prompt template for an agent](#8-prompt-template-for-an-agent)
9. [Definition of done](#9-definition-of-done)

## 1. Why this redesign

New visitors are overwhelmed. The landing page is a wall of equal cards with
sysctl names, and nothing says what the site does or where to start. The
redesign has two goals:

- **Make the first minute easy to follow.** One sentence says what the site
  is, the visitor can touch a real setting right away, and a role picker gives
  a numbered route.
- **Let the styling carry the complexity.** Hairlines instead of boxes, one
  meaningful colour, and a fixed place for explanations (the margin) so dense
  information reads calmly.

The site's character comes from what it does, not from decoration: every
value comes with its reasoning, and the reasoning sits beside the value like
notes in the margin of a good reference book.

## 2. The mockups

The approved mockups are on a private claude.ai Design canvas:
`https://claude.ai/artifact/6kfN3UeiGYruUb35sDSVFR`. An agent with the
Artifact tool can read each artboard's source with `action: "read"` and
`path`:

| Artboard | Path | Shows |
|---|---|---|
| Final: Landing (light) | `project/FinalLanding.dc.html` | Hero with a live, annotated setting; the key; why; role picker and route; tuner table; author note and colophon |
| Final: Tuner page (dark) | `project/FinalTuner.dc.html` | Title and machine line, steps on a scale, settings in column and margin, collapsed groups, export with apply/undo in the margin |
| Final: Phone | `project/FinalPhone.dc.html` | Margin notes as `[n]` toggles, shortened role list |
| Final: System sheet | `project/FinalSystem.dc.html` | Principles, marks, colour table, type |

The other artboards on the canvas (Landing page, Tuner page, A to E) are
discarded explorations. Don't build from them.

The mockups are inline-styled HTML. Treat them as the visual reference and
this file as the spec. Copy in the mockups is draft copy: placeholders in
square brackets (`[YOUR NAME]`, `[EXACT CITATION]`, `[AD SLOT]`) must not ship,
and every value or claim must come from the real definitions (see §7).

If you can't open the canvas, this file is enough to build from.

## 3. The design system

### Principles

1. **Column and margin.** A setting sits in the main column; its reasons sit
   in a margin column beside it. The same layout is used for the export
   (file in the column, apply and undo steps in the margin). On narrow
   screens the margin collapses into `[n]` toggle buttons that open the note
   in place, below the line that holds the mark (the Tufte CSS pattern).
2. **Notes answer back.** Where a note depends on the value (zone text, the
   "changed by you" note), it updates as the value changes. See WS6.
3. **One colour until you act.** The page is ink and paper. Verdigris marks
   what fits the visitor's machine. Ochre appears only once the visitor changes
   something. Red is reserved for errors.
4. **Hairlines, not boxes.** Rules divide and nothing floats: no cards, no
   shadows, no rounded corners. The only round shapes are the ochre "yours"
   dot, radio dots and the slider thumb.

### The three marks

Every place that shows where a value comes from (slider, card, file comments,
graphs, the key on the landing page) uses the same three marks. They differ
in shape and lightness as well as hue, so they still work without colour.

| Mark | Meaning | Shape | Colour token |
|---|---|---|---|
| Kernel default | What the kernel (or systemd) ships | Thin tick, 2px wide | `ink` |
| Fits your machine | The profile's default (`profileDefaults`) | Heavier bar, 4px wide | `fit` |
| Changed by you | Value differs from the profile's default (`changedKeys`) | Round dot | `mine` |

Use the domain's `defaultLabel` for the first mark's wording ("Kernel
default", "systemd default"), as today.

### Colour tokens

Light and dark are designed equally and follow `prefers-color-scheme`, as
today (no toggle).

| Token | Use | Light | Dark |
|---|---|---|---|
| `paper` | Page background | `#FAFAF8` | `#151514` |
| `paper-hover` | Row hover, secondary button hover | `#F2F2EF` | `#1C1C1A` |
| `ink` | Text, strong rules, primary button fill, default tick | `#161616` | `#ECECE8` |
| `ink-2` | Second text (descriptions) | `#4A4A46` | `#B8B8B2` |
| `quiet` | Labels, captions, `[n]` marks; 4.5:1 minimum | `#6B6B66` | `#8E8E88` |
| `rule` | Hairlines between rows | `#DEDED9` | `#2E2E2B` |
| `rule-strong` | Secondary button borders, minor ticks | `#8C8C86` | `#4E4E4A` |
| `fit` | "Fits your machine" mark, selected radio dot | `#1F7A6B` | `#4FB8A3` |
| `fit-text` | "Fits your machine" text | `#1A6658` | `#5CC9B4` |
| `fit-tint` | Selected row background | `#EEF4F2` | `#1A2C28` |
| `mine` | "Changed by you" mark | `#B57D24` | `#D69A35` |
| `mine-text` | "Changed by you" text | `#8A5A0E` | `#E9B259` |
| `mine-tint` | Background behind a changed value, if needed | `#FBF1E0` | `#33270F` |
| `error` | Blocking issues only | `#B3301E` | `#FF7A66` |

The contrast ratios in the mockups were estimated, not measured. WS0 measures
every text pair in both schemes (`theme.test.js` style) and adjusts a shade if
it fails 4.5:1 for text or 3:1 for marks and large text. Light `mine` was
`#D69A35` in the mockups, which works out to about 2.4:1 on `paper`, so it is
now `#B57D24` (about 3.4:1 by hand; WS0 confirms by measuring, also on
`paper-hover`). Dark `mine` is fine at about 7:1.

Warnings (legal but odd) use `mine-text` with a warning icon, so they don't
compete with the error colour. Info notes use `ink-2`.

### Type

Two families, both under the SIL Open Font License, **self-hosted** (see §4
decision 1):

| Family | Weights | Use |
|---|---|---|
| Host Grotesk | 400, 500, 600 (plus 400 italic if a note needs it) | Everything a person reads: headlines, body, labels, buttons |
| Fragment Mono | 400 | Everything the machine reads: keys, values, paths, commands, the file, the `[n]` marks, numbers on the ruler |

Scale (desktop / phone):

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page headline (landing h1) | 52px / 34px | 500 | -0.03em |
| Page title (tuner h1) | 44px / 32px | 500 | -0.03em |
| Section headline | 34px / 26px | 500 | -0.02em |
| Group headline | 26px / 22px | 500 | -0.02em |
| Setting title | 20px / 19px | 500 | 0 |
| Setting value | 36 to 40px / 24px, mono | 400 | -0.02em |
| Body | 16 to 19px | 400 | 0 |
| Margin notes | 15px, line-height 1.55 | 400 | 0 |
| Labels, captions | 13 to 14px | 400 to 500 | 0 |

No headline is bolder than 500. Nothing meaningful is smaller than 13px,
which raises today's 12px floor in Design.md §7.

### Shape, space, motif

- Corners are square everywhere (`rounded-none`), apart from the round marks
  listed under Principles.
- No `shadow-*` and no gradients.
- Hairlines are 1px `rule`. A section or group starts with a 1px `ink` rule
  above its heading row.
- Primary button: `ink` fill, `paper` text, square, at least 44px tall.
  Secondary button: 1px `ink` (or `rule-strong`) border, transparent. Text
  buttons: underlined, offset 3px.
- Generous vertical rhythm: landing sections about 96 to 112px apart, settings
  32px padding top and bottom.
- **The motif is the ruler tick.** The logo is a short ruler with one tall
  verdigris tick. The same idea reappears in the slider (a printed scale with
  major and minor ticks and numbers), the step bar (segments on a line, the
  current one thick verdigris) and the key. Don't add other decoration:
  no icons as ornament, no illustrations, no emoji.

### Voice and the author

- A quiet author: a short signed note in the footer, written by the
  maintainer, and a colophon (typefaces, where defaults come from, that the
  output is tested on real distribution kernels). See §4 decision 3.
- No mascot, no jokes in controls, no exclamation marks.
- Copy follows Design.md §8: no em dashes in displayed text, glossary terms
  marked as before.

## 4. Decisions the maintainer makes first

Settled by the maintainer on 2026-11-04. Agents don't reopen these. Anything
these decisions don't cover goes back to the maintainer: stop and ask.

1. **Self-hosted fonts: committed woff2 subsets.** Commit only the Latin woff2
   files actually used (Host Grotesk 400, 500, 600, plus 400 italic only if a
   note needs it; Fragment Mono 400) with their `OFL.txt`, under
   `src/assets/fonts/`. No Fontsource or other npm package. Use
   `font-display: swap` and fallback stacks with close metrics. Never load them
   from Google Fonts (a third-party origin, blocked by Design.md §10). WS0
   records the added bytes and the reason in its report, and WS8 writes them
   into Design.md §5 and §10.
2. **Reactive margin notes (WS6): a follow-up.** The redesign ships with notes
   built from today's data (shortDesc, `longDesc` parts, rule of thumb, the
   default line). WS6 runs after the redesign has shipped, as its own piece of
   work. No workstream adds zone notes or derivation lines before then.
3. **The author note: approved text, signed "jan-hxm".** Use this text
   word for word (agents don't rewrite it):

   > I built this after one too many forum threads that said "set it to X"
   > and never said why, or what happens when you set it to Y. I also wanted
   > to see what a change does, so tuners like swap draw it as a live graph. Every value here comes with its reason, so you can
   > disagree with it.

   The signature is the GitHub handle `jan-hxm`, linking to the GitHub
   profile. The colophon's
   testing claim says only what `vm/README.md` covers: the output is applied
   and read back on Debian 11 and 13, Ubuntu 18.04 and 24.04 and Fedora 43
   (kernels 4.15 to 6.17). Update the claim if that matrix changes, and
   prefer building it from `vm/images.mjs` over hand-typing it.
4. **The landing hero: `vm.swappiness`, desktop example.** The example
   profile is a desktop with 16 GiB RAM and 8 GiB NVMe swap
   (`workload: 'desktop'`, `swapDevice: 'nvme-ssd'`, the other fields at
   their defaults), defined as plain data next to the swap profile. Its value
   comes from `deriveDefaults` (100 today, against the kernel's 60, so the
   fit bar and the default tick sit visibly apart). Don't use
   `DEFAULT_HARDWARE`: its general-server workload gives 60, which puts both
   marks in the same place.
5. **The tuner questions: approved.** A new plain-data `question` field on
   each live registry entry (add it to the `TunerEntry` typedef and cover it
   in `registry.test.js`: present, ends with "?", no em dash). Planned entries
   don't get one. The approved wording:

   | Tuner | Question |
   |---|---|
   | swap | Does it swap too early, or freeze when memory runs out? |
   | security | Can any local user read kernel addresses or trace other processes? |
   | filesystem | Do you see "too many open files" or inotify limit errors? |
   | kernel | Does it run out of processes, or hang after a crash? |
   | systemd | Does one service take the CPU, memory or disk from the others? |
   | network | Does it drop connections under load, or fall short of the link speed? |
   | block-io | Does each disk use a scheduler and read-ahead that suit it? |
   | hugepages | Does your database or VM host ask for huge pages? |
   | sysv-ipc | Does Oracle, Db2 or older middleware ask for higher IPC limits? |
6. **The "Start guided setup" button sits at the top of the route.** The
   mockup puts it under the route, but the route's length depends on the
   role (up to every live tuner, each with its why line), so it can end up
   taller than the role list and push the button out of view. Put the button
   in the route's header row instead, beside the summary ("Database server:
   9 tuners, in this order."), so its top lines up with the top of the role
   list. On a phone it then comes right after the roles and before the route.
   The general rule for the whole redesign: **never place a primary action
   below content whose length depends on data.** "Usually fine to leave"
   stays below the route.

Decisions 7 to 10 come from a design review of the final mockups. The
canvas artboard "Review: five fixes" (`project/ReviewFixes.dc.html`, light
scheme) shows them; where it differs from "Final: Tuner page", it wins. The
fifth fix of that review is the light `mine` shade in §3.

7. **Graphs stay visible by default.** Seeing what a change does is a main
   reason the site exists (see the author note), so graphs never hide behind
   a "Show the graph" click on wide screens. From `lg` up, keep today's
   sticky graph column beside the settings (`GraphPanel` with its tabs, at
   about 400px). When the width can't hold column, margin and graphs, **the
   margin gives way, not the graphs**: below `xl` the margin notes become
   the `[n]` toggles from the phone layout while the graph column stays.
   Below `lg` the graphs sit inline above the settings, open, and the
   `MobileImpactBar` stays. Tuners without graphs use the full width for
   column and margin. This replaces WS4's open question about graph
   placement.
8. **The slider must look draggable.** A ruler of hairlines reads as
   print, so the thumb carries the affordance: a filled `ink` disc of 24px
   with a 3px `paper` ring (44px hit area), a 2px `ink` fill from the
   scale's start to the thumb, a slightly larger thumb on hover and while
   dragging, `cursor: grab` / `grabbing`, and the focus ring from WS0. The
   "changed by you" dot stays a separate mark on the scale and never
   replaces the thumb. WS3 checks with one person who has never seen the
   site that they try to drag it without being told.
9. **A setting's margin holds at most three notes.** In full view the
   margin shows the first three of the notes from today's layers (in the
   order of §7 "Three layers"); the rest stay behind "Learn more" and in
   the drawer. Essential settings open, advanced ones collapsed, as today.
   WS4 compares the full-view height of the largest tuner against today's
   page and reports both numbers.
10. **The export is the finish line.** Step 04 opens with a summary from
    state ("9 settings. 7 fit your machine, 2 changed by you."), Copy is
    the one large primary button (at least 52px tall), and after copying it
    says "Copied" and the first apply step in the margin is marked as next.
    Download and Share link stay secondary. The step bar marks step 04 like
    any other step; no extra colour.

## 5. Workstreams

Each workstream lists what it owns. A file belongs to exactly one workstream
at a time; if you need a change in a file another workstream owns, say so in
your report instead of editing it.

### WS0. Foundations: tokens, fonts, theme (blocks everything else)

Read first: Design.md §7 (dark mode, contrast floors, focus rings, accent
colour), §10, `src/ui/theme.js`, `tailwind.config.js`, `src/assets/main.css`,
`src/ui/charts/palette.js`.

Owns: `tailwind.config.js`, `src/ui/theme.js` and its tests,
`src/assets/main.css`, `src/ui/charts/palette.js` and its tests, the font files,
`index.html` (body classes, `theme-color`), the inline styles in
`scripts/generate-static-routes.mjs`.

Tasks:

- Add the semantic tokens from §3 as CSS variables (light on `:root`, dark
  under `prefers-color-scheme: dark`) and expose them as Tailwind colours
  (`paper`, `ink`, `ink-2`, `quiet`, `rule`, `fit`, `mine`, ...).
- **Keep the existing slate/sky mapping working** during the migration, so
  components that aren't restyled yet still render. Remove the old families
  only in WS8, once nothing uses them (a source scan test can enforce that).
- Self-host the fonts (decision 1) and set `fontFamily.sans` and
  `fontFamily.mono`.
- Focus rings: 2px `ink` outline, offset 2px, square (drop the 0.25rem
  radius). Re-check `surface-inverse` and `focus-inset`; dark-by-design
  surfaces mostly disappear in this design, so remove what is no longer used.
- Chart palette: map the tones to the new tokens (`ink` for the main series,
  `quiet` and `rule` for context, `fit` for the profile default line, `mine`
  for the user's value, `error` for danger). Keep the "name a tone, never a
  hex" rule.
- `theme-color`: one meta per scheme (`media="(prefers-color-scheme: dark)"`).
- The pre-render inline CSS in `generate-static-routes.mjs` uses the new
  paper and ink values and the system font stack (no webfont before the app
  loads).
- Measure every text and mark pair in both schemes in `theme.test.js`.

Done when: the app builds, nothing visibly breaks, the new tokens and fonts
are available, and contrast tests pass for every token pair.

### WS1. Site shell: header, footer, icons

Read first: Design.md §7 (header nav scrolling, targets), `SiteHeader.vue`
and its test, `SiteFooter.vue`, `scripts/generate-icons.mjs`.

Owns: `src/ui/layout/*`, `public/favicon.svg`, `public/logo.svg`,
`public/og-image.svg`, `scripts/generate-icons.mjs` output.

Tasks:

- Header: tick logo plus "linux-tuners.dev", a small nav and one primary
  "Start setup" button. Keep the scrolling tuner nav behaviour on tuner pages
  (it may become quieter, but every live tuner stays reachable in one click
  and the current page stays marked with `aria-current`). Update
  `--site-header-h` in `main.css` via WS0 if the height changes.
- Footer: the author note and colophon (decision 3), then Glossary, Privacy,
  Imprint, Source on GitHub. Google's CMP keeps injecting its own link; don't
  add a consent banner (CLAUDE.md).
- New favicon, logo and OG image from the tick motif; run `npm run gen:icons`.

### WS2. Landing page

Read first: Design.md §5 "Guided setup" and "Routes, SEO and build",
`src/views/LandingView.vue` and its test, `src/static/pages.js`
(`landingDoc`), `src/core/machineRoles.js`, `src/tuners/registry.js`.

Owns: `src/views/LandingView.vue` and its test, `landingDoc` in
`src/static/pages.js` and its tests, the new registry field (decision 5) and
`registry.test.js`.

Depends on: WS0, WS1, and WS3's slider and marks for the live specimen.

Sections, in order (see `FinalLanding.dc.html`):

1. **Hero.** Left: the h1 "Understand every setting before you change it.",
   one paragraph, primary "Pick your machine type" (scrolls to the role
   picker), secondary "Browse tuners", a quiet line "Free. Runs in your
   browser. Nothing is sent anywhere." Right: the live specimen, a real
   setting in column-and-margin form (decision 4). It reuses the real
   `SliderControl` and the marks from WS3, reads its def from the swap domain
   (lazy-loaded, so the landing chunk stays small) and computes its numbers
   from data. It never writes to any tuner's store or the URL.
2. **The key.** One row explaining the three marks.
3. **Why.** Short heading and paragraph (the old "Why this exists" text,
   tightened), next to a two-column comparison: a forum value versus this
   site's annotated value.
4. **Start.** "What is this machine for?" Role list as hairline radio rows
   (`role="radiogroup"`, `aria-checked`, arrow keys) beside the numbered route
   for the picked role, with a "Start guided setup" button in the route's
   header row (§4 decision 6, not below the route as in the mockup) that
   opens `/setup` with the role, and "Usually fine to leave" for optional
   tuners below the route. Check at 1280x800 and 375px that the button is in
   view whenever the selected role is, for every role. Keep the
   `?role=` query behaviour, `isMachineRole` and `tunersForRole` exactly as
   Design.md §5 describes, including "no role" showing every tuner.
5. **All tuners.** A hairline table: question (decision 5, links to the
   tuner), tuner name, number of settings, what it writes. All values come
   from the registry and domains, none hand-typed. Wide tables scroll inside
   their own box with `tabindex="0"` and an `aria-label` (Design.md §7). Below
   it, one quiet line naming the planned tuners from `PLANNED_TUNERS`.
6. **Ad slot**, below the tuner table, as today.

Also: update `landingDoc` so crawlers and no-JS readers get the same story
(hero sentence, the key, why, the role explanation, every tuner with its
question and link). It stays built from definitions only.

### WS3. Parameter card and controls

Read first: Design.md §4, §5 "Range slider: uncontrolled with external sync",
§7 ("Three layers per parameter", "Essential and advanced", "Filter, changed
only and compact", "Where a value comes from"), `ParameterCard.vue` and its
tests, `src/ui/controls/*`, `descParts.js`, `GlossaryTerm.vue`.

Owns: `src/ui/ParameterCard.vue` and tests, `src/ui/controls/*`,
`src/ui/GlossaryTerm.vue`, `src/ui/RichText.vue` styling.

Depends on: WS0.

Tasks:

- **Card layout = column and margin.** Column: title (20px), sysctl name in
  mono, the value large in mono with its mark colour and underline, the
  control, `shortDesc`. Margin: up to three numbered notes (§4 decision 9) built from today's layers (the
  `longDesc` parts, rule of thumb, context note, the default line), a
  derivation line where the domain has one, and the source link. The "Learn
  more" disclosure and the drawer keep their roles from §7 "Three layers";
  what moves is where the beginner layer sits. Keep the card's height stable
  while dragging (§7).
- **Slider as a ruler.** Printed scale: major ticks with numbers in mono,
  minor ticks, the kernel-default tick and the fits-your-machine bar on the
  scale, a thumb that looks draggable (§4 decision 8). **Keep it uncontrolled**: don't bind `:value` on the
  range input (CLAUDE.md, Design.md §5). Zones stay a list, not labels on the
  track (§7 explains why).
- **States.** Fits your machine (`fit` value colour and underline); changed by
  you (`mine` dot on the scale, `mine-text` value, a margin note "You moved
  this from X to Y", a "Back to X" secondary button replacing today's Reset);
  warning (`mine-text` note with icon); blocking error (`error` 1px frame or
  rule, message and the fix inline).
- **Compact view.** One hairline row per setting: title and name, the scale,
  the value. The margin notes are hidden; the drawer keeps the reference.
- **Phone.** Below the margin breakpoint, notes become `[n]` toggle buttons
  (real `<button>`, `aria-expanded`, `aria-controls`, at least 44px target)
  that open the note in place.
- Restyle `ToggleControl`, `SegmentedControl` (square, hairline, selected =
  `ink` fill or `fit-tint`), `SelectControl`, `TupleControl` to match.
- Glossary terms: dotted underline in `ink-2`, definition opens on its own line
  as today, styled like a margin note.

### WS4. Tuner page

Read first: Design.md §4, §7 (mobile impact bar, step chain, tablists,
drawers, charts), `TunerPage.vue`, `ParameterPanel.vue`, `GraphPanel.vue`,
`ConfigOutput.vue`, `InstallSteps.vue`, `PresetSelector.vue`,
`NeedThisBox.vue`, `InfoDrawer.vue`, `UndoToast.vue`, `MobileImpactBar.vue`,
`AboutSection.vue`, `StepHeader.vue`, `src/ui/profile/*`, and all their tests.

Owns: those files and their tests.

Depends on: WS0, WS3.

Tasks (see `FinalTuner.dc.html`):

- **Title block** replaces the dark gradient hero: breadcrumb, h1, one-line
  purpose, and a "Tuning for" line with the profile summary in mono and an
  "Edit machine" text button. No `light-palette` / `surface-inverse` needed
  any more.
- **Steps on a scale.** The "Jump to" chain becomes a row of segments on a
  line: done steps in `rule-strong`, the current one a thick `fit` segment with
  `aria-current`. Keep `useScrollSpy`, the sticky behaviour from `lg` up and the
  `--step-chain-h` offsets (update the measured value via WS0).
- **Groups.** `ParameterPanel` sections become groups: an `ink` rule, the group
  headline, the marks key on the right. "Show N advanced" and collapsed groups
  are full-width hairline rows with a mono `+`, a summary line ("5 settings.
  All fit your machine.") and an issue count in `mine-text` or `error`.
  Pro tools (filter, changed only, compact, show all) keep their behaviour
  and get the quieter styling.
- **Graphs.** `GraphPanel` keeps its tabs, keyboard handling and `ChartFrame`
  labels; restyle as a hairline panel. Placement follows §4 decision 7
  (sticky column from `lg` up, visible by default; the mockup's inline
  "Show the graph" is dropped). The `MobileImpactBar` stays (§7) and gets
  the new styling.
- **Profile form, presets, NeedThisBox, About**: same behaviour, hairline
  styling, square controls, `fit-tint` for the selected preset.
- **Export** (§4 decision 10): the file in the column (Copy as primary
  button, Download and Share link as secondary), `InstallSteps` in the margin as numbered notes,
  undo set apart. Changed lines in the preview may carry the `mine-text`
  colour; the copied text stays exactly what `generateConfig` writes.
- **Drawer and toast**: square, hairline, `paper` surfaces, focus trapping
  and Escape unchanged.

### WS5. Guided setup

Read first: Design.md §5 "Guided setup", `src/setup/*` and tests.

Owns: `src/setup/*.vue` and their tests.

Depends on: WS3, WS4 (it reuses the tuner components).

Tasks: restyle the step list as segments on a scale (skipped, blocked and
issue states via marks and text, not colour alone), the machine profile as
hairline rows, Back and Next as primary and secondary buttons, the files step
like the tuner export. Behaviour, focus moves and step order stay unchanged.

### WS6. Reactive margin notes (follow-up, after the redesign ships)

Read first: Design.md §3, §9 (reuse ladder, extension points, contract
tests), `src/core/types.js`, `src/core/defineTuner.js`, a few domains' defs.

Owns: new def fields, the contract tests for them, the note rendering in the
card (coordinate with WS3).

Tasks:

- Give zones an optional plain-text `note` (`{ label, min, max, note }`), so
  the margin note for the current zone can change as the value moves. Data
  first: no tuner-specific code in the card.
- Optionally let a domain explain a derived default in one line ("database,
  64 GiB, swap on NVMe, so 10"), built from the profile's option labels.
- Contract tests: every note is plain text, has no em dash, and every zone
  that has a note also has bounds.
- Notes update in an `aria-live="polite"` region, debounced like
  `IssueAnnouncer` so a drag doesn't chatter.

### WS7. Legal pages and static text

Read first: Design.md §5 "Routes, SEO and build", `DatenschutzView.vue`,
`ImpressumView.vue`, the `.static-doc` rules in `main.css` (through WS0).

Owns: the two legal views.

Tasks: typographic restyle only (Host Grotesk, hairlines, 16 to 17px body,
comfortable measure). No change to legal wording; if the font decision
changes what the privacy policy must say, that is a separate, maintainer-led
change with the "Last updated" bump.

### WS8. Integration, accessibility and docs (last)

Owns: Design.md, TODO.md, removal of the old colour families, this file.

Tasks:

- Remove the old slate/sky mapping once a source scan shows no class uses it;
  add a test that fails on the old families.
- Rerun the browser accessibility pass from Design.md §7 ("Automated sweep"):
  axe in a real browser over the built site, both schemes, 1280 and 375px,
  every layer open, focus rings checked on every surface.
- Measure contrast for every text and mark pair actually used.
- Grep displayed text for em dashes.
- Update Design.md: §7 (replace "One accent colour, sky", the contrast floors,
  dark mode, the card layers and "Where a value comes from" with the new
  system), §5 "Guided setup" (new landing structure), §8 if copy rules
  changed, §10 for the font decision. Then delete this file.

## 6. Order and parallelism

```
WS0 foundations
 ├─> WS1 shell ─────────────┐
 ├─> WS3 card + controls ───┼─> WS2 landing
 │        └─> WS4 tuner page ──> WS5 setup
 │        └─> WS6 reactive notes (follow-up)
 └─> WS7 legal pages
                                 all ─> WS8 integration
```

- WS0 runs alone and lands first.
- Then WS1, WS3 and WS7 can run at the same time (no shared files).
- WS2 starts when WS1 and WS3 have landed. WS4 starts when WS3 has landed.
- WS5 after WS4. WS6 is a follow-up after the redesign ships (decision 2).
- WS8 last.

## 7. Rules for every agent

- **Work on a branch in its own worktree**, named `redesign/ws<N>-<slug>`.
  Never commit to or push `main`: every push to `main` deploys to production.
  Don't push at all unless the maintainer asks.
- **Stay inside the files your workstream owns.** Need something elsewhere?
  Write it in your report.
- **Behaviour doesn't change unless your workstream says so.** This is a
  visual and structural redesign. Store logic, serialization, `restoreState`,
  output writers, validation and the contract suite keep their behaviour.
  Shared-link state stays untrusted input (Design.md §5).
- **Everything shown comes from definitions.** No hand-typed setting counts,
  defaults or derived values in components. Reuse before writing (Design.md
  §9): data first, then shared code, and never branch on a tuner id in shared
  code.
- **Accessibility guardrails from Design.md §7 still hold**: real buttons with
  `aria-expanded`, radiogroups with arrow keys, tablists with roving tabindex,
  focus-trapping drawers, chart `aria-label`s, the mobile impact bar, no
  sideways page scroll down to 320px, targets of at least 24px (44px for the
  new primary touch targets).
- **No em dashes in displayed text.**
- **No new third-party request, cookie or storage key** (Design.md §10). The
  fonts are self-hosted (§4 decision 1).
- **Before you report done**: `npm test` and `npm run build` pass, and you have
  looked at your pages in `npm run dev` in both colour schemes at desktop and
  phone width. Say what you checked and what you didn't.
- **Commits** happen after the security audit in Design.md §10 (tests and
  build, `npm audit --omit=dev`, the rules checklist, `/security-review` on the
  diff). If you are not the agent asked to commit, leave the branch ready and
  report the audit result.

## 8. Prompt template for an agent

```
You are implementing workstream WS<N> (<name>) of the linux-tuners.dev
redesign "Scale". Read CLAUDE.md, then REDESIGN.md (all of §3 and §7, and
your workstream in §5), then the Design.md sections your workstream lists.
The mockups are on the claude.ai canvas named in REDESIGN.md §2; read
<artboard path> with the Artifact tool if you can.

Work in a git worktree on branch redesign/ws<N>-<slug>. Only edit the files
your workstream owns. Don't push. When done, run npm test and npm run build,
check your pages in both colour schemes at 1280px and 375px, and report:
what you changed, what you checked, anything you needed from another
workstream, and any open question for the maintainer.
```

## 9. Definition of done

- Every page (landing, nine tuners, `/setup`, legal pages, 404) uses the new
  tokens, fonts and layout, in both schemes, from 320px up.
- The old slate/sky colour mapping is gone and a test keeps it gone.
- `npm test`, `npm run build` and the browser accessibility pass are clean;
  every text pair meets 4.5:1 and every mark 3:1 in both schemes.
- The static (no-JS) text and `llms.txt` tell the same story as the new
  landing page.
- Design.md describes the new system; TODO.md has no redesign leftovers; this
  file is deleted.
