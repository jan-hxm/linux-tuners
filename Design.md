# linux-tuners.dev: design

How the project is meant to work and why. This is the single source for scope,
architecture and conventions. Open work lives in [TODO.md](TODO.md); when an item
there is finished, its outcome is written into this file and the item is deleted.

## 1. Purpose

Interactive, hardware-aware tuners for Linux system configuration. The user
describes their machine and workload, gets defaults derived from that profile,
adjusts them with sliders while live graphs show the effect, and copies a
ready-to-apply config file with citations to the source documentation.

Audience: operators and developers who know *what* a setting is called but not
what value suits their hardware, and want to understand the trade-off rather
than paste a value from a forum.

## 2. Scope

**In scope:** settings that apply to a running system without a reboot.

- The `sysctl` tree (`/proc/sys/`)
- Key sysfs runtime tunables (THP, block I/O queue, cpufreq)
- systemd resource control (manager defaults and cgroup v2 slice controls)

Tuners are grouped as **curated topics**: things an operator tunes together.
They are not one tuner per `/proc/sys` root. For example, hardening keys from
`kernel`, `net` and `fs` all belong to one Security tuner.

### Shipped tuners

| Route | Covers | Output |
|---|---|---|
| `/swap` | 11 `vm.*` parameters: swappiness, `min_free_kbytes`, watermark scaling, `vfs_cache_pressure`, dirty-page writeback, overcommit, `panic_on_oom`. Graphs: swap pressure, watermark zones, dirty writeback. | `/etc/sysctl.d/99-swap-tuning.conf`, plus device-aware swap setup instructions (swap file, zram-generator, zswap) |
| `/systemd` | Manager defaults (accounting, `DefaultTasksMax`, `DefaultLimitNOFILE`, `DefaultLimitMEMLOCK`) and per-slice controls (`CPUWeight`, `CPUQuota`, `MemoryHigh`, `MemoryMax`, `MemorySwapMax`, `IOWeight`, `TasksMax`) for `system.slice`, `user.slice` or `machine.slice`. Graphs: CPU shares, memory budget, task and FD caps. | Two drop-ins in one document: `/etc/systemd/system.conf.d/99-resource-tuning.conf` and `/etc/systemd/system/<slice>.d/50-resources.conf` |

The planned tuners and their order are listed in [TODO.md](TODO.md).

### Non-goals

- **Boot-time kernel command line / GRUB** (`mitigations=`, `isolcpus=`, …). These need a reboot and a different apply model.
- **Application config** such as `sshd_config`. The answers there are opinion-driven rather than hardware-driven.
- **PAM `limits.conf`**. It doesn't apply to systemd services, and systemd's `DefaultLimit*` already covers the case.
- **i18n.** The site is English-only, including the legal pages.
- **User accounts / saved configs.** URL-encoded state already covers sharing and bookmarking. Accounts would add a backend, auth and GDPR scope for little value.
- **Importing live kernel metrics.** That would need a browser extension or a local agent, which doesn't fit a static site.
- **A PSI (Pressure Stall Information) graph.** It's too complex to model honestly.

## 3. Product principles

1. **Defaults come from sources.** Kernel and systemd defaults and ranges are
   quoted from kernel.org and the systemd man pages. Workload-specific starting
   points are labelled as opinionated, and each parameter links its source.
2. **Graphs are teaching models, not predictions.** They show the *shape* of a
   trade-off using the same formulas the kernel uses where possible, and say so
   in the UI.
3. **The output is the product.** What the textarea shows is exactly what gets
   copied: commented, dated, with the profile, the apply commands and the
   sources. Every value it emits must be one the kernel or systemd accepts.
4. **Validation has two levels.** *Blocking* issues hide the output, and are
   reserved for settings that the kernel or systemd rejects or that are clearly
   broken (for example `dirty_background_ratio >= dirty_ratio`, or a soft rlimit
   above its hard limit). Everything that is odd but legal is a warning or an
   info note.
5. **No silent no-ops.** If systemd or the kernel ignores a value, the slider
   doesn't offer it. For example `CPUQuota=0%` and `MemoryMax=0%` are ignored
   by systemd (meaning "no limit"), so `CPUQuota` starts at 10% and the memory
   limits start at 1%. `MemorySwapMax=0` is valid and stays available.
