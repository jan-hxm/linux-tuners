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
(registered once in `src/ui/charts/chartSetup.js`), lz-string for URL state.
Tests use Vitest + @vue/test-utils. Tests under `src/ui/` and
`src/tuners/*/components/` run in happy-dom, as does any test that pins it with
a `// @vitest-environment happy-dom` comment; model code runs in node.

### Domain modules behind a shared store and UI

Everything specific to one tuner lives in its folder `src/tuners/<id>/`
(layout in §9), whose **domain module** `index.js` implements the
`TunerDomain` contract in `src/core/types.js`: parameter defs, presets, `deriveDefaults`, `rangeFor`,
`validate`, `generateConfig`, `formatValue`, sections, drawer formulas,
serialization and context notes. Each module is built with `defineTuner()`
(`src/core/defineTuner.js`), which fills in the optional hooks and asserts
the required fields in dev and tests, and is listed in `src/tuners/domains.js`
so the contract tests (§9) cover it.

- **Store factory**: `defineTunerStore(id, domain)` in
  `src/core/createTunerStore.js` builds a generic Pinia store (hardware,
  params, preset, tab, drawer) and delegates the domain-specific work to the
  domain module.
- **Shared components** (`ParameterCard`, `ParameterPanel`, `PresetSelector`,
  `ConfigOutput`, `InfoDrawer`, `GraphPanel`) get the store and domain through
  `useActiveTuner()` / `useTunerDomain()`. The page shell **`TunerPage`**
  `provide()`s both. There is no fallback, so a component test passes both
  keys through `global.provide`. The view sits above `TunerPage`, so it
  can't `inject()` them; view-level composables take the store as an argument.
- **Page shell:** a tuner view only passes configuration to
  `src/ui/TunerPage.vue`: store, domain, graph tabs, impact metrics,
  and its profile form in the `profile` slot. The shell renders the hero, step
  chain, the four steps, ad slot, `AboutSection`, `InfoDrawer` and the mobile
  impact bar. All page copy and the About content are data in
  `src/tuners/<id>/about.js` (`PAGE`, `ABOUT`), with a small inline markup
  (`` `code` ``, `**bold**`, `[label](https://…)`) rendered by `RichText.vue`
  from parsed segments, never as HTML. The About section is always visible
  (no collapse), since it's real content and counts toward page quality.
- **Profile forms** are per-tuner (their fields differ), but they share the
  number-plus-quick-pick widget `src/ui/profile/NumberPickField.vue`
  and the pick lists, ceilings and clamping in `fieldOptions.js`. RAM uses one
  shared `RAM_PICKS` list so the tuners never drift apart.

### Range slider: uncontrolled with external sync

