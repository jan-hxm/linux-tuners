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
| `/swap` | 12 `vm.*` parameters: swappiness, `min_free_kbytes`, watermark scaling, `vfs_cache_pressure`, swap readahead (`page-cluster`), dirty-page writeback, overcommit, `panic_on_oom`. Graphs: swap pressure, watermark zones, dirty writeback. | `/etc/sysctl.d/99-swap-tuning.conf`, plus device-aware swap setup instructions (swap file, zram-generator, zswap) |
| `/systemd` | Manager defaults (accounting, `DefaultTasksMax`, `DefaultLimitNOFILE`, `DefaultLimitMEMLOCK`) and per-slice controls (`CPUWeight`, `CPUQuota`, `MemoryHigh`, `MemoryMax`, `MemorySwapMax`, `IOWeight`, `TasksMax`) for `system.slice`, `user.slice` or `machine.slice`. Graphs: CPU shares, memory budget, task and FD caps. | Two drop-ins in one document: `/etc/systemd/system.conf.d/99-resource-tuning.conf` and `/etc/systemd/system/<slice>.d/50-resources.conf` |
| `/security` | 18 hardening sysctls: `kptr_restrict`, `dmesg_restrict`, `perf_event_paranoid`, `yama.ptrace_scope`, `randomize_va_space`, `unprivileged_bpf_disabled`, `user.max_user_namespaces` (written only as 0, to block them); `rp_filter`, `tcp_syncookies`, IPv4/IPv6 `accept_redirects`, `send_redirects`, `accept_source_route`; `fs.protected_*`, `suid_dumpable`. The profile's kernel generation and IPv6 switch decide which keys and values exist. No graphs. | `/etc/sysctl.d/99-security-hardening.conf`, with notes on one-way values and on existing network interfaces |
| `/network` | 17 `net.*` sysctls: `rmem_max`, `wmem_max`, `tcp_rmem`, `tcp_wmem`; `somaxconn`, `tcp_max_syn_backlog`, `netdev_max_backlog`; `tcp_congestion_control`, `default_qdisc`, `tcp_slow_start_after_idle`, `tcp_mtu_probing`; `ip_local_port_range`, `tcp_tw_reuse`, `tcp_fin_timeout`; `nf_conntrack_max`, `nf_conntrack_buckets`, `nf_conntrack_tcp_timeout_established`. Buffers are sized from the bandwidth-delay product of the profile's link speed and longest path; the conntrack keys exist only when the profile says `nf_conntrack` is loaded. Targets kernel 4.19+. Graph: per-connection throughput ceiling against RTT. | `/etc/sysctl.d/99-network-tuning.conf`, with notes on the qdisc reaching only new interfaces, congestion-control modules, and loading `nf_conntrack` before `systemd-sysctl` runs |
| `/filesystem` | 6 `fs.*` sysctls: `file-max`, `nr_open`; `inotify.max_user_watches`, `max_user_instances`, `max_queued_events`; `aio-max-nr`. Ranges start at the kernel default, since lower values only make programs fail. `file-max` is left out on systemd 240+, which raises it to the maximum at boot, and `nr_open` is left out at the kernel default so distributions that raise it keep their value. The watch limit is held to a worst case of a tenth of RAM. No graphs. | `/etc/sysctl.d/99-filesystem-tuning.conf`, with notes on what is left out and on units whose `LimitNOFILE=` passes `nr_open` |
| `/hugepages` | 9 keys: `vm.nr_hugepages`, `nr_overcommit_hugepages`; THP `enabled` and `defrag`; KSM `run`, `pages_to_scan`, `sleep_millisecs`; `vm.max_map_count`, `zone_reclaim_mode`. The THP and KSM keys are sysfs files (a def's `sysfsPath`). The pool starts at 0 and is offered up to nine tenths of RAM, since it takes RAM whether used or not; THP starts at `madvise` for every workload and KSM is on for VM hosts. Keys at a default that a distribution, the boot options or a service may already set are left out: the pools at 0, KSM off, `max_map_count` at 65530. `zone_reclaim_mode` exists only with several NUMA nodes. No kernel defaults preset, since the THP default is a kernel build choice. `vm.mmap_min_addr` is not offered: the only reason to change it is lowering it for Wine or DOSEMU, which reopens NULL-dereference exploits. No graphs. | Two files in one document: `/etc/sysctl.d/99-hugepages-tuning.conf` and `/etc/tmpfiles.d/99-hugepages-tuning.conf`, whose `w` lines set `/sys/kernel/mm` at boot |
| `/sysv-ipc` | 6 System V IPC sysctls: `kernel.shmmni`, `shm_rmid_forced`; `kernel.sem` (SEMMSL, SEMMNS, SEMOPM, SEMMNI); `msgmni`, `msgmax`, `msgmnb`. Since 3.19 the kernel defaults pass what Oracle and Db2 ask for, apart from Db2's RAM-based counts and 64 KiB messages, so every range starts at the kernel default and only the Db2 workload raises anything. Every key is written, at the default too, so the file undoes an older guide's lower values (Oracle's minimum `kernel.sem = 250 32000 100 128` cuts SEMMNI from 32000 to 128). `kernel.shmmax` and `kernel.shmall` are not offered: their default is no limit and any value lowers it. `kernel.sem` is a tuple with one range per field (`def.elementLimits`). The worst-case memory of full message queues (`msgmni` × `msgmnb`) is shown in the formula. No graphs. | `/etc/sysctl.d/99-sysv-ipc-tuning.conf`, with notes on what is left out, the vendor minimums, and containers starting at the kernel defaults |
| `/kernel` | 9 `kernel.*` sysctls: `pid_max`, `threads-max`; `kernel.keys.maxkeys`, `maxbytes`; `panic`, `panic_on_oops`, `softlockup_panic`, `sysrq`; `printk` (four fields). `pid_max` has a card only for systemd before 243, which raises it to 4194304 at boot. `threads-max` starts at the kernel's RAM-based value (thread stacks in an eighth of RAM) and is written only when raised, since a value below the running threads stops every fork; the formula shows the `DefaultTasksMax` systemd derives from it. Container hosts get LXD's key quotas, unattended machines reboot 10 s after a panic and panic on an oops, and every workload gets SysRq 176 and console loglevel 4. `kernel.sysrq` is an enum whose options print their bitmask (`sysctlValue`). The pre-5.13 scheduler sysctls, `sched_autogroup_enabled` (no effect under systemd's cpu controller) and the user namespace limits are not offered. No graphs. | `/etc/sysctl.d/99-kernel-tuning.conf`, with notes on what is left out, `kernel.panic` deciding every reboot, SysRq and `/proc/sysrq-trigger`, and the console loglevel |
| `/block-io` | 5 block queue attributes under `/sys/block/<dev>/queue/`: `rotational`, `scheduler`, `nr_requests`, `read_ahead_kb`, `nomerges`. One profile is one kind of disk (NVMe, SATA SSD, hard disk, virtio), and the file applies to every disk of that kind. NVMe and virtio disks keep `none`, SATA servers get `mq-deadline` and SATA desktops BFQ; sequential workloads read 1 MiB ahead, 4 MiB on a hard disk. The profile says whether the kernel has the `bfq` and `kyber` modules, and the scheduler list follows it (an enum range's `options`). `nr_requests` has a card only with a scheduler, since without one its ceiling is the device's queue depth; at 0 it keeps the kernel's value. `rotational` has a card only for virtio disks, since the SATA rules match on it. `read_ahead_kb` is left out at 128 and `nomerges` at 0, so a kernel that starts a device higher keeps its value. Targets kernel 5.0+. No graphs. | `/etc/udev/rules.d/99-block-tuning-<kind>.rules`, one `ATTR{}` write per rule, with notes on refused writes, Fedora's BFQ rule, the legacy block layer before 5.0, and what is left out |

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
   sources. Every value it emits must be one the kernel or systemd accepts,
   which the VM tests check on real distribution kernels (§9 "VM tests").
4. **Validation has two levels.** *Blocking* issues hide the output, and are
   reserved for settings that the kernel or systemd rejects or that are clearly
   broken (for example `dirty_background_ratio >= dirty_ratio`, or a soft rlimit
   above its hard limit). Everything that is odd but legal is a warning or an
   info note.
5. **No silent no-ops.** If systemd or the kernel ignores a value, the slider
   doesn't offer it. For example `CPUQuota=0%` and `MemoryMax=0%` are ignored
   by systemd (meaning "no limit"), so `CPUQuota` starts at 10% and the memory
   limits start at 1%. `MemorySwapMax=0` is valid (systemd 239+, cgroup v2) and
   stays available.
6. **Static and private by default.** There is no backend and no cookies of
   our own. State lives in the URL hash, which is never sent to the server.
   The one exception is a viewer preference in local storage ([§5 Viewer
   preferences](#viewer-preferences)), which holds no tuner state.

## 4. Anatomy of a tuner

Every tuner follows the same flow:

1. **Profile form**: hardware and workload (RAM, swap device, cores, `pid_max`, …)
2. **Derived defaults**: `deriveDefaults(profile)`
3. **Presets**: partial value sets layered over the derived defaults. Applying
   a preset first resets to the defaults, so parameters the preset doesn't
   mention return to their default.
4. **Parameter cards**: a slider or toggle, click-to-edit exact value,
   layered descriptions (a plain-language `title`, the short description, a
   "Learn more" in labelled parts with the tuning tip, zones) and a reference
   drawer with a formula where one helps ([§7](#7-uiux-and-accessibility-conventions)
   "Three layers per parameter"). The drawer prints the def's
   `kernelDefault`, plus its `kernelDefaultNote` when the default depends on
   the kernel version or the distribution build. A "kernel defaults" preset
   only makes sense where one fixed set is right on every kernel offered: the
   security tuner has none, because there it would turn unprivileged BPF back
   on and loosen Ubuntu's perf restriction.
5. **Validation**: issues shown inline on the affected cards
6. **Live simulation**: a tabbed `GraphPanel` plus impact cards
7. **Config output**: copy, download, share URL, reset

## 5. Architecture

### Stack

Vue 3 + **plain JavaScript** (no TypeScript; shapes are JSDoc `@typedef`s),
`<script setup>`, Pinia, vue-router, Tailwind CSS, Chart.js via vue-chartjs
(registered once in `src/ui/charts/chartSetup.js`, which `ChartFrame.vue` imports, so
Chart.js loads only when a chart first renders: each tuner's chart tab components are
`defineAsyncComponent` in its `index.js`; `Filler` is needed for `fill: true`; the
Chart.js chunk is about 176 kB raw / 62 kB gzip, and the shared entry chunk went from
298 / 109 kB gzip to 126 / 49 kB gzip, Nov 2026), lz-string for URL state.
Tests use Vitest + @vue/test-utils. A test that needs a DOM names happy-dom
in its own file (`// @vitest-environment happy-dom` on the first line);
everything else runs in node. There are no environment path globs: Vitest
matches them case-sensitively against absolute paths, so a run started from a
lowercase drive letter (`c:\...`, as some Windows shells and editors start it)
ran DOM tests in node; `src/testEnvironment.test.js` fails on a DOM test
without the comment. `src/testSetup.js` puts every test on a path of its own,
so a tuner store's debounced hash write left over from one test can't seed
the next test's store. The axe sweep cases have a 30 s timeout, since they
take several seconds each under a full parallel run.

Type is self-hosted: Host Grotesk (one variable file, weights 400 to 600) for everything a person
reads and Fragment Mono 400 for everything the machine reads (keys, values,
paths, the file, the `[n]` marks), as committed Latin woff2 subsets in
`src/assets/fonts/` with their `OFL.txt` (43,288 bytes of woff2 in all),
`font-display: swap`, and metric-matched local fallback faces in `main.css`,
so the swap barely moves the text. There is no 700 weight. The prerendered
pages and the 404 use the system stacks (no webfont before the app loads).
See [§10](#rules-for-the-page-the-build-and-the-deploy) for why they are
never loaded from a font service.

### Domain modules behind a shared store and UI

Everything specific to one tuner lives in its folder `src/tuners/<id>/`
(layout in §9), whose **domain module** `index.js` implements the
`TunerDomain` contract in `src/core/types.js`: the profile field list,
parameter defs, presets, `deriveDefaults`, `rangeFor`, `validate`,
`generateConfig`, `formatValue`, sections, graph tabs and simulation, drawer
formulas and context notes. Each module is built with `defineTuner()`
(`src/core/defineTuner.js`), which fills in the optional hooks, derives the
default profile and the shared-link codec from the profile field list, and
asserts the required fields in dev and tests. It is listed in
`src/tuners/domains.js` so the contract tests (§9) cover it.

- **Store factory**: `defineTunerStore(id, domain)` in
  `src/core/createTunerStore.js` builds a generic Pinia store (hardware,
  params, preset, tab, drawer) and delegates the domain-specific work to the
  domain module. `useTunerStoreFor(domain)` returns the one store per domain
  (Pinia id = the domain id); tuners have no `store.js` of their own.
- **Shared components** (`ParameterCard`, `ParameterPanel`, `PresetSelector`,
  `ConfigOutput`, `InfoDrawer`, `GraphPanel`, `ProfileForm`) get the store and
  domain through `useActiveTuner()` / `useTunerDomain()`. The page shell
  **`TunerPage`** `provide()`s both. There is no fallback, so a component test
  passes both keys through `global.provide`. A component can't `inject()` what
  it `provide()`s itself, so `TunerPage`'s own composables (the impact
  metrics) take the store as an argument.
- **Page shell:** `src/ui/TunerPage.vue` takes only the domain; the router
  renders it for each live tuner, so tuners have no `View.vue`. It renders the
  profile form, the title block, step chain, the four steps, the graph tabs, ad slot,
  `AboutSection`, `InfoDrawer` and the mobile impact bar, whose metrics come
  from the simulation's `impactSummary`. All page copy and the About content are data in
  `src/tuners/<id>/about.js` (`PAGE`, `ABOUT`), with a small inline markup
  (`` `code` ``, `**bold**`, `[label](https://…)`, `[[glossary term]]`)
  rendered by `RichText.vue` from parsed segments (`ui/richText.js`), never as
  HTML. The same markup works in a def's `longDesc` paragraphs, which the
  card renders through `RichText` too, and the contract suite fails on
  markup the parser doesn't know (an `*italic*`), since it would show
  literally. The About section is always visible
  (no collapse), since it's real content and counts toward page quality.
- **Profile form:** one generic `src/ui/profile/ProfileForm.vue` renders each
  tuner's `profile.js` field list (§9 "Profile"): number fields with
  quick picks (`NumberPickField.vue`), selects, radio cards, segmented
  choices and pattern-checked text. The user edits a draft and applies it at
  once. On apply, numbers snap and clamp with the same `core/profile.js`
  helpers a restored link uses, and text that fails its pattern is refused
  with an inline message, so the form can't produce a profile the link schema
  rejects. The form collapses to a one-line summary after the first apply,
  and starts collapsed when the profile is already set: a page restored from
  a shared link (the store's `restoredFromLink`) and every tuner step of
  `/setup`. The draft lives in `useProfileDraft.js`, which the page creates
  and provides (`PROFILE_DRAFT_KEY`), so `ProfileDraftNotice` can repeat
  unapplied edits with the same Apply at the top of the tune step. Shared pick lists and ceilings live in `fieldOptions.js`, and the
  RAM field in `core/machine.js` (re-exported there), so the tuners never
  drift apart.

### Range slider: uncontrolled with external sync

`ui/controls/SliderControl.vue` deliberately does **not** bind `:value` on its
`<input type="range">`. A reactive `:value` cancels a Chromium drag mid-stroke
when the same input event triggers a re-render. Instead a `selfWrite` flag plus
a watcher push store changes to the DOM only when they come from outside the
slider (preset, profile change, URL restore, the card's click-to-type edit).

The track also holds still on screen while it's dragged. Its card keeps its
height (the origin note always shows, and "Back to X" keeps its space while hidden),
and a change that resizes something above it (a validation message in an
earlier card, a section's issue count wrapping its header on a phone) is undone
by scrolling: after the DOM updates, `commit` scrolls the window by however far
the track moved, with `behavior: 'instant'`, since the page's smooth scrolling
would otherwise lag behind the drag. Scrolling the window doesn't cancel the
drag.

### Shareable URL state

State is lz-string-compressed JSON in `location.hash`, written with a 200 ms
debounce. Because a shared link is untrusted input that ends up in a config
file someone may run as root, restoring it is strict:

- Envelope version must match; every parameter key must be present and parse
  strictly as its def's value type (`core/valueTypes.js` `restore`). The
  version is per tuner (`linkVersion` in the spec, 1 when omitted). Adding a
  parameter to a shipped tuner bumps it, so a link from before is refused
  outright rather than failing on the missing key; `/swap` is at 2 since
  `vm.page-cluster`.
- Profile fields are checked against the schema derived from the profile
  field list (enum lists, numeric ranges with a step, or a strict pattern),
  so a link can't inject lines into the generated config. Numeric fields snap
  to their step, exactly as the form does on apply.
- Parameters are clamped by their value type: integers are rounded and held
  to the slider range, enums to their listed options. `setParam` uses the same
  clamp, so a typed `60.5` becomes `61`.
- Unknown preset ids are dropped (preset maps are plain objects, so inherited
  names like `toString` must not resolve). An unknown tab falls back to the
  first tab.
- Hash writes preserve `history.state` (Vue Router keeps scroll and position
  data there) and are skipped if the user has navigated to another route since.

### Viewer preferences

Two keys in `localStorage` (`ui/viewerPrefs.js`) remember the parameter
panel's switches: `linux-tuners:show-all-parameters` for "Show all
parameters" and `linux-tuners:compact-parameters` for "Compact", each `'1'`
when on and removed when off. They are conveniences for the viewer, never
tuner state, so they are not part of the hash, are never sent anywhere, and
the page works the same when storage is blocked or throws (the switches start
off). The privacy policy lists them in section 3. The filter text and "Changed
only" are not remembered at all: they last for the visit. Any other preference worth remembering takes the same
form: one on/off or enum value per key, prefixed `linux-tuners:`, and a line in
the policy.

### Routes, SEO and build

Route metadata is single-sourced in `src/routes-meta.js`, which lists the
landing and legal pages and takes each live tuner's route from the registry
(`src/tuners/registry.js`, see [§9 Registry](#registry)). The router applies
the head tags client-side, and `npm run build` runs a postbuild step
(`scripts/generate-static-routes.mjs`) that writes `dist/<route>/index.html`
with the route's title, OG/Twitter tags, JSON-LD and canonical URL baked in,
plus `sitemap.xml`. Crawlers that don't run JavaScript therefore see the
correct link previews. Each sitemap `<lastmod>` is the last commit to that
page's own sources (a tuner's `src/tuners/<id>/` folder; for `/` the landing
view, its copy in `src/ui/landing.js`, its example setting
(`LandingSpecimen.vue`, `landingExample.js`) and the registry; for `/setup`
`src/setup/` and the registry), so a deploy doesn't mark every page changed. CI checks
out the full history for this; in a shallow clone the build date is used.

**Static page text.** Crawlers and readers that don't run JavaScript (search
and AI crawlers, text browsers) also get each page's substance. The
`src/static/` layer (§9) builds one neutral document per route (`pageDoc`:
headings, rich-text paragraphs, lists, definition rows, code blocks) and two
serializers write it: `toHtml` (semantic HTML in one `<main
class="static-doc">`, every text and attribute escaped, links only from https
`link` segments, glossary terms as `<dfn>` with their definitions in a
Glossary section at the end of the page, never a `title` tooltip) and
`toMarkdown`. The last
postbuild step (`scripts/static-content.mjs`, which loads the layer through a
Vite server's `ssrLoadModule`) puts the HTML inside each route's `<div
id="app">`, `dist/index.html` included; `app.mount()` replaces it, with no
hydration. A tuner page says, in order: title and intro, "Do I need this?",
the profile fields and the default profile, each section with its parameters
visible under the default profile in full (name, short and long description,
tuning tip, default, range, options, context note, docs link) and the others
named with their short description, the presets with what each changes from
the default profile, the graph blurbs, the config `generateConfig` writes for
the default profile (one build date for every page) with its install, check
and undo steps, and the About content. `/` lists every tuner, `/setup` its
steps; the legal pages get none. The build also writes `dist/<tuner>.md`,
`dist/index.md`, `dist/llms.txt` (llmstxt.org) and `dist/llms-full.txt`, adds
a `<link rel="alternate" type="text/markdown">` to each tuner's head, appends
`_headers` rules for those files (Markdown as `text/markdown`, `noindex`, a
canonical `Link` to the HTML page; the llms files as `text/plain`), and fails
when a tuner's doc misses a parameter or preset. Like the generated config,
this text is **built from definitions, never from state**. The static HTML
is styled by `.static-doc` in `main.css` and shows until the module script
runs.

Every page shares one card image, `og-image.png`
(1200×630), which `npm run gen:icons` renders from `public/og-image.svg`: X,
LinkedIn and Facebook don't show SVG previews. Edit the SVG, then regenerate
and bump the `?v=` in `OG_IMAGE_PATH` (and `index.html`), since link previews
are cached by image URL.
The renderer has no Host Grotesk, so the script outlines every `<text>` (here
and in `logo.svg`) from the self-hosted woff2 files with fontkit (the variable Host Grotesk is unpacked to TTF with the dev dependency `wawoff2`, since fontkit can't vary a woff2, and instanced per weight) first. Keep
each `<text>` start-anchored, plain, and with its attributes on the element.

Unknown paths return a real 404: the same step writes a static `dist/404.html`
(no scripts, no ads, `noindex`, links to every live tuner), which Cloudflare
Pages serves with status 404. There is no SPA fallback, because every route is
prerendered. The router's catch-all only handles in-app navigation.

**Crawler policy.** `public/robots.txt` welcomes search and retrieval bots
(the ones that fetch a page to answer a question and link back: OAI-SearchBot,
ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User,
plus Googlebot and Bingbot) and disallows AI training crawlers (GPTBot,
ClaudeBot, CCBot, Google-Extended, Applebot-Extended, meta-externalagent,
Bytespider). robots.txt is voluntary, so this states intent rather than
enforcing it. A named group ignores the `*` group, so each group that allows
`/` repeats the `/imprint` and `/privacy` disallows; `src/robots.test.js` pins
all of this. Cloudflare's managed robots.txt / AI-bot blocking must not be
enabled in a way that contradicts the policy (for example by blocking the
search bots or overwriting this file).

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
on every push and PR, and deploys `main`. `public/_redirects` has no SPA
fallback (unknown paths get the 404 page, see Routes, SEO and build). `public/_headers` sets frame blocking, `nosniff`, `base-uri`,
`object-src` and a Permissions-Policy. There is deliberately no `script-src` CSP, because AdSense
and the CMP load from a changing set of Google domains.

### Guided setup

> **Status: built.** The landing role picker, the machine profile with its
> mapping, the facts, and `/setup` itself.

The tuners answer "what should this one setting be". The guided setup answers
"what should I set on this machine, and in what order". It has two parts:

- **The landing page explains the bigger picture.** In order: the hero
  (headline, lead, "Pick your machine type", which jumps to the role list,
  "Browse tuners", and one trust line) beside a live specimen setting
  (`vm.swappiness` for a desktop with 16 GiB RAM and 8 GiB NVMe swap,
  `LANDING_EXAMPLE` next to the swap profile, its value from
  `deriveDefaults`, so the fit bar and the kernel-default tick sit apart);
  the key to the three marks; "Why" (a forum thread's one number against
  this site's answer; the forum value is hand-typed illustration copy of
  what forums say, not read from data); "What is this machine for?", a role radiogroup (each role's name with a
  one-line `hint` under it, the radio's `aria-describedby`) beside
  the route for the picked role; and "Or open one tuner directly", a table of
  every live tuner with the question it answers (the registry's `question`),
  its setting count and the files it writes, then the planned tuners and the
  ad. The route lists the tuners that matter for the role in setup order,
  each with its `why` line, and "Usually fine to leave" names the rest
  below it, so nothing is hidden. The copy is plain data in
  `src/ui/landing.js`, which the static text (`static/pages.js`) reads too.
  There is no setup button in the hero. **"Start guided setup" sits in the
  route's header row** beside its summary ("Database: 9 tuners, in this
  order."), sticky under the site header from `lg` up and at the bottom
  of the screen on a phone while the roles are in view, and opens `/setup`
  with the role. The rule behind it holds for the whole site: never place a
  primary action below content whose length depends on data. The table's
  setting counts and file paths are stored in the registry (`settingCount`,
  `writes`, [§9 Registry](#registry)), so the landing route loads no domain
  module for them: every domain together is about 93 kB gzip, more than the
  page itself. `importBoundaries.test.js` keeps `LandingView.vue` from
  importing `tuners/domains.js`. The page is still
  prerendered in full, so crawlers and no-JS visitors see the same story.
  The picked role lives in the query (`/?role=database`), so Back and a
  shared link keep it; a value that isn't a known role (`isMachineRole`)
  reads as no role, which shows every tuner. `tunersForRole` in
  `core/machineRoles.js` does the split. The router keeps the scroll
  position when only the query changes.
- **`/setup` walks through a whole machine.** The user enters the machine
  profile once. Then each tuner is a step, and the last step shows every file
  for the system. One step shows at a time, with a step list beside it (above
  it on a phone) that marks each step skipped, blocked or with issues to
  check, and Back and Next buttons under it. Moving to a step focuses its
  heading.

**Order.** There is one setup order, and it is the registry's array order, so
the landing cards, the nav and the setup steps can't disagree. It puts the
settings every machine needs first, and puts each limit before the settings
it bounds: swap and memory, security, filesystem, kernel, systemd, network,
block I/O, huge pages, SysV IPC. systemd comes after filesystem and kernel
because `DefaultLimitNOFILE` is bounded by `fs.nr_open`, and `DefaultTasksMax`
by `kernel.pid_max` and `kernel.threads-max`. A contract test checks this
order (see "Facts" below).

**Relevance per role.** Each live registry entry has a `setup` block of plain
data: `roles`, the roles it is recommended for (or `'all'`), and `why`, the one
line the landing card shows for those roles. The role ids are listed in
`core/machineRoles.js`, a module with no imports, since the registry is read
under Node; `registry.test.js` checks every entry against it, and a list
naming every role must say `'all'` instead, so a new role reaches it. The step for a tuner outside
the role starts skipped, and the user can include it. Picking another role in
the machine profile resets which steps are skipped to that role's. To begin with: huge
pages for database and VM hosts, SysV IPC for databases, network for every
role except desktop, and the rest for all roles.

**Machine profile** (`core/machine.js`). This is the one field list for the
machine. It uses the same field types and helpers as a tuner profile
(`core/profile.js`), so `ProfileForm` renders it and the same schema
restores it from a link. A field joins it only when two or more tuners read
it, which is the promote rung of the reuse ladder applied to profile fields:

- `role`: general server, web or API server, database, container or
  Kubernetes host, VM host, router or firewall, desktop.
- `ramGiB`: the shared `RAM_FIELD`, which moved here from
  `ui/profile/fieldOptions.js` because core can't import ui.
- `kernel`: version ranges cut at every version a tuner's profile tells
  apart: security at 4.19 and 5.13, swap at 5.8 and 5.17. That gives 5.17 or
  newer, 5.13 to 5.16, 5.8 to 5.12, 4.19 to 5.7, and 4.9 to 4.18. Each
  option's value is the first version of its range (`'5.13'`), so swap's
  free-text version field copies it unchanged. A new threshold adds a cut.
- `systemd`: 243 or newer, 240 to 242, older or none (values `'243'`,
  `'240'`, `'older'`).
- `cgroupVersion`: v1 or v2. The shared `cgroupField` copies it.

Fields only one tuner reads stay in that tuner's step: CPU cores, the slice,
link speed and RTT, conntrack, the swap device, the disk kind, NUMA, IPv6 and
the scheduler modules.

**Mapping is data in each tuner.** A tuner profile field may declare
`machine`. That is either the name of a machine field it copies (`'ramGiB'`),
or `{ from: '<machine field>', map: { <option>: <value> } }` with one entry
per option, which `defineTuner` checks (`machineProblems`). For example, the
security tuner's `kernel` field maps the five ranges onto `current`, `lts`
and `legacy`. The swap tuner's free-text `kernelVersion` copies the range's
first version. Each tuner's `workload` maps the seven roles onto its own
workloads (a VM host is `vm-host` for huge pages, `container` for security
and network, since it forwards and tracks connections for its guests, and
`server` elsewhere). `machineValues(fields, machine)` returns the mapped
values. The setup page builds a step's profile from
`defaultHardware`, overlays the mapped values and runs the result through
that tuner's restore schema. A mapping mistake therefore can't produce a
profile a link couldn't. A mapped field is prefilled, not locked: the step
marks it "from the machine profile", and the user can change it for that
step only (for example the SysV IPC workload from database to `oracle`). The
change lasts until that machine field changes, and a shared link doesn't keep
it (see "Link state"). The marks come through an optional injection,
`PROFILE_FIELD_NOTE_KEY`, which a tuner page doesn't provide, so its
`ProfileForm` shows none. A field fed by a fact is marked "from the <step>
step" the same way. The contract suite checks that
every combination of the machine's choice options, and the RAM floor and
ceiling, maps to a profile that a link restores unchanged and that has no
blocking issue. It also checks that every workload field maps the role and
every RAM and cgroup field copies its machine field.

**Facts link the steps.** Some limits come from another tuner's *values*, not
from the machine profile. A domain may provide facts through an optional hook
`facts(hardware, params)`. It returns values named in a fixed vocabulary,
`MACHINE_FACTS` in `core/machine.js`: `pidMax` and `threadsMax` (the kernel
tuner's effective values, so systemd 243's boot-time `pid_max` counts) and
`nrOpen` (filesystem). `fs.nr_open` is left out at 1048576, where Debian 13
and Fedora start higher, so `nrOpen` is the least the machine runs with. A
domain reads facts in two ways, and both default to none:

- A profile field's `machine` may name a fact, which it copies (a fact is
  never mapped). The systemd step's `pidMax` field comes from the kernel step
  this way. `machineValues` skips these fields, and `factValues(fields,
  facts)` fills them.
- `validate(hardware, params, facts)` gets the facts as an optional third
  argument, and the domain lists the ones it reads in `readsFacts`. The
  systemd tuner warns when the `DefaultLimitNOFILE` hard limit passes
  `nrOpen`, since units then get `fs.nr_open` instead. Today's ranges can't
  get there (the hard limit stops at 1048576, `fs.nr_open` starts there),
  so the rule guards against a range change. It also warns when
  `DefaultTasksMax` or `TasksMax` passes the smaller of `pidMax` and
  `threadsMax`. Both task caps start at systemd's own default, sized from
  the same RAM formula as the kernel step's `threads-max`
  (`core/kernelLimits.js`), so the rule stays quiet on a default machine.

On a tuner's own page there are no facts, so it behaves as it does today.
The rule stays with the tuner that owns the setting, written against the
shared vocabulary, so no tuner imports another and shared code never names a
tuner. The contract suite checks that every fact is provided by exactly one
tuner, earlier in the setup order than every tuner reading it
(`factsReadBy`). It also checks that a provider returns the same facts as
numbers in every state, and that `validate` reads only the facts it declares,
by handing it a guard that throws on any other. Every value a provider
gives a fact-fed field must restore unchanged from a link. Finally, walking
the steps in order with every step at its defaults, for each machine profile,
the facts add no issue.

**Steps reuse the tuner UI.** The step's store comes from
`defineTunerStore('setup/<id>', domain, { urlSync: false })`: with the option
off the store neither reads nor writes the hash, because the page owns the
link. The step `provide()`s it, so the shared `ProfileForm`, `PresetSelector`,
`ParameterPanel`, `InfoDrawer` and `UndoToast` render in the step unchanged
(the drawer too, since every card's name opens it). Graphs and the About
content stay on the tuner's own page. Each step links there, opening a new
tab with the step's state encoded in the hash. Edits made on that page don't
flow back, because the step can already edit every value. The machine step
renders the same `ProfileForm` with the setup store standing in for a tuner
store: it has `hardware`, `setHardware` and an undo state. Two kinds of change
reach a step:

- A machine-profile change re-derives every step's defaults, as `setHardware`
  does, and offers Undo, which puts back the machine, the skipped steps and
  every step's state (`UndoToast` kind `machine`).
- A fact change from an earlier step only updates the fed profile field. The
  params keep their values and are clamped to the new range
  (`clampToProfile`), so tuning the kernel step doesn't reset systemd. The
  store's `facts` state and `setFacts` action do this, and its `issues` getter
  passes the facts to `validate`. On a tuner's own page the facts stay `{}`.
  A skipped step provides no facts, so the steps after it validate as on
  their own pages.

Each step shows its validation issues above its cards. A step with a blocking
issue says so in the step list.

**Output.** The last step lists each included step's files, from that tuner's
own `generateConfig` (the store's `configFiles` getter), unchanged. Each file
has its own copy and download buttons; the text shows on request. A file
downloads under the last part of its path, with its folder in front when two
files share it (`downloadNames` in `ui/fileActions.js`: systemd's two slice
drop-ins, the huge pages sysctl.d and tmpfiles.d files). A combined copy uses
`combineFiles`, with one header for the machine profile, built from the
machine fields' option labels. A blocked step's
files are left out, and the step is named in their place. Under the files,
the shared export steps (§7) cover every included file at once, and "Copy all"
confirms with the same "Next: ..." line as a tuner page (`nextStepSentence` in
`ui/installGuide.js`, naming the first install step). There is no
install script and no archive. A script would put executable directives in
the output (§10). An archive would need a zip writer to save four clicks.
A contract test checks that no two tuners write the same sysctl key, sysfs
path, udev attribute or file, and that the download names are unique, so
the files never fight over a value. This holds today, and lexical
`sysctl.d` order would otherwise decide the winner silently.

**Link state.** `/setup` keeps its own envelope in the hash
(`src/setup/link.js`): a version (`SETUP_LINK_VERSION`, bumped when a step is
added), the machine profile with its role, the skipped steps, and each step's
state encoded by that tuner's own `encodeState`. Restoring is as strict as a
tuner link. The machine profile goes through its schema (`restoreFields`, the
same check `decodeState` uses), each step through its tuner's `restoreState`,
and a missing or unknown step id, an unknown or repeated skipped id, or a step
that fails rejects the whole link, which then opens as a fresh setup. Facts
and mapped fields are never read from the link. They are recomputed from the
restored values, so a link can't make two steps disagree. The landing page's
`?role=` only seeds a fresh setup, and the first hash write drops it. With
every step included the hash is about 4.6 KB, well inside what browsers
accept.

**Layer.** `src/setup/` is a composition root, like `router.js`. It may import
`core`, `ui`, each tuner's domain module through `tuners/domains.js`, and the
registry, but no tuner file directly. Nothing imports it except the router. The
setup page iterates the domains and their data. It never branches on a tuner
id. `importBoundaries.test.js` checks the rule. `steps.js` (the steps, the
walk that feeds facts forward) and `link.js` are plain JS, tested under Node;
`useSetupStore.js` holds the machine, the skipped steps and one step store
per tuner.

**Route.** `/setup` is an indexed page in `routes-meta.js`. Its sitemap
sources are `src/setup/` and the registry. The landing route's "Start guided
setup" button opens it, with `?role=` when a role is picked, and the site
header's "Start setup" opens it fresh.

**Page.** The steps sit on the shared step chain (`ui/StepChain.vue`, the
same segments as the tuner page's, §7) as buttons marked
`aria-current="step"`. A step's state is said in text with a mark in front
("– Skipped", "× Blocked", "! 5 to check"), never by colour alone: a skipped
step's segment is dashed, a blocked one's is `error`. Back and Next are a
secondary and a primary button under the step, and the files step reads like
a tuner's export.

## 6. Adding a tuner

1. A folder `src/tuners/<name>/` laid out as in §9, with the domain module
   `index.js` built with `defineTuner()` and added to `TUNER_DOMAINS` in
   `src/tuners/domains.js`. The contract suite and the config snapshots then
   run over it; review the new snapshot file.
2. `profile.js` with the profile field list, `about.js` with the page copy and
   About content, and the graph tabs and simulation in the domain module. The
   store, page and profile form come from the shared code.
3. Registry entry in `src/tuners/registry.js` (landing-card text, nav label,
   route metadata) and a lazy domain loader in `TUNER_DOMAIN_LOADERS`
   (`src/router.js`). The
   route, landing card, header nav and sitemap follow from it, and
   `src/tuners/registry.test.js` checks that the registry, domains and router
   agree.
4. **Don't add the route entry or an indexed page until the tuner works.**
   Ad networks and search engines treat "under construction" pages as thin
   content. Until then the entry stays `status: 'planned'`, which renders
   only a "Coming soon" card on the landing
   page.
5. Pass the security audit in [section 10](#10-security), including the
   hand-crafted hostile link, before the first commit of the tuner.

## 7. UI/UX and accessibility conventions

These are settled decisions from the UI/UX and accessibility audit. New UI
must follow them, and existing UI must not regress.

- **The live simulation must stay usable on mobile.** `GraphPanel` sits beside
  the parameters only at `lg+`. Below that, views render `MobileImpactBar` (a
  `lg:hidden` fixed bottom bar fed the same `impact` array) plus a
  `h-24 lg:hidden` spacer. The bar gives each metric a column, its label over
  its value, so every metric shows at 320px (it is at most 83px tall; the undo
  toast sits at `bottom-24` above it). It ends in a "Graphs" link to the
  panel's `#graphs` anchor, outside its `aria-live` list so it isn't
  re-announced.
- **Each tuner page opens with a "Do I need this?" box** (`NeedThisBox`, under
  the title block and the step chain, collapsible, open by default). It is built from the registry's
  `setup` block: `why`, the `roles` (as `MACHINE_ROLES` labels) and
  `defaultsFine`, which every live tuner must set (registry test). Change the
  wording in the registry, never in the component.
- **Every disclosure or toggle is a real `<button>`** with `aria-expanded` and
  `aria-controls`. Never put click handlers on bare `<div>` or `<header>`
  elements.
- **Nothing a user needs lives only in a `title` tooltip**, which touch
  screens never show and keyboards can't reach. The preset "what would change"
  list sits behind a per-preset toggle button in `PresetSelector` instead, and
  a card's badges ("danger at 0", the context badge) are explained in its
  Learn more layer, and a glossary term opens its definition inline ([§8
  Glossary terms](#8-copy-conventions)).
- **Targets are at least 24 × 24 px** (WCAG 2.2 AA, 2.5.8). A small text
  button or link that stands alone (Learn more, "N changes", the section
  headers, the value's edit button) gets `inline-flex min-h-6 items-center`,
  switches are `h-6 w-11`, and chips get `min-h-6`. Links inside running text
  are exempt; a list of links with tighter than 24 px line pitch is not.
- **No page-level sideways scroll down to 320px.** Whatever can be wider than
  a phone handles it itself: the header is one row (logo, Tuners
  button, Start setup; the logo text and the current tuner's name hide on the
  narrowest widths) and its tuner panel scrolls within the viewport, a profile field's quick picks are a select
  below `sm` instead of rows of chips, selects are capped at `max-w-full`,
  segmented controls wrap with growing segments, a card's value wraps under
  its name, and parameter names break after `.`, `_`, `-` or `/` (`<wbr>`).
  A one-column grid says `grid-cols-1` (`minmax(0, 1fr)`): an implicit `auto`
  column grows to its widest child's min-content, as the tune step's did with
  `GraphPanel`.
- **The step chain shows where you are.** Steps are segments on a line
  (`ui/StepChain.vue`, shared with `/setup`): the current one a thick `fit`
  segment, the ones behind it `rule-strong`, the ones ahead `rule`, each
  with its mono number and label. On a tuner page the segments are links,
  and `useScrollSpy` marks the step in view with `aria-current="location"`
  at every width. The site header is one row (`--site-header-h`, 61px): logo,
  a "Tuners" disclosure button (`aria-expanded`, `aria-controls`, +/- mark),
  the current tuner's name after a "/", Glossary (only if a `glossary` route
  exists) and Start setup. It is sticky from `lg` up and static below,
  since on phones the impact bar already sticks and two sticky bars take
  too much of a small screen. The button opens a full-width panel of every live
  tuner (name and registry `question`, the current one `aria-current="page"`
  with a `fit` top rule) and an "All tuners" link. It is a disclosure, not a
  modal: no focus trap; Escape closes it and refocuses the button, as does a
  click outside, choosing a link or any route change. From `lg` up the chain sticks under the site header (it's
  a sibling of the title block, not inside it, so it can); on phones it
  stays put, since the impact bar already takes space. The sticky offsets
  and anchor `scroll-mt` are built from `--site-header-h` and
  `--step-chain-h` in `assets/main.css`, measured values to update whenever
  either bar's height changes, so the tuner chain truncates its labels to
  one line. The step labels are the profile step's own word ("Hardware" on
  swap), Preset, Tune and Export.
- **The settings outline keeps the reader's place** (`ui/outline/`). It
  lists Preset, Tune and Export, under Tune each group shown and under each
  group every card shown, by its def `title` on one line, in a
  `<nav aria-label="Settings outline">` of nested lists. What is in view
  (`useScrollSpy` over the group and card anchors, only while the tune step
  is current) is a thick `fit` segment on the outline's line, as in the step
  chain, with `aria-current="location"`. A changed setting carries the
  `mine` dot and one with a warning or error its mark, both also said in the
  link's name ("…, changed by you, warning"). Hidden advanced cards and a
  collapsed group are one "+N advanced" / "+N settings" line that opens them
  as the group's own button does and focuses the first card that appeared.
  A pick scrolls the card's anchor (a `role="group"` wrapper with
  `tabindex="-1"` in `ParameterPanel`, `setting-<key>`, with the sticky bars'
  `scroll-mt`) into view, smoothly unless the reader prefers reduced motion,
  and moves focus to it; the links never follow their hash, since the hash
  holds the shared-link state. The list is built from the defs, the store
  and the panel's view (`ui/useParameterView.js`, which `TunerPage` creates
  and provides so the panel and the outline show the same cards), never from
  a tuner id. From `xl` up it is a sticky rail left of the steps (12rem,
  with its own padded scroll box) whose one toggle button (`aria-expanded`)
  collapses it to a 2.5rem ruler of ticks, one link per card named by its
  title, the one in view a thick `fit` tick and changed ones with the dot.
  The rail starts expanded only where the settings column keeps the card's
  40rem margin layout beside it and the graph column
  (`railStartsExpanded`): with graphs it starts collapsed at 1280px
  (column 43.5rem) and expanded at 1440 and 1920px (40rem, since the page's
  measure stops growing at 86rem); without graphs it is expanded at every
  `xl` width (62rem at 1280px). The reader's toggle lasts for the visit, in
  memory only (no storage key). Below `xl` an "Outline" button beside the
  step chain opens the same list in a focus-trapping drawer from the left
  (`ui/focusTrap.js`, shared with `InfoDrawer`), which closes on a pick and
  puts focus on the card, or on Escape and returns focus to the button.
- **Tablists need roving tabindex *and* arrow-key handling**
  (Left/Right/Home/End), as in `GraphPanel`'s `onTabKeydown`.
- **Modals and drawers trap focus, close on Escape, and restore focus to the
  element that opened them** (`InfoDrawer`). `aria-modal` alone doesn't trap
  focus.
- **The page has one measure.** The header, the footer and every page that
  fills the width (landing, tuners, setup) use `PAGE_WIDTH`
  (`ui/layout/pageWidth.js`: 86rem with the same gutters), so their left
  edges line up; the legal pages keep a narrower reading measure inside it.
- **Canvas charts get `role="img"`** and a reactive plain-language
  `aria-label` summary: render them inside `ui/charts/ChartFrame.vue`, which
  requires the label. The visible legend isn't an alternative for assistive
  technology. The frame wraps the canvas in an `aria-hidden` box, since
  vue-chartjs gives the canvas an unlabelled `role="img"` of its own.
- **One chart look, built once** (`ui/charts/chartStyle.js` and the
  `zones`, `endLabels` and `probe` plugins in `ui/charts/plugins.js`).
  Charts describe their series, zones and probe stops as data and never set
  a colour, width or dash themselves. The main series is a 2.75px line in
  its owner's tone (`fit` while it comes from the profile, `mine` once the
  visitor changed one of its parameters, via `useSeriesTone`; `ink` with no
  parameters) over a 10% fill; a comparison (the kernel default) is a thin
  dashed `quiet` line; a range is a shaded band or, for danger, an `error`
  hatch, and only a single threshold stays a dashed line. A bar that
  carries meaning meets 3:1 on paper in both schemes: a tone too faint for
  that (`rule`) is drawn as a `quiet` outline instead. Where the data is
  flat for most of an axis, `focusRange` starts the axis a margin before
  the change, and the axis title and the summary say the range shown. Only
  horizontal `rule` hairlines; units go in the ticks and y titles are
  dropped (the caption names the quantity); in-plot text is at most a short
  end label per series, and the zones are named in the `ChartLegend` key.
  Everything else is in the probe's tooltip: hover, a tap or the arrow keys
  (the frame is focusable; Home/End, PageUp/PageDown, Escape) rest a
  crosshair with a dot on each series, or an outline on a bar, and a
  compact square tooltip (title, one value line, a short zone note only
  when it adds something) floats over the plot in the top corner farthest
  from the crosshair, and moves (bottom corner, clear of the crosshair, or
  below the frame) so it never covers the probed point, a series' dot or
  the probed bar (`placeTip`). A chart's height is
  `clamp(11rem, 30vh, 15rem)` (bars 7rem), and the sticky graph column is
  never taller than the viewport below the sticky bars: past that it
  scrolls on its own and only then becomes a focusable, named region. Keyboard moves are
  announced through a polite live region beside the image, after 300 ms.
  Chart.js's own tooltip, hover events and animation are off.
- **No global keyboard shortcuts that clash with the browser.** For example,
  the old `Ctrl+Shift+C` copy binding overrode devtools.
- **Type size and contrast floors.** Nothing meaningful is smaller than
  13px (`text-[13px]`, the captions, `[n]` marks and chart ticks); body text
  is 15 to 19px, and no headline is bolder than 500. Text uses only the text
  tokens (`ink`, `ink-2`, `quiet`, `fit-text`, `mine-text`, `error`), each
  at least 4.5:1 on every surface token (`paper`, `paper-hover`, `fit-tint`,
  `mine-tint`) in both schemes; primary buttons are `paper` on `ink` (hover
  `ink-2`). Marks (the kernel-default tick, the fit bar, the "yours" dot,
  the error frame, the focus ring) use `ink`, `fit`, `mine` and `error`, at
  least 3:1 on every surface. `rule-strong` (secondary button borders, minor
  ticks) also holds 3:1 on every surface in both schemes (dark is `#72726E`,
  3.8:1 on paper); `rule` is a hairline beside a text label, never the only
  carrier of meaning. `theme.test.js` measures every pair, so a shade change
  that breaks one fails the suite. A disabled control may fall below the
  floor (`opacity-50`), as WCAG allows.
- **Focus rings stay visible on every surface.** `main.css` gives every
  control a 2px `ink` outline 2px outside it, square, following the scheme.
  There are no dark-by-design surfaces any more, so there is no per-surface
  override: a control filled with `ink` (a primary button, the selected
  segment) shows the ring past a 2px `paper` gap. A box that clips its
  children leaves room for the ring instead (the header panel scrolls, so its links sit inside padding). A box that scrolls on its own
  (a `pre` with `overflow-x-auto`, the landing table) gets `tabindex="0"`
  and an `aria-label`, so keyboards can scroll it. Don't restyle the ring
  per component.
- **State changes are announced, not only drawn.** The undo toast's
  `aria-live="polite"` region reads "Applied the X preset." (or the reset or
  machine-profile message) after a snap, and preset buttons carry
  `aria-pressed`. `IssueAnnouncer` (beside the toast in `TunerPage` and each
  setup step) reads each validation issue that appears once the values have
  settled for 600 ms, so a drag across a threshold doesn't chatter, and says
  how many are left when some clear. Issues present on mount aren't read.
- **Automated sweep.** `src/a11y.test.js` runs axe-core (devDependency) over
  every route, every setup step, and each tuner with every disclosure open, a
  preset applied, each graph tab and the drawer, and fails on any serious or
  critical violation. happy-dom has no layout, so rules that need it (colour
  contrast, label-in-name, scrollable regions) are skipped there. Rerun the
  browser pass after a visual change; the happy-dom test only guards
  structure. The browser pass runs axe in headless Edge over the built site
  (`vite preview`) in both schemes at 1280 and 375 px: every route and the
  404, every setup step, each tuner with every layer open (the show-all
  switch, every collapsed section, Learn more, every margin note's "more"
  and `[n]` toggle, a preset preview) and with the drawer open. It also
  tabs through every page and checks each focus ring: present, 3:1 against
  what is behind it, and not clipped by a scrolling or clipping box. The
  first pass (November 2026) found the invisible ring on the dark hero and
  toast, rings clipped by segmented controls and the header nav, the value
  button's name not containing its value (2.5.3), unlabelled chart
  canvases, several low-contrast texts, a scrollable `pre` keyboards
  couldn't reach, and the drawer's landmarks. The pass after the redesign
  (November 2026: 132 states, about 6,500 focus stops) found a value
  button whose name didn't contain its bracketed second reading (2.5.3,
  fixed: the name now reads the value as shown), header links whose ring
  ran under the nav's edge fade at 375 px (fixed, above) and a landing
  heading that skipped a level; after the fixes it reports no serious or
  critical violation and no focus problem in either scheme or width.
- **Dark mode follows the system** (`prefers-color-scheme`; there is no
  toggle). Light and dark are designed equally. The colour tokens in
  `ui/theme.js` are `[light, dark]` pairs; `tailwind.config.js` writes them
  to CSS variables (`--t-<name>`, light on `:root`, dark under the media
  query) and offers them as the **only** Tailwind colours (plus
  `transparent`, `current`, `inherit` and the drawer's `black` scrim), so
  components use no `dark:` variants and can't reach for another palette.
  Scoped CSS uses the variables too (`rgb(var(--t-ink))`, as the range
  slider does), text fields and selects get `paper` from a zero-specificity
  base rule in `main.css` (a `bg-*` class wins), and the browser chrome gets
  one `theme-color` per scheme. The chart palette (`ui/charts/palette.js`)
  reads the same tokens and swaps sets with the scheme. `theme.test.js`
  fails if a source uses one of Tailwind's colour families, white as a
  colour class, the removed `surface-inverse`, `focus-inset` or
  `light-palette` hooks, the old `--c-*` variables or a legacy chart tone.
- **Ink and paper, then three marks.** The page is ink on paper, divided
  by hairlines (`rule`; a section or group starts with an `ink` rule), with
  no cards, shadows, gradients or rounded corners (the round shapes are the
  "yours" dot, radio dots and the slider thumb). Primary buttons are an
  `ink` fill with `paper` text, square, at least 44px tall (Copy at least
  52px); secondary buttons a 1px `rule-strong` border; text buttons are
  underlined 3px below. Selected states (the active preset, a picked role or
  option) use `fit-tint` with a `fit` mark, a selected segment the `ink`
  fill, the current tuner in the header an `ink` underline (and, in the Tuners panel, a `fit` top rule). Colour
  otherwise means one thing each: `fit` (verdigris) marks what fits the
  visitor's machine, `mine` (ochre) appears only once the visitor changes
  something, and `error` is for blocking issues only. A warning (legal but
  odd) is `mine-text` with a warning sign; an info note is `ink-2`. Every
  place that shows where a value comes from (the slider, the card, the
  margin, the file preview, the graphs, the landing key) uses the same three
  marks, which differ in shape as well as hue: the kernel (or systemd)
  default is a thin `ink` tick, "fits your machine" a heavier `fit` bar,
  "changed by you" a round `mine` dot. Charts name a tone, never a hex:
  `ink` for the main series, `quiet` and `rule` for context, `fit` for what
  comes from the profile, `mine` for the visitor's value, `error` for
  danger; a line chart's key is `ui/charts/ChartLegend.vue`, drawn from the
  same palette.
- **Segmented or radio-style button groups** use `role="radiogroup"` plus
  `role="radio"` and `aria-checked` on each option.
- **Profile forms auto-collapse after the first apply**, or start collapsed
  when the profile is already set (shared link, setup steps). Re-tuning after
  "Edit" keeps the form open. Unapplied edits also show above the parameters,
  with an Apply button, so nobody has to scroll back up.
- **Copy and share feedback** changes the button state and announces the
  result through an `aria-live="polite"` region.
- **Three layers per parameter: the column, the margin and the drawer.**
  A setting sits in the main column between hairlines: the def's
  plain-language `title` above its sysctl name, the value (large, mono,
  underlined in `fit` or `mine`), the control and the one-line `shortDesc`.
  The control is labelled by the title and the name together. Its reasons
  sit beside it in a **margin** of numbered notes (`[1]`, `[2]`, ...), built
  from today's data in the order of the layers: the `longDesc` parts
  (`ui/descParts.js`: "What it does", then "When to change it" and "Watch
  out" where the def has them), the rule of thumb, the context note, and
  last the origin note (below). Each note shows its **first sentence**
  (`ui/firstSentence.js`) with a "more" button (`aria-expanded`) that opens
  the rest in place; the notes don't depend on the value, so dragging never
  changes their height. The margin holds **at most three notes**: the first
  two and the origin note. The card is a size container and lays itself out
  by its own width, never by tuner: from 40rem the margin sits beside the
  column, 16.25rem wide and growing towards **30rem** while the column keeps
  at least 34rem; a card narrower than that clamp's floor (52.75rem, beside
  the graph column or on a phone) holds **two notes**, the first and the
  origin note; below 40rem the notes become `[n]` toggle buttons under the
  column that open each note in place (the Tufte pattern). The margin's last
  line holds "Learn more" (the remaining notes, in place), the docs link and
  "Full reference", which opens the **drawer**: the pro reference, which
  doesn't repeat `longDesc`: the accepted range and the kernel default with
  its version note, a "Try it now" command that sets the current value
  until the next reboot (the domain's `tryCommand`: `sudo sysctl -w`, or
  `echo | sudo tee` for a sysfs file; systemd and block I/O have none, since
  their settings are directives and udev rules), the context note, the
  formula with live values, defaults by workload (named by the profile's
  option labels), and the sources. The contract suite checks every def's
  title and parts. Reactive notes that change with the value are planned
  separately (TODO.md).
- **Essential and advanced parameters.** Every def has a `tier`. Each
  section of `ParameterPanel` shows its essential cards and a "Show N
  advanced" button (`aria-expanded`) for the rest. An advanced card is always
  shown when its value differs from the profile's default (the store's
  `changedKeys`: a preset or the user moved it) or it carries an issue, so
  nothing changes out of sight. That set is recomputed on a bulk change (the
  params object is replaced: profile, preset, reset, undo) and only grows on
  an edit, so a card edited back to its default doesn't vanish under the
  pointer. A section whose essential cards the domain's `visibleKeys` drops
  for the profile shows its advanced ones, so a section is never just a
  button. The "Show all parameters" switch above the sections shows every
  card on every panel and is remembered per viewer ([§5 Viewer
  preferences](#viewer-preferences)). The contract suite checks that every
  def has a tier and every section an essential parameter. Essential means
  what most readers of that tuner should look at; the rest is for a reason
  the reader already has.
- **Filter, changed only and compact.** A tuner with 15 or more parameters
  (`hasProTools` in `ui/paramFilter.js`, counted from the domain's defs, so
  today systemd, security and network) gets three pro tools above its
  sections, next to "Show all parameters". A filter field matches every
  term of the query, case-blind and treating `.`, `_`, `-` and `/` as spaces,
  against a def's title, name, key and description text (`shortDesc`,
  `longDesc`, the rule of thumb). "Changed only" keeps the cards whose value
  differs from the profile's default (the store's `changedKeys`, sticky the
  same way as the advanced reveal). While either is on, the tiers step aside:
  matching cards show from both tiers, the "Show N advanced" buttons go,
  "Show all parameters" is disabled, every section with a match is open
  (a collapsed one comes back collapsed afterwards), and a section left
  with no card is hidden; a polite live line counts the cards
  shown, and when none is left an empty state says why, with a "Clear
  filter" button that returns focus to the field. "Compact" drops each
  card's description, margin, range and Learn more, and the section
  summaries (the name opens the
  drawer, which keeps the reference) and puts name, value and control on one
  row from `sm` up; on a phone the control wraps under the name and value.
  Issues and "Back to X" stay. The filter text never enters the shared link, and
  only "Compact" is remembered ([§5 Viewer
  preferences](#viewer-preferences)). No keyboard shortcut opens the filter.
- **Where a value comes from.** The origin note, always the margin's last,
  says it in words: "Kernel default 60, which also fits your machine.",
  "Kernel default 60. Fits your machine: 10." or, once the value moved, "You
  moved this from 10 to 30. Kernel default 60." in `mine-text` (the domain's
  `defaultLabel` names whose default it is, "systemd default" for systemd,
  and the drawer uses it too), with the def's `kernelDefaultNote` under it,
  since many defaults scale with RAM or differ by distribution and the
  number alone would claim too much. Only its words change, so the card
  keeps its height mid-drag. When the value differs from the profile's
  default (the store's `profileDefaults`), a **"Back to X"** button beside
  the value sets it back, X being the profile's value (it is `invisible`
  otherwise, keeping its space and leaving the tab order); it is an ordinary
  edit, so it needs no undo. A slider is a printed scale with major and
  minor ticks and numbers, a 24px `ink` thumb with a `paper` ring (44px hit
  area, `grab` cursor) and an `ink` fill up to it, and carries the three
  marks inside the range: the default tick, the fit bar and, once the value
  differs, the "yours" dot above the scale, which never replaces the thumb.
  Each group's header shows the marks' key (`MarkKey`). `def.zones` are
  `{ label, min, max }` and the zone holding the value is emphasised; a zone
  that depends on another parameter ("below MemoryMax") has no bounds. The
  zone labels stay a list under the track rather than under their stretch:
  most stretches are too narrow for their label (swappiness 0-10 is 5 % of
  the track, a weight's 1-50 under 1 %).
- **Export steps.** Above the output, `InstallSteps` numbers what to do
  with it: save the file (with `mkdir -p` for the systemd drop-in folders,
  which may not exist yet), apply it now, check one value, and, set apart,
  "If something goes wrong": delete the file, then reload systemd or reboot,
  since the kernel keeps values already applied until it restarts. Each
  command has its own copy button. The guided setup shows the same steps for
  every included file at once. Under the steps a toggle lists the values that
  differ from the stock defaults (`def.kernelDefault`), with both values, for
  a pro to review the change before it goes on a machine. The commands come
  from `installSteps` in `core/output/installSteps.js`, which works from the
  files alone: the install folder says which kind of file it is (sysctl.d,
  tmpfiles.d, udev rules, a systemd manager or unit drop-in), and the check
  command takes the first name the file sets (a sysctl key, a `/sys` path, a
  udev attribute, a systemd directive), so no tuner supplies steps of its own.
  `undoComment` prints the same undo steps into each file's how-to block, so
  every file says how to undo it, not only the security tuner's.
- **Reset needs no confirmation.** It only recomputes the defaults, and
  `UndoToast` offers to put back what a reset or a preset snap replaced (the
  store's `undoState`, one step deep; any other edit clears it, and it is never
  part of the shared link). The toast pauses its timer while hovered or
  focused, closes on Escape, and returns focus to the control that triggered
  the snap. A reset control sits at the top of the tuning panel as well as in
  the export section.

## 8. Copy conventions

- **No em dashes in displayed text.** This covers parameter descriptions,
  presets, validation messages, templates, labels, chart captions, and the
  generated config. Use a comma, colon, semicolon or parentheses instead. En
  dashes in numeric ranges (`0–200`) are fine. Code comments and docs are
  exempt.
- **A quiet voice.** No exclamation marks, no jokes in controls, no emoji,
  and no icons as ornament. Warnings carry a sign (`!` or the warning icon)
  as well as their colour, and a step or note state is said in words ("2
  changed by you", "Skipped", "5 to check"), never by colour alone. The
  footer's author note is the maintainer's approved text, signed `jan-hxm`,
  and is not rewritten; the colophon's testing claim says only what
  `vm/README.md` covers, kept as data in `ui/layout/testedOn.js`, which
  `testedOn.test.js` checks against `vm/lib/images.mjs`.
- **Glossary terms.** A term that recurs across tuners (page cache,
  anonymous memory, reclaim, watermark, kswapd, dirty page, writeback, OOM
  killer, cgroup, namespace, eBPF, conntrack, file descriptor, THP, huge page,
  TLB, NUMA) is defined once in `src/ui/glossary.js` and marked in copy as
  `[[label]]`, whose id is the label in kebab case (`[[OOM killer]]` is
  `oom-killer`), or `[[label|id]]` when the wording differs
  (`[[dirty pages|dirty-page]]`). `GlossaryTerm.vue` renders it as a button
  (`aria-expanded`, `aria-controls`) that shows the definition on its own line
  under the text; a second press or Escape hides it, and it is never a
  `title` tooltip. Mark a term at its first appearance in each card's
  `longDesc` (or About block), not every occurrence, and not where the card
  is itself about that term. Don't mark terms in the tuner intro, profile help
  or anything else inside a label or button. Definitions are plain text with
  no markup. The contract suite fails on an id the glossary doesn't have, and
  `glossary.test.js` on an entry no copy uses.
- The site, including the legal pages, is in English. Statute references keep
  their German citation form: `§ 5 TMG`, `Art. 6 (1) (f) GDPR`,
  `§ 25 (2) (2) TTDSG`. Any material change to the privacy policy bumps its
  "Last updated" line.

## 9. Code organization and reuse

> **Status: migrated.** The one remaining gap is listed under "Tuner folder".

**Goal:** adding a tuner touches its own folder plus one registry entry. Most
of the effort should go into *data* (parameter defs, presets, docs and copy),
not plumbing. Nine tuners are shipped and about one is planned, so anything
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
  setup/       the guided setup, a composition root (§5 "Guided setup")
  static/      the static page text the build writes (§5 "Routes, SEO and build")
```

- `tuners/<id>` may import `core` and `ui`.
- `ui` may import `core`.
- `core` and `ui` never import a tuner. The one exception is
  `tuners/registry.js`, which is plain data (the header nav reads it).
- `core` is plain JS: no `vue` import and no `.vue` files.
- Tuners never import each other. When two tuners need the same thing,
  promote it to `core`/`ui`.
- `static` is a composition root like `setup`: it reads tuners only through
  `tuners/domains.js` and the registry, may import `core`, `routes-meta.js`
  and plain-JS `ui` modules (`richText.js`, `glossary.js`, `descParts.js`,
  `needThis.js`, `installGuide.js`, `controls/meta.js`), never `vue` or a
  `.vue` file, and nothing in `src/` imports it: only the build (and tests)
  does, so the SPA bundle doesn't change. Text the page and the static layer
  both show lives in those plain-JS modules, never copied.
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

There is no `store.js` or `View.vue`: the router renders the shared
`TunerPage` for the domain, and the store comes from `useTunerStoreFor`. A
tuner would get its own view only if the shell's slots genuinely can't
express the page.

Where today's tuners still differ from this target: swap and systemd keep a
`formatting.js` for the card's display text. Shared tests that need more than one
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
  integers, for `tcp_rmem` or `kernel.sem`). The network tuner is the first
  with enum and tuple defs. An enum option may print as a different
  `sysctlValue`, so state and links keep a name (`reboot`) for a key whose
  values are numbers (`kernel.sysrq = 176`). An enum's range may list the
  `options` the profile allows, for options a kernel may lack (BFQ is a
  module Ubuntu's cloud kernel doesn't ship): `clamp` holds the value to them
  and the `select` control lists only them. A tuple's range may carry `elements`, one range
  per element (`elementRange(range, i)`), when the fields take different
  values: `kernel.sem`'s SEMMNI stops at 32768 while SEMMNS goes to
  2147483647. The def then lists them in `elementLimits`, which the drawer
  prints per field. The type owns four operations:
  - `restore`: strict parsing of untrusted URL input; enums accept only listed
    values. `decodeState` rejects the link when it returns `undefined`.
  - `clamp`: used by `restoreState` and `setParam`.
  - `format`: the emitted text, which throws on a value of the wrong shape.
    The card's display text stays the tuner's `formatValue`.
  - `equals`: used by `differingKeys` for the preset diff, the "customised"
    flag and the card's origin note and "Back to X".

  Serialization, the store, the preset logic and the config writers call the
  type and never assume a number. This keeps the
  [untrusted-input rule](#shareable-url-state) in one place as types are added.
- **Controls** (`ui/controls/`). `def.control` names an entry of the
  registry in `ui/controls/index.js`: `slider`, `toggle`, `segmented` and
  `select` and `tuple` (one labelled number input per element, from
  `def.tupleLabels`; the range holds each element). Each entry lists the
  value types it can edit (the contract suite checks every def against it) and
  whether the card offers click-to-type and prints the range. `ParameterCard`
  keeps the frame: header, badges, the value, issues and the expandable text.
  Only the input is swapped. Every control takes `def`, `value`, `range`,
  `labelId` and `valueText` and emits `update`; the store clamps the value by
  type. `segmented` stands for the values `0..n-1` of `def.segmentLabels` and
  offers only those inside `range`, so a profile can narrow the choice (the
  security tuner drops `unprivileged_bpf_disabled = 2` on kernels before
  5.13). The slider keeps its
  [uncontrolled pattern](#range-slider-uncontrolled-with-external-sync) inside
  `SliderControl.vue`.
- **Profile** (`profile.js`). One declarative field list drives the generic
  `ProfileForm`, the default profile *and* the restore schema, so the form and
  the URL validation can't drift apart. Field types (`core/profile.js`):
  `number` (min, max, the `step` values snap to, an optional spinner
  `inputStep`, quick picks), `choice` (options with optional notes, shown as a
  `select`, radio `cards` or `segmented` control) and `text` (a RegExp
  `pattern`; a `null` default makes it optional). Layout and behaviour are data
  too: `half` pairs fields in a row, and `disabledWhen` greys one out. The
  profile also names the card title, apply label and a `summary(hw, label)`
  for the collapsed line, as rich-text parts. `defineTuner` checks the list
  (unique keys, known shapes, a default the field's own rule accepts) and the
  contract suite checks the picks and the summary. Shared pick lists and
  ceilings stay in `ui/profile/fieldOptions.js`. The RAM field is a machine
  field, so it lives in `core/machine.js`, and `fieldOptions.js` re-exports it. A profile the field
  list can't express uses the `profile` slot of `TunerPage`; Block I/O
  avoided needing one by making a profile one kind of disk.
- **Page shell** (`ui/TunerPage.vue`). Renders the whole page from the
  domain alone: profile form, title block, step chain, the four steps, graph tabs, ad
  slot, about section, info drawer, and the mobile impact bar with its spacer.
  It has a `profile` slot for a profile the field list can't express. This
  keeps the [§7](#7-uiux-and-accessibility-conventions) guardrails in one
  place.
- **Graphs are optional.** A tuner with no meaningful simulation passes no
  graph tabs. Security hardening is mostly a checklist, for example. The tune
  step then uses the full width, and the impact bar and its spacer are
  hidden (even if the simulation has an `impactSummary`). The domain lists its
  tabs as `graphTabs` (`{ id, label, component, blurb }`) and its `simulation`
  module. `defaultTab` defaults to the first tab and is `null` without tabs;
  `defineTuner` rejects a `defaultTab` that names no tab. Charts render
  inside `ui/charts/ChartFrame.vue`, which takes a required `ariaLabel` and the
  height, and they take colours from `ui/charts/palette.js`. Simulations name
  a palette `tone` (such as `'danger'`) rather than a colour. The palette is
  reactive and switches to its dark set with the system scheme, following the
  same mapping as the classes so the legends match (`palette.test.js` checks
  both sets against Tailwind). Chart.js copies its defaults into a chart when it
  builds it, so `ChartFrame` rebuilds its chart when the scheme changes, after
  `chartSetup.js` has set the tick and grid colours. `palette.test.js` also
  fails on a colour literal in a tuner's charts or `simulation.js`.
- **Simulation** binding. A tuner exports pure functions from
  `simulation.js`, and one generic `ui/useTunerSimulation(store, simulation)`
  turns them into computeds keyed by function name. Callers pass the module
  (`import * as simulation`): `TunerPage` passes the domain's module with its
  store for `impactSummary`, and charts pass `useActiveTuner()`. There are no
  per-tuner composables.
- **Config output** (`core/output/`). `generateConfig` returns a list of files,
  `{ path, content }[]`, built with the writers:
  - `files.js`: `configFile(path, lines)` checks the path against the §10
    rule and trims trailing blank lines; `combineFiles` joins a list for the
    output panel.
  - `comments.js`: `commentLine` (refuses line breaks), rules, section
    headers, file banners, and the date and preset summary for the header
    block.
  - `sysctlFile.js`: `sysctlConfig` prints each value with its def's type,
    and `sysctlLine` holds it to plain space-separated tokens. A def's
    `alsoSets` names more keys written with the same value, such as the
    `conf.default` twin of a `conf.all` key; they are constants in the def,
    like `sysctlName`.
  - `iniDropIn.js` (systemd): `iniSection` and `iniDirective`, with values
    limited to plain tokens.
  - `tmpfilesFile.js` (sysfs values at boot): `tmpfilesConfig` and
    `tmpfilesWrite`, which print only `w <path> - - - - <value>` lines. The
    path is a def's `sysfsPath`, held to `^/sys(/[a-z0-9_]+)+$`, and the
    value a plain token with no `%` (a tmpfiles specifier) or backslash.
    `sysctlConfig` and `tmpfilesConfig` share the section loop in
    `sections.js`. The huge pages tuner is the first user.
  - `udevRules.js` (per-device sysfs, Block I/O): `udevConfig` and
    `udevAttrRule`, which print only `==` match clauses (on `ACTION`,
    `SUBSYSTEM`, `KERNEL`, `ENV{...}` or `ATTR{...}`, glob values with no
    quote, `$` or `%`) and one `ATTR{<attr>}="<value>"` write. The match
    clauses are constants per device class and the attribute a def's
    `udevAttr`; no other assignment key can be written.
  - `installSteps.js`: `installSteps(files)` for the export steps and
    `undoComment(paths)` for each file's undo note ([§7 Export
    steps](#7-uiux-and-accessibility-conventions)).

  A writer throws rather than emit a malformed line, so a bad value fails the
  contract fuzz tests instead of reaching a file. Each file of a multi-file
  tuner opens with a `# =====` banner naming its path. `ConfigOutput` shows
  the files combined and copies that text; each file downloads on its own,
  under the last part of its path (so the block I/O file is named after its
  kind of disk). The store's `configFiles` getter builds the files from the
  active preset, for this panel and the guided setup alike. Every emitted value goes through its def's value
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
- `title`, plus `blurb` and `keys`, which the static page text and
  `llms.txt` print for each tuner
- for live entries: `path` (`/<id>`), `navLabel`, `route` metadata, the
  `setup` block ([§5 Guided setup](#guided-setup)) and `question`, the one
  question the tuner answers ("Does it swap too early, or freeze when memory
  runs out?"), which leads the landing table's row. The wording is approved
  by the maintainer; `registry.test.js` checks every live entry has one,
  ending with "?" and without an em dash. Planned entries have none.
- for live entries, the landing table's facts: `settingCount` (the domain's
  `parameterKeys.length`) and `writes` (the distinct file paths its
  `generateConfig` writes for the default profile, in order). They are
  derived values stored as data so the landing page and the static text need
  no domain module for them. A guard in `contract.test.js` ("registry facts")
  loads every domain and checks both against what it produces; its failure
  names the entry and field to update and the value to put there, so a new
  setting or a renamed file can't leave the table stale.

Array order is the landing, nav and guided-setup order. It must stay plain data with no Vue
or `@/` imports, because the postbuild script reads it under Node. The router,
`routes-meta.js`, the landing cards, the header nav and the sitemap all derive
from it. `registry.test.js` checks the shape and that the live ids match
`TUNER_DOMAINS` and `TUNER_VIEWS`.

A `planned` entry is only named on the landing page ("Coming next") and gets no route. That
makes the [no-thin-pages rule](#6-adding-a-tuner) mechanical rather than
something to remember. The lazy `import()` of each live tuner's domain module
stays in `router.js` (`TUNER_DOMAIN_LOADERS`, keyed by id), next to the
registry; `TUNER_VIEWS` wraps each one in a route component that renders
`TunerPage`. That keeps each tuner in its own chunk.

### Contract tests

`defineTuner()` fills in the defaults of optional hooks and, in dev and tests,
asserts that the required fields exist. One shared test suite then iterates
over **every** registered tuner and checks:

- Every key has a def with a docs URL, a description and a valid control/type.
- The derived defaults lie within `rangeFor` for the default profile, for
  each workload, for each option of every other choice field, and for each
  `samples` value of a text field (an old kernel version) with every
  workload. Every preset names only known keys with values in range on the
  default profile; elsewhere `presetParams` (what `applyPreset` uses) holds
  it to the profile's range, so a zram preset's swappiness 133 reaches a 4.15
  kernel as 100.
- `encodeState` → `restoreState` round-trips. A tampered hash (out-of-range
  value, unknown preset, injected profile string) is rejected or clamped.
- The defaults and every preset generate a config with no blocking issues,
  and every emitted value comes from the def's type formatter.
- No displayed string (defs, presets, validation messages, about content, the
  generated config) contains an em dash ([§8](#8-copy-conventions)).
- Each live tuner's page mounts without console errors.
- The registry's `settingCount` and `writes` for the tuner equal its
  `parameterKeys.length` and the paths its default config writes
  ([Registry](#registry)).

A new tuner gets this coverage for free. Its own `*.test.js` files cover only
its math and its cross-parameter rules.

The suite is `src/tuners/contract.test.js`, next to
`src/tuners/configSnapshots.test.js`, which snapshots the config for every
profile's defaults and every preset so each migration step can prove
byte-identical output. The page-mount check is `src/tuners/views.test.js`.
The type-formatter check covers sysctl lines, tmpfiles `w` lines, which
the grammar check accepts only for a def's `sysfsPath`, and udev rules,
accepted only as `==` matches and one write to a def's `udevAttr`; ini values are
composed by the tuner from typed values and held to plain tokens by the
grammar check.
`src/ui/ParameterCard.enum.test.js` covers the enum path (select, clamp,
restore) with a fixture domain. The suite is type-aware: the grammar check
accepts space-separated tuple values, the clamp check runs per tuple element,
an unlisted enum option or a tuple of the wrong length rejects the link, and
the fuzz builds edge values of each def's own shape so they reach the clamp.
The page-mount check stubs every graph tab's component, by its SFC name.
A section with no visible key for the profile is not rendered.

### VM tests

The unit tests prove we generate what we intend; `npm run test:vm` proves it
does what we claim. Each `vm/*.vm.test.js` boots a throwaway QEMU VM from a
distribution cloud image (Debian 11 and 13, Ubuntu 18.04 and 24.04, Fedora),
applies every sysctl tuner's file for each workload and preset with
`sysctl -p`, reads every key back, applies every block I/O rules file
through `udevadm trigger` on an NVMe drive, a SATA SSD, a SATA hard disk and
virtio disks, loads every systemd drop-in through
`daemon-reexec` with no PID 1 warning, reboots, and probes the security
claims as an unprivileged user (perf, bpf, kallsyms, `%pK`). They take 10 to
20 minutes, need QEMU, and run by hand rather than in CI; run them after
changing a range, a default, a preset or an apply instruction.
[vm/README.md](vm/README.md) has the setup, and `vm/lib/images.mjs` records
what each distribution was measured to do. A claim about kernel or distro
behaviour goes in only once a VM has shown it; facts found that way so far:

- `watermark_scale_factor` takes up to 1000 before 5.17. Swappiness above 100
  needs 5.8.
- `kptr_restrict = 0` hashes `%pK` from 4.15, not 5.2.
- Before 4.19 the TCP conntrack keys come with `nf_conntrack_ipv4`.
- systemd-sysctl expands `conf.*` globs from systemd 245; procps from 4.0.
- NetworkManager resets each managed interface's `rp_filter` to 2, and apport
  (Ubuntu) resets `fs.suid_dumpable` to 2 at start, both after sysctl.d runs.
- Debian 11 and Ubuntu 18.04 kernels carry `unprivileged_bpf_disabled = 2`
  before 5.13, and Ubuntu 18.04 blocks perf at 3 like Debian.
- systemd 258 removed `DefaultCPUAccounting=`; on cgroup v2 it was a no-op,
  so it is written for cgroup v1 only. `MemorySwapMax=` works on v2 only, and
  systemd 237 rejects 0, so it is left out on v1.
- systemd 240+ starts `fs.file-max` at 9223372036854775807; Ubuntu 18.04
  (237) keeps the kernel's ~10% of RAM in KiB. Writing 0 locks every
  unprivileged process, SSH logins included, out of opening files.
- `fs.nr_open` starts at 1073741816 on Debian 13 and 2147483584 on Fedora 43,
  1048576 elsewhere. A unit whose `LimitNOFILE=` is above it gets its limit
  cut down to it, unless `fs.nr_open` is below the limit PID 1 runs with
  (lowered after boot): then the unit fails with status 205, and below
  1048576 so does every unit at the default 524288. `LimitNOFILE=infinity`
  takes the value PID 1 read at boot or its last `daemon-reexec`.
- The inotify watch default follows RAM on 5.10 updates and newer (about
  1330 bytes per watch, 1% of RAM, 8192 to 1048576); 4.15 has 8192.
- Debian kernels start THP `enabled` at `always`, Ubuntu and Fedora at
  `madvise`; `defrag` is `madvise` everywhere. `vm.max_map_count` starts at
  1048576 on Debian 13, Ubuntu 24.04 and Fedora 43 (from a distro
  sysctl.d file) and 65530 on the older two, accepts up to 2147483647, and
  at 0 no process can map memory, SSH logins included.
- A tmpfiles.d `w` line sets `/sys/kernel/mm` both from
  `systemd-tmpfiles --create` and at boot, from systemd 237 on; a line for a
  file the kernel lacks is skipped with exit 0 and boot stays clean. KSM
  is built in and off on every image.
- Writing THP `enabled` as `always` or `madvise` (even the value it already
  has) makes khugepaged raise `vm.min_free_kbytes` to its floor if lower
  (67584 on the 3 GiB test VMs); `never` and the pool keys don't. At boot
  systemd-tmpfiles runs after systemd-sysctl, so a lower value from the
  swap tuner holds only with THP `never`. Both tuners say so.
- The System V IPC keys start at the same values on every image (`shmmni`
  4096, `kernel.sem` 32000 1024000000 500 32000, `msgmni` 32000, `msgmax`
  8192, `msgmnb` 16384, `shmmax` and `shmall` 18446744073692774399), and
  no distribution file sets them. `shmmni`, `msgmni` and SEMMNI reject
  values above 32768 from 5.10 on (4.15 takes them); the other fields,
  `msgmax` and `msgmnb` take up to 2147483647. A `kernel.sem` line with
  three fields leaves the fourth as it was. A new IPC namespace
  (`unshare -i`, every container) starts at the kernel defaults, not the
  host's values. With `shm_rmid_forced = 1` a segment whose creator exited
  unattached is removed at once.
- `kernel.pid_max` starts at 32768, or 1024 per possible CPU when that is
  more (40960 with 40), and at 4194304 wherever systemd 243+ ships
  `50-pid-max.conf` (all but Ubuntu 18.04). `kernel.threads-max` is about
  RAM / 128 KiB, a few percent under, and accepts any value down to below
  the running threads, at which point nothing forks, SSH included.
  systemd's `DefaultTasksMax` is 15% of the smaller of the two, rounded
  down and read again on `daemon-reexec`: below 512 GiB of RAM `threads-max`
  decides, about 19660 with 16 GiB. The `user.max_*_namespaces` start at half of it.
- `kernel.sysrq` starts at 438 on Debian, 176 on Ubuntu and 16 on Fedora
  (systemd's `50-default.conf`); root's `/proc/sysrq-trigger` ignores it.
  The console loglevel starts at 7, 4 on Ubuntu (`10-console-messages.conf`);
  `kernel.printk` takes any integers, and a line with fewer fields leaves
  the rest unchanged. A panic with `kernel.panic = 3` reboots about 3 s
  later. The key quota is 200 keys and 20000 bytes per non-root user
  everywhere. Fedora's kernel has no hung-task detector
  (`hung_task_timeout_secs` is missing).
- The CFS sysctls (`sched_min_granularity_ns` and siblings) exist on 5.10
  and 4.15 only. `sched_autogroup_enabled` changes CPU shares only for
  tasks in the root CPU cgroup: under systemd with the cpu controller on
  (Debian 13, Ubuntu 24.04, Fedora 43) a session's share was the same with
  it on or off. RT throttling (`sched_rt_runtime_us`) gave inconsistent
  results under WHPX, so no claim rests on it.
- Block queues (an NVMe drive, a SATA SSD and hard disk on AHCI, virtio):
  a device with one hardware queue starts at `mq-deadline`, several at
  `none`, except on Debian's cloud kernels (mq-deadline is a module there,
  so every disk starts at `none`) and Fedora, whose systemd sets `bfq` on
  every `sd*` disk (`60-block-scheduler.rules`). Writing `bfq` or `kyber`
  loads the module; Ubuntu 24.04's cloud image has neither, and Debian 11's
  cloud kernel has no AHCI driver. `nr_requests` takes 4 to 2048 with a
  scheduler (below 4 becomes 4) and up to the queue depth without one (32
  SATA, 256 virtio, 1023 NVMe); a scheduler switch resets it to twice the
  depth, at most 256. `read_ahead_kb` takes up to 4294967292 in 4 KiB steps
  and starts at 128, on Fedora 43 at 8192 for virtio and 256 for the hard
  disk. `nomerges` takes 0 to 2 (3 reads back as 1), `rotational` 0 or 1;
  changing `rotational` at runtime leaves `wbt_lat_usec` as it was (75 ms).
  udev logs a refused `ATTR{}` write ("Failed to write") and goes on with
  the next rule, both on `udevadm trigger` and at boot. Kernel 4.15
  (Ubuntu 18.04) runs SATA disks on the legacy layer (noop, deadline, cfq)
  and its cloud image has no multi-queue scheduler at all.
- `vm.page-cluster` starts at 3 everywhere (no distribution sets it, not
  even Fedora with its default zram swap) and takes 0 to 31, 5.10 and 4.15
  more. Reading back 256 MiB swapped out by one process, nearly every page
  came through readahead from a swap file at 3 and none at 0. From zram the
  kernel skips readahead for a page one process maps whatever the setting;
  pages shared after a fork were read ahead at 3 and not at 0. The Ubuntu
  cloud kernels have no zram module. systemd swaps a zram `.swap` unit back
  on within seconds of a `swapoff`, so the test swaps to its own device at
  the top priority instead.
- The VM guests have no cpufreq (QEMU exposes no P-states: `acpi-cpufreq`
  refuses to load and `cpu*/cpufreq` is missing), so the CPU frequency
  tuner can't be measured there.
- `user.max_user_namespaces` starts at half of `kernel.threads-max` and takes
  0 to 2147483647 on every image. At 0 nobody can create one, root included
  (`ENOSPC`), so systemd units with `PrivateUsers=yes` fail with 217/USER:
  uuidd on Debian and Ubuntu (`uuidgen` falls back to generating UUIDs
  itself), chrony-wait on Fedora (disabled by default). A boot with it at 0
  leaves no failed unit on any image. Debian's
  `kernel.unprivileged_userns_clone` is in every Debian and Ubuntu kernel
  tested, not Fedora's; at 0 it stops only unprivileged users. Ubuntu 24.04
  sets `kernel.apparmor_restrict_unprivileged_userns = 1`: users can create
  one but not write its uid map. The key arrived in 4.9, so the legacy
  kernel option starts there.

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
   that means arbitrary sysctls; in udev rules, tuned profiles and
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
  out of scope. tmpfiles.d output is `w` lines to constant `/sys` paths only:
  no other line type, which could create, copy, link or remove files. udev
  output is `==` matches plus one `ATTR{}` write per rule, nothing else.
- **Paths are constants.** Output file paths and download names are fixed per
  tuner, match `^/etc/[a-z0-9._/-]+$` and contain no `..`. Apply commands are
  fixed text with only those paths interpolated. The export steps'
  check commands also name what a file sets, read back out of its content
  against a strict pattern (a sysctl key, a `/sys` path, a udev attribute or
  subsystem, a systemd directive or unit) and never a value; the contract
  suite holds every step to a program and plain arguments.
- **The drawer's "Try it now" command** is the one place a value from state
  appears in a shell command. `sysctlTryCommand` and `sysfsTryCommand` (in
  `core/output`) build it from the def's name or constant `/sys` path and the
  value as its type formats it, and run the same name, path and value checks
  as the file's lines, so the value is plain tokens with no shell syntax. The
  contract suite holds every command to those two forms.
- **Shared-link restore stays strict** (§5 Shareable URL state). A change that
  relaxes a schema, a range or the preset-id check is a security change.

### Rules for the page, the build and the deploy

- No `v-html`, `innerHTML`, `eval`, `new Function`, or `href`/`src` bound to
  state. External links are literals in data files. One accepted trade-off:
  a guided-setup step links to its tuner page as the registry's constant
  path plus `#` and that tuner's `encodeState` output (lz-string's URI-safe
  alphabet), so the link always stays on this site and the page it opens
  restores the hash as strictly as any shared link.
- No new network request, cookie, storage key or third-party origin (script,
  style, font, frame) without a Design.md decision and a privacy policy update.
- **Fonts are self-hosted, never loaded from a font service.** Google Fonts
  (or any font CDN) would be a third-party origin that sees every visitor's
  IP address, which needs a privacy policy change (a German court held
  embedding Google Fonts without consent to breach the GDPR, LG München I,
  2022). The redesign's typefaces, Host
  Grotesk (one variable file, wght 400 to 600) and Fragment Mono (400), both under the SIL Open
  Font License, are committed as Latin woff2 subsets in `src/assets/fonts/`
  with their `OFL.txt` and served from this origin: 43,288 bytes of woff2
  in all (Host Grotesk 19,436, Fragment Mono 23,852), no
  npm font package. Host Grotesk was subset from the google/fonts variable TTF
  (commit 0b58fb3) to the same Latin range, wght axis clamped to 400-600 with
  fontTools (the fontsource latin file drops the arrows and maths signs the
  site uses). `theme.test.js` fails if `main.css` names a font origin
  or a face without `font-display: swap`.
- `public/_headers` only gets stricter. The missing `script-src` CSP is the
  one accepted trade-off (§5 Hosting and deploy).
- New dependencies need a reason a few lines of our own code can't cover.
  Check maintenance, install scripts and transitive weight; `package-lock.json`
  is committed with the change.
- Workflows keep least-privilege `permissions`. Secrets are referenced only
  in the step that needs them and are never echoed. Actions are pinned to a
  commit SHA with the tag in a comment; Dependabot (`.github/dependabot.yml`)
  opens the PRs that bump them.

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