6. **Static and private by default.** There is no backend and no cookies of
   our own. State lives in the URL hash, which is never sent to the server.

## 4. Anatomy of a tuner

Every tuner follows the same flow:

1. **Profile form**: hardware and workload (RAM, swap device, cores, `pid_max`, …)
2. **Derived defaults**: `deriveDefaults(profile)`
3. **Presets**: partial value sets layered over the derived defaults. Applying
   a preset first resets to the defaults, so parameters the preset doesn't
   mention return to their default.
4. **Parameter cards**: a slider or toggle, click-to-edit exact value,
   layered descriptions (short, long, tuning tip, zones) and a reference drawer
   with a formula where one helps
5. **Validation**: issues shown inline on the affected cards
6. **Live simulation**: a tabbed `GraphPanel` plus impact cards
7. **Config output**: copy, download, share URL, reset

## 5. Architecture

### Stack

Vue 3 + **plain JavaScript** (no TypeScript; shapes are JSDoc `@typedef`s),
`<script setup>`, Pinia, vue-router, Tailwind CSS, Chart.js via vue-chartjs
(registered once in `src/charts/chartSetup.js`), lz-string for URL state.
Tests use Vitest + @vue/test-utils. Component and composable tests run in
happy-dom; model code runs in node.

### Domain modules behind a shared store and UI

Everything specific to one tuner lives in a **domain module**
(`src/domains/<tuner>/index.js`) implementing the `TunerDomain` contract in
`src/domains/types.js`: parameter defs, presets, `deriveDefaults`, `rangeFor`,
`validate`, `generateConfig`, `formatValue`, sections, drawer formulas,
serialization and context notes.

- **Store factory**: `defineTunerStore(id, domain)` in
  `src/stores/createTunerStore.js` builds a generic Pinia store (hardware,
  params, preset, tab, drawer) and delegates the domain-specific work to the
  domain module.
- **Shared components** (`ParameterCard`, `ParameterPanel`, `PresetSelector`,
  `ConfigOutput`, `InfoDrawer`, `GraphPanel`) get the store and domain through
  `useActiveTuner()` / `useTunerDomain()`. A tuner **view** `provide()`s both.
  The inject falls back to the swap tuner, so isolated component tests need no
  wrapper. A view can't `inject()` what it `provide()`s itself, so view-level
  composables take the store as an argument.
- **Profile forms** are per-tuner (their fields differ), but they share the
  number-plus-quick-pick widget `src/components/hardware/NumberPickField.vue`
  and the pick lists, ceilings and clamping in `fieldOptions.js`. RAM uses one
  shared `RAM_PICKS` list so the tuners never drift apart.
- **Naming:** the swap tuner predates the abstraction and keeps unprefixed
  names (`src/model/*.js`, `HardwareForm.vue`). Newer tuners are namespaced
  (`src/model/systemd/`, `src/data/systemd/`, `src/components/systemd/`).

### Range slider: uncontrolled with external sync

`ParameterCard` deliberately does **not** bind `:value` on its
`<input type="range">`. A reactive `:value` cancels a Chromium drag mid-stroke
when the same input event triggers a re-render. Instead a `selfWrite` flag plus
a watcher push store changes to the DOM only when they come from outside the
slider (preset, profile change, URL restore).

### Shareable URL state

State is lz-string-compressed JSON in `location.hash`, written with a 200 ms
debounce. Because a shared link is untrusted input that ends up in a config
file someone may run as root, restoring it is strict:

- Envelope version must match; every parameter key must be present and finite.
- Profile fields are checked against a per-domain schema (enum lists, numeric
  ranges with a step, or a strict pattern), so a link can't inject lines into
  the generated config. Numeric fields snap to the step the form produces.
- Parameters are rounded to integers and clamped to the slider range.
- Unknown preset ids are dropped (preset maps are plain objects, so inherited
  names like `toString` must not resolve). An unknown tab falls back to the
  first tab.
- Hash writes preserve `history.state` (Vue Router keeps scroll and position
  data there) and are skipped if the user has navigated to another route since.

### Routes, SEO and build

Route metadata is single-sourced in `src/routes-meta.js`. The router applies
the head tags client-side, and `npm run build` runs a postbuild step
(`scripts/generate-static-routes.mjs`) that writes `dist/<route>/index.html`
with the route's title, OG/Twitter tags, JSON-LD and canonical URL baked in,
plus `sitemap.xml`. Crawlers that don't run JavaScript therefore see the
correct link previews.