`ui/controls/SliderControl.vue` deliberately does **not** bind `:value` on its
`<input type="range">`. A reactive `:value` cancels a Chromium drag mid-stroke
when the same input event triggers a re-render. Instead a `selfWrite` flag plus
a watcher push store changes to the DOM only when they come from outside the
slider (preset, profile change, URL restore, the card's click-to-type edit).

### Shareable URL state

State is lz-string-compressed JSON in `location.hash`, written with a 200 ms
debounce. Because a shared link is untrusted input that ends up in a config
file someone may run as root, restoring it is strict:

- Envelope version must match; every parameter key must be present and parse
  strictly as its def's value type (`core/valueTypes.js` `restore`).
- Profile fields are checked against a per-domain schema (enum lists, numeric
  ranges with a step, or a strict pattern), so a link can't inject lines into
  the generated config. Numeric fields snap to the step the form produces.
- Parameters are clamped by their value type: integers are rounded and held
  to the slider range, enums to their listed options. `setParam` uses the same
  clamp, so a typed `60.5` becomes `61`.
- Unknown preset ids are dropped (preset maps are plain objects, so inherited
  names like `toString` must not resolve). An unknown tab falls back to the
  first tab.
- Hash writes preserve `history.state` (Vue Router keeps scroll and position
  data there) and are skipped if the user has navigated to another route since.

### Routes, SEO and build

Route metadata is single-sourced in `src/routes-meta.js`, which lists the
landing and legal pages and takes each live tuner's route from the registry
(`src/tuners/registry.js`, see [§9 Registry](#registry)). The router applies
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

1. A folder `src/tuners/<name>/` laid out as in §9, with the domain module
   `index.js` built with `defineTuner()` and added to `TUNER_DOMAINS` in
   `src/tuners/domains.js`. The contract suite and the config snapshots then
   run over it; review the new snapshot file.
2. Store: `defineTunerStore('<name>', domain)` in `src/tuners/<name>/store.js`.
3. `about.js` with the page copy and About content, and a `View.vue` that
   renders `TunerPage` with its graph tabs, impact metrics and profile form
   (built from the shared profile-form widgets).
4. Registry entry in `src/tuners/registry.js` (landing-card text, nav label,
   route metadata) and a lazy loader in `TUNER_VIEWS` (`src/router.js`). The
   route, landing card, header nav and sitemap follow from it, and
   `src/tuners/registry.test.js` checks that the registry, domains and router
   agree.
5. **Don't add the route entry or an indexed page until the tuner works.**
   Ad networks and search engines treat "under construction" pages as thin
   content. Until then the entry stays `status: 'planned'`, which renders
   only a "Coming soon" card on the landing
   page.
6. Pass the security audit in [section 10](#10-security), including the
   hand-crafted hostile link, before the first commit of the tuner.

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
  `aria-label` summary: render them inside `ui/charts/ChartFrame.vue`, which
  requires the label. The visible legend isn't an alternative for assistive
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

> **Status: migrated**, apart from the gaps listed under "Tuner folder" (the
> generic profile form, per-tuner stores and views), which are open in
> [TODO.md](TODO.md) §4. Until those land, the current structure in §5 and §6
> stays authoritative for them.

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
- `core` and `ui` never import a tuner. The one exception is
  `tuners/registry.js`, which is plain data (the header nav reads it).
- `core` is plain JS: no `vue` import and no `.vue` files.
- Tuners never import each other. When two tuners need the same thing,
  promote it to `core`/`ui`.
- Enforced by `src/importBoundaries.test.js`, which scans import statements,
  since the project has no ESLint. Test files are exempt: shared-code tests
  mount real tuners as fixtures.

### Tuner folder

```
src/tuners/<id>/
  index.js         defineTuner({...}): the domain module
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

Where today's tuners still differ from this target: the profile lives in
`parameters.js` (keys, defaults and restore schema) until the generic
`ProfileForm` exists; each has its own `store.js` and `View.vue`; systemd
keeps a `formatting.js`. Shared tests that need more than one
tuner (`contract.test.js`, `configSnapshots.test.js`, `views.test.js`) sit in
`src/tuners/`.

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

- **Value types** (`core/valueTypes.js`). A def declares `type`: `int` (the
  default), `bool` (stored as 0/1), `enum` (one of `def.options[].value`, for
  `tcp_congestion_control` or the I/O `scheduler`) or `tuple` (`def.length`
  integers, for `tcp_rmem` or `kernel.sem`). Today's defs are `int` and
  `bool`. The type owns four operations:
  - `restore`: strict parsing of untrusted URL input; enums accept only listed
    values. `decodeState` rejects the link when it returns `undefined`.
  - `clamp`: used by `restoreState` and `setParam`.
  - `format`: the emitted text, which throws on a value of the wrong shape.
    The card's display text stays the tuner's `formatValue`.
  - `equals`: used by `differingKeys` for the preset diff, the "customised"
    flag and the card's "workload" badge.

  Serialization, the store, the preset logic and the config writers call the
  type and never assume a number. This keeps the
  [untrusted-input rule](#shareable-url-state) in one place as types are added.
- **Controls** (`ui/controls/`). `def.control` names an entry of the
  registry in `ui/controls/index.js`: `slider`, `toggle`, `segmented` and
  `select`, with `tuple` to come with the first tuple def. Each entry lists the
  value types it can edit (the contract suite checks every def against it) and
  whether the card offers click-to-type and prints the range. `ParameterCard`
  keeps the frame: header, badges, the value, issues and the expandable text.
  Only the input is swapped. Every control takes `def`, `value`, `range`,
  `labelId` and `valueText` and emits `update`; the store clamps the value by
  type. The slider keeps its
  [uncontrolled pattern](#range-slider-uncontrolled-with-external-sync) inside
  `SliderControl.vue`.
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
  height, and they take colours from `ui/charts/palette.js`. Simulations name
  a palette `tone` (such as `'danger'`) rather than a colour. The palette also
  prepares for dark mode, since no hex values are scattered across chart files;
  `palette.test.js` fails on a colour literal in a tuner's charts or
  `simulation.js`.
- **Simulation** binding. A tuner exports pure functions from
  `simulation.js`, and one generic `ui/useTunerSimulation(store, simulation)`
  turns them into computeds keyed by function name. Callers pass the module
  (`import * as simulation`): the view passes its own store, charts pass
  `useActiveTuner()`. There are no per-tuner composables.
- **Config output** (`core/output/`). `generateConfig` returns a list of files,
  `{ path, content }[]`, built with the writers:
  - `files.js`: `configFile(path, lines)` checks the path against the §10
    rule and trims trailing blank lines; `combineFiles` joins a list for the
    output panel.
  - `comments.js`: `commentLine` (refuses line breaks), rules, section
    headers, file banners, and the date and preset summary for the header
    block.
  - `sysctlFile.js`: `sysctlConfig` prints each value with its def's type,
    and `sysctlLine` holds it to plain space-separated tokens.
  - `iniDropIn.js` (systemd): `iniSection` and `iniDirective`, with values
    limited to plain tokens.
  - Later, `udevRule` and `tunedProfile` for the sysfs tuners.

  A writer throws rather than emit a malformed line, so a bad value fails the
  contract fuzz tests instead of reaching a file. Each file of a multi-file
  tuner opens with a `# =====` banner naming its path. `ConfigOutput` shows
  the files combined, and copy and download take that text; a download per
  file is not built yet. Every emitted value goes through its def's value
  type, so the "only values the kernel accepts" rule
  ([§3](#3-product-principles)) is enforced in one place. A writer that adds
  its own syntax around a value (systemd's `50%`, `yes`) starts from
  `formatParams`.
- **sysctl tuners are mostly data.** Security, Network, FS, IPC and Kernel all
  write `/etc/sysctl.d/`. Each def's `sysctlName`, its `group` and the section
  order drive the generic
  `sysctlConfig({ defs, sections, params, comment, include })`, and per-value
  range checks are generic. Such a tuner writes only `deriveDefaults`, its cross-parameter
  rules, and whatever comment text needs the profile.

### Registry

`src/tuners/registry.js` is the one list of tuners. Each entry holds:

- `id`
- `status`: `live` or `planned`
- landing-card text (`title`, `blurb`, `keys`)
- for live entries: `path` (`/<id>`), `navLabel` and `route` metadata

Array order is the landing and nav order. It must stay plain data with no Vue
or `@/` imports, because the postbuild script reads it under Node. The router,
`routes-meta.js`, the landing cards, the header nav and the sitemap all derive
from it. `registry.test.js` checks the shape and that the live ids match
`TUNER_DOMAINS` and `TUNER_VIEWS`.

A `planned` entry renders only a "Coming soon" card and gets no route. That
makes the [no-thin-pages rule](#6-adding-a-tuner) mechanical rather than
something to remember. The lazy `import()` of each live tuner's page stays in
`router.js` (`TUNER_VIEWS`, keyed by id), next to the registry. That keeps each tuner in its own chunk.

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

The suite is `src/tuners/contract.test.js`, next to
`src/tuners/configSnapshots.test.js`, which snapshots the config for every
profile's defaults and every preset so each migration step can prove
byte-identical output. The page-mount check is `src/tuners/views.test.js`.
The type-formatter check covers sysctl lines; ini values are composed by the
tuner from typed values and held to plain tokens by the grammar check.
`src/ui/ParameterCard.enum.test.js` covers the enum path (select, clamp,
restore) with a fixture domain until a tuner ships an enum.

### Guardrails

- A component over about 300 lines, or one that knows which tuner it's
  rendering, is due for a split.
- Long prose lives in data (`defs.js`, `about.js`), not in templates.
- Tuner ids are kebab-case and **permanent**: they key the Pinia store and the
  shared URL hash. The swap tuner keeps the store id `tuner` so existing links
  keep working.
- Treat each migration step as a refactor with no behaviour change:
  tests green, links still restore, and the generated config is byte-identical
  for the defaults and every preset. Snapshot it before the move to check.

## 10. Security

**Rule: no change is committed until it has passed the security audit below.**
Every push to `main` is a release, and what we ship is a file people run as
root. Open findings and their details go in the local `PRIVATE.md`, never in
tracked files, commit messages, PRs or issues.

### Threat model

There is no backend, so the risks are on the visitor's side:

1. **Config injection (highest).** A shared link is attacker-controlled. If any
   part of it reaches the generated output other than as a validated value,
   the attacker writes into a file the victim installs as root. In sysctl.d
   that means arbitrary sysctls; in the planned udev rules, tuned profiles and
   systemd drop-ins it means command execution (`RUN+=`, `[script]`, `Exec*`).
2. **Script injection in the page.** Hash state, profile strings or
   third-party content rendered as HTML or followed as a URL.
3. **Supply chain.** npm dependencies, GitHub Actions (the deploy job holds the
   Cloudflare token) and third-party scripts (AdSense and the CMP, the only
   ones allowed).
4. **Privacy regressions.** Principle 6 (§3): state stays in the hash. A new
   request, cookie or storage key that carries it breaks the promise and the
   privacy policy.
5. **Leaks.** Secrets or `PRIVATE.md` content in the repo or the bundle.
   `VITE_*` values are public by construction, so only public IDs go there.

### Rules for code that produces output

These hold for every tuner and every output writer (§9 `core/output`):

- **Output is built from definitions, never from state.** Keys, section
  names, file paths and apply commands come from the tuner's code. State only
  supplies *values*, and only after `restoreState` has typed, clamped and
  checked them against the def.
- **Values are typed, not strings.** Numbers are finite integers within the
  range, enums are members of a fixed list, and free text only matches a strict
  pattern with no newlines, quotes, `#`, `;`, `=`, `|`, `$`, backslashes or
  path separators. The writer formats the value itself; it never passes a raw
  string through.
- **No executable directives, ever.** The output never contains settings that
  run programs: udev `RUN`/`PROGRAM`/`IMPORT{program}`, tuned `[script]` or
  `script=`, systemd `Exec*`, or sysctls that name a program
  (`kernel.core_pattern`, `kernel.modprobe`, `kernel.poweroff_cmd`, ...). This
  is a non-goal, not a feature request. A tuner that seems to need one is
  out of scope.
- **Paths are constants.** Output file paths and download names are fixed per
  tuner, match `^/etc/[a-z0-9._/-]+$` and contain no `..`. Apply commands are
  fixed text with only those paths interpolated.
- **Shared-link restore stays strict** (§5 Shareable URL state). A change that
  relaxes a schema, a range or the preset-id check is a security change.

### Rules for the page, the build and the deploy

- No `v-html`, `innerHTML`, `eval`, `new Function`, or `href`/`src` bound to
  state. External links are literals in data files.
- No new network request, cookie, storage key or third-party origin (script,
  style, font, frame) without a Design.md decision and a privacy policy update.
- `public/_headers` only gets stricter. The missing `script-src` CSP is the
  one accepted trade-off (§5 Hosting and deploy).
- New dependencies need a reason a few lines of our own code can't cover.
  Check maintenance, install scripts and transitive weight; `package-lock.json`
  is committed with the change.
- Workflows keep least-privilege `permissions`. Secrets are referenced only
  in the step that needs them and are never echoed. Third-party actions are
  pinned to a commit SHA.

### The audit

**Scope.** Every change except pure docs (`*.md`) and test-only changes.
That includes copy in generated config, data files, `scripts/`, `public/`,
`index.html`, `package*.json`, Vite config and `.github/`.

**Steps,** run on the staged diff before committing:

1. `npm test` and `npm run build` pass. The test suite includes the
   hostile-input checks below.
2. `npm audit --omit=dev`: no high or critical advisory in production
   dependencies. Run plain `npm audit` too and note new dev-tool advisories.
3. Walk the diff against the rules above. For agent sessions, also run the
   `/security-review` skill on the diff.
4. For a new tuner or output writer: paste a hand-crafted hostile link
   (newlines and directives in profile strings, out-of-range and non-numeric
   values, `__proto__` and `toString` as preset ids) and read the resulting
   config.

**Outcome.**

- **Blocking**, fix before committing: anything that lets state reach the
  output except as a validated value; an executable directive; an HTML or URL
  sink fed by state; a secret or `PRIVATE.md` content in tracked files or the
  bundle; a new third party or request without a decision; a weakened restore
  check or header; a high or critical production advisory.
- **Recorded**, commit allowed: dev-tooling advisories and hardening gaps go
  into `PRIVATE.md` under "Open security findings" with the fix.
- **Accepted trade-offs** are written into this file with the reason, like the
  missing `script-src`.

The commit message doesn't mention findings. An agent states the audit result
in its reply before asking to commit.

### Automated guards

The audit leans on tests so the checks don't depend on memory. These belong to
the contract suite (§9 Contract tests) and run over every tuner:

- **Hostile state.** Generated and hand-written malicious hashes go through
  `restoreState`, and the resulting config must parse with the writer's own
  line grammar: only known keys, typed values and the fixed comment and apply
  text. No input may add a line. Every file path must pass the "paths are
  constants" pattern, and no two files may share a path. The writers in
  `core/output/` enforce the same rules at runtime (`src/core/output/output.test.js`).
- **Forbidden sinks.** A source scan fails on `v-html`, `innerHTML`, `eval(` and
  `new Function`.
- **Forbidden directives.** A scan of every tuner's output for the executable
  directives listed above.
- **CI.** `npm audit --omit=dev --audit-level=high` runs in the test job.

The first and third are in the contract suite (`src/tuners/contract.test.js`),
which also fuzzes a few hundred mixed valid and hostile links per tuner. The
sink scan is `src/sourceScan.test.js`.