### Ads and consent

Ads use Google AdSense, and consent is handled by **Google's IAB TCF-certified
CMP**, configured in the AdSense dashboard. A custom consent banner existed
earlier and was removed; reintroducing one would race with the CMP. `AdSlot`
renders the `<ins>` block only when the publisher ID and the slot ID are both
set. The IDs come from `VITE_ADSENSE_*` env vars baked in at build time (see
`.env.example`). Without them, production renders nothing and dev shows a
dashed placeholder.

### Hosting and deploy

Static site on Cloudflare Pages. GitHub Actions runs the tests and the build
on every push and PR, and deploys `main`. `public/_redirects` provides the SPA
fallback. `public/_headers` sets frame blocking, `base-uri`, `object-src` and a
Permissions-Policy. There is deliberately no `script-src` CSP, because AdSense
and the CMP load from a changing set of Google domains.

## 6. Adding a tuner

1. Domain module `src/domains/<name>/index.js`, with namespaced model, data and
   components (`src/model/<name>/`, `src/data/<name>/`, `src/components/<name>/`).
2. Store: `defineTunerStore('<name>', domain)` in `src/stores/<name>.js`.
3. A view that `provide()`s the store and domain, reuses the shared components
   and the profile-form widgets, and includes `MobileImpactBar` with its
   spacer (see section 7).
4. Route wiring: a `ROUTES_META` entry, a loader in `VIEW_LOADERS`
   (`src/router.js`), the landing card status in `LandingView.vue`, and the
   nav order in `SiteHeader.vue` if relevant.
5. **Don't add the route entry or an indexed page until the tuner works.**
   Ad networks and search engines treat "under construction" pages as thin
   content. Planned tuners appear only as "Coming soon" cards on the landing
   page.

## 7. UI/UX and accessibility conventions

These are settled decisions from the UI/UX and accessibility audit. New UI
must follow them, and existing UI must not regress.

- **The live simulation must stay usable on mobile.** `GraphPanel` sits beside
  the parameters only at `lg+`. Below that, views render `MobileImpactBar` (a
  `lg:hidden` fixed bottom bar fed the same `impact` array) plus a
  `h-16 lg:hidden` spacer.
- **Every disclosure or toggle is a real `<button>`** with `aria-expanded` and
  `aria-controls`. Never put click handlers on bare `<div>` or `<header>`
  elements.
- **Tablists need roving tabindex *and* arrow-key handling**
  (Left/Right/Home/End), as in `GraphPanel`'s `onTabKeydown`.
- **Modals and drawers trap focus, close on Escape, and restore focus to the
  element that opened them** (`InfoDrawer`). `aria-modal` alone doesn't trap
  focus.
- **Canvas charts get `role="img"`** and a reactive plain-language
  `aria-label` summary. The visible legend isn't an alternative for assistive
  technology.
- **No global keyboard shortcuts that clash with the browser.** For example,
  the old `Ctrl+Shift+C` copy binding overrode devtools.
- **Type size and contrast floors:** meaningful text is at least `text-xs`
  (12px) and at least `text-slate-500` on white. `text-[10px]`/`text-[11px]`
  and `text-slate-400` are only for decorative chrome (status pills, the
  `.dev` logo tail, hero eyebrows on dark backgrounds).
- **Segmented or radio-style button groups** use `role="radiogroup"` plus
  `role="radio"` and `aria-checked` on each option.
- **Profile forms auto-collapse only after the first apply.** Re-tuning after
  "Edit" keeps the form open.
- **Copy and share feedback** changes the button state and announces the
  result through an `aria-live="polite"` region.
- **Reset needs no confirmation.** It only recomputes the defaults. A reset
  control sits at the top of the tuning panel as well as in the export section.

## 8. Copy conventions

- **No em dashes in displayed text.** This covers parameter descriptions,
  presets, validation messages, templates, labels, chart captions, and the
  generated config. Use a comma, colon, semicolon or parentheses instead. En
  dashes in numeric ranges (`0–200`) are fine. Code comments and docs are
  exempt.
- The site, including the legal pages, is in English. Statute references keep
  their German citation form: `§ 5 TMG`, `Art. 6 (1) (f) GDPR`,
  `§ 25 (2) (2) TTDSG`. Any material change to the privacy policy bumps its
  "Last updated" line.

## 9. Code organization and reuse

> **Status: draft guideline.** It describes the target structure. Today's code
> partly follows it; the migration steps are in [TODO.md](TODO.md) §4. Until a
> step lands, the current structure in §5 and §6 stays authoritative for that
> area.

**Goal:** adding a tuner touches its own folder plus one registry entry. Most
of the effort should go into *data* (parameter defs, presets, docs and copy),
not plumbing. Two tuners are shipped and about eight are planned, so anything
written twice gets written ten times. Duplication is the main risk.

### Layers and dependency direction

```
src/
  core/        pure JS, no Vue: store factory, serialization, value types,
               validation helpers, config writers, formatting
  ui/          shared Vue: TunerPage shell, ParameterCard + controls,
               profile-form widgets, chart kit, ConfigOutput, InfoDrawer, …
  tuners/
    registry.js   the list of tuners (see "Registry" below)
    <id>/         everything specific to one tuner
  views/       non-tuner pages (landing, legal)
```

- `tuners/<id>` may import `core` and `ui`.
- `ui` may import `core`.
- `core` and `ui` never import a tuner.
- Tuners never import each other. When two tuners need the same thing,
  promote it to `core`/`ui`.
- Enforced by a Vitest test that scans import statements, since the project
  has no ESLint.

### Tuner folder

```
src/tuners/<id>/
  index.js         defineTuner({...}): domain module + registry metadata
  profile.js       profile fields, defaults and restore schema (one list)
  defs.js          parameter defs
  presets.js
  calculations.js  deriveDefaults, rangeFor
  validation.js    cross-parameter rules only (per-value checks are generic)
  config.js        generateConfig built from core/output writers
  simulation.js    optional, pure functions for the graphs
  about.js         about/methodology/sources/disclaimer content as data
  components/      tuner-only charts or widgets
  *.test.js        tests for this tuner's own math only (see "Contract tests")
```

The view is generated from the shared `TunerPage` shell. A tuner gets its own
`View.vue` only if the shell's slots genuinely can't express the page.

### The reuse ladder

Before writing new code for a tuner, take the first rung that works:

1. **Data.** Can it be a def field, preset, profile field or about entry?
   Then it's data, not code.
2. **Configure shared code.** Add a def field, prop or slot to a shared
   component, or a hook to the domain contract.
3. **Tuner-local.** Put it in `tuners/<id>/components/` (or the tuner's model
   files).
4. **Promote.** When a second tuner needs it, move it to `ui/` or `core/` and
   generalize it. Never copy it between tuners.

Shared code never branches on a tuner (`if (domain.id === 'swap')`). Express the
difference as a def field or an optional domain hook with a default.

### Extension points

These are the seams where tuners differ. Each one is a registry or a contract,
so that a new variant is an addition rather than an edit to shared code.

- **Value types** (`core/valueTypes.js`). Params are integers today
  (`restoreState` rounds everything), but planned tuners need more: enums of
  strings (`tcp_congestion_control`, the I/O `scheduler`) and tuples
  (`tcp_rmem`, `kernel.sem`). A def declares `type` (`int` is the default,
  then `bool`, `enum`, `tuple`). The type owns four operations:
  - `restore`: strict parsing of untrusted URL input; enums accept only listed
    values.
  - `clamp`
  - `format`: the display text and the emitted text.
  - `equals`: used for the preset diff and the "customised" flag.

  `restoreState`, the preset logic and the config writers call the type and
  never assume a number. This keeps the
  [untrusted-input rule](#shareable-url-state) in one place as types are added.
- **Controls** (`ui/controls/`). `def.control` names a control component
  (`slider`, `toggle`, `segmented`, and later `select` and `tuple`) through a
  registry. `ParameterCard` keeps the frame: header, badges, issues and the
  expandable text. Only the input is swapped. The slider keeps its
  [uncontrolled pattern](#range-slider-uncontrolled-with-external-sync) inside
  its own component. Extracting the controls also splits `ParameterCard`
  (about 490 lines today).
- **Profile** (`profile.js`). One declarative field list (type, label, quick
  picks, min/max/step or enum) drives the generic `ProfileForm` *and* the
  restore schema, so the form and the URL validation can't drift apart.
  Shared pick lists such as `RAM_PICKS` stay in `ui/profile/fieldOptions.js`.
  A profile the field list can't express (e.g. Block I/O's per-device list)
  uses the `profile` slot of `TunerPage`.
- **Page shell** (`ui/TunerPage.vue`). Renders the hero, step chain, the four
  steps, ad slot, about section, info drawer, and the mobile impact bar with
  its spacer, from the tuner's metadata. It has slots for `profile`, `about`
  and extra steps. This removes about 100 duplicated lines per view and keeps
  the [§7](#7-uiux-and-accessibility-conventions) guardrails in one place.
- **Graphs are optional.** A tuner with no meaningful simulation passes no
  graph tabs. Security hardening is mostly a checklist, for example. The tune
  step then uses the full width and the impact bar is hidden. Charts render
  inside `ui/charts/ChartFrame.vue`, which takes a required `ariaLabel` and the
  height, and they take colours from `ui/charts/palette.js`. The palette also
  prepares for dark mode, since no hex values are scattered across chart files.
- **Simulation** binding. A tuner exports pure functions from
  `simulation.js`, and one generic `useTunerSimulation(store, simulation)`
  turns them into computeds. There are no per-tuner composables.
- **Config output** (`core/output/`). `generateConfig` returns a list of files,
  `{ path, content }[]`. `ConfigOutput` renders one or several and offers a
  download for each; systemd already emits two files in one string. Writers:
  - `sysctlFile`, plus a shared header block (title, date, profile, preset,
    apply steps, sources).
  - `iniDropIn` (systemd).
  - Later, `udevRule` and `tunedProfile` for the sysfs tuners.

  Every emitted value goes through its def's value type, so the
  "only values the kernel accepts" rule ([§3](#3-product-principles)) is
  enforced in one place.
- **sysctl tuners are mostly data.** Security, Network, FS, IPC and Kernel all
  write `/etc/sysctl.d/`. Each def's `sysctlName` and section order drive a
  generic `sysctlConfig(defs, sections)`, and per-value range checks are
  generic. Such a tuner writes only `deriveDefaults`, its cross-parameter
  rules, and whatever comment text needs the profile.

### Registry

`src/tuners/registry.js` is the one list of tuners. Each entry holds:

- `id`
- `path`
- `status`: `live` or `planned`
- nav order
- landing-card text
- route metadata

It must stay plain data with no Vue imports, because the postbuild script reads
it. The router, `routes-meta.js`, the landing cards, the header nav and the
sitemap all derive from it, which replaces the four manual edits in §6.

A `planned` entry renders only a "Coming soon" card and gets no route. That
makes the [no-thin-pages rule](#6-adding-a-tuner) mechanical rather than
something to remember. The lazy `import()` of each live tuner's page stays in
`router.js`, next to the registry. That keeps each tuner in its own chunk.

### Contract tests

`defineTuner()` fills in the defaults of optional hooks and, in dev and tests,
asserts that the required fields exist. One shared test suite then iterates
over **every** registered tuner and checks:

- Every key has a def with a docs URL, a description and a valid control/type.
- The derived defaults lie within `rangeFor` for the default profile and for
  each workload. Every preset names only known keys and in-range values.
- `encodeState` → `restoreState` round-trips. A tampered hash (out-of-range
  value, unknown preset, injected profile string) is rejected or clamped.
- The defaults and every preset generate a config with no blocking issues,
  and every emitted value comes from the def's type formatter.
- No displayed string (defs, presets, validation messages, about content, the
  generated config) contains an em dash ([§8](#8-copy-conventions)).
- Each live tuner's page mounts without console errors.

A new tuner gets this coverage for free. Its own `*.test.js` files cover only
its math and its cross-parameter rules.

### Guardrails

- A component over about 300 lines, or one that knows which tuner it's
  rendering, is due for a split.
- Long prose lives in data (`defs.js`, `about.js`), not in templates. Today the
  systemd About section is inlined in its view; that's the pattern to remove.
- Tuner ids are kebab-case and **permanent**: they key the Pinia store and the
  shared URL hash. The swap tuner keeps the store id `tuner` so existing links
  keep working.
- Treat each migration step as a refactor with no behaviour change:
  tests green, links still restore, and the generated config is byte-identical
  for the defaults and every preset. Snapshot it before the move to check.
