# TODO

The single list of open work. When an item is done, record the outcome in
[Design.md](Design.md) if it changes how the project works, then delete the item.
Finished items are not kept here. Account, revenue and security details are kept
in the local, gitignored `PRIVATE.md`, not here.

## 1. Tuners, in build order

Each one is a new domain module following [Design.md §6](Design.md#6-adding-a-tuner).

sysctl-based (output: `/etc/sysctl.d/`):

1. [ ] **Huge pages & memory layout** (the rest of `vm.*` + THP/KSM sysfs): `nr_hugepages`, `nr_overcommit_hugepages`, `max_map_count`, `mmap_min_addr`, `zone_reclaim_mode`, `page-cluster`; THP and KSM via `/sys/kernel/mm/`. Mixed output (sysctl.d + sysfs/tuned).
2. [ ] **System V IPC & shared memory**: `kernel.shmmax`, `shmall`, `shmmni`, `sem`, `msgmni`/`msgmnb`/`msgmax`.
3. [ ] **Kernel & scheduler** (`kernel.*`, `user.*`): exposed `sched_*` tunables, `pid_max`, `threads-max`, panic/printk behaviour, `user.max_*_namespaces`.

sysfs-based (these need a non-sysctl apply model: udev rules or a `tuned` profile):

4. [ ] **Block I/O & storage** (`/sys/block/<dev>/queue/*`): `scheduler`, `nr_requests`, `read_ahead_kb`, `rotational`, `nomerges`. Per device.
5. [ ] **CPU frequency & power**: `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`.

## 2. UX

- [ ] Show the preset "what would change" diff somewhere other than a native `title` tooltip, which is invisible on touch and unreachable by keyboard. `src/ui/PresetSelector.vue`
- [ ] Add an "Undo" toast after a reset or a preset snap, so an accidental one is recoverable.
- [ ] Make the "Jump to" step chain highlight the active section (scroll-spy).
- [ ] Add a way to jump from the mobile impact bar to the full `GraphPanel`.
- [ ] Dark mode. The range-slider colours are hardcoded hex in `ui/controls/SliderControl.vue` scoped styles and need theming first.
- [ ] Use one restrained accent colour (sky-500, already used for links and charts) for primary CTAs and active states.
- [ ] Use one grid for the landing page's available and coming-soon cards (currently 2 vs 3 columns).
- [ ] Give the top nav an active state on the landing page.

## 3. Engineering

- [ ] `ConfigOutput`: a download per file for multi-file tuners (systemd), instead of one combined `.conf`.
- [ ] Tests: `ConfigOutput` flow (textarea matches the generator, copy calls the clipboard API, blocked state).
- [ ] Automated accessibility sweep (axe-core / Lighthouse): focus visibility on the dark hero, a live-region announcement when a preset is applied or validation fires, and a full WCAG AA contrast pass.
- [ ] Bundle: re-measure (last measured before `/systemd`), drop unused Chart.js parts (check whether `Filler` is needed), lazy-load chart components per tab.

## 4. Launch & SEO

- [ ] Replace the SVG OG image with a real 1200×630 PNG (or per-route images); update `OG_IMAGE_PATH` in `src/routes-meta.js`.
- [ ] Check link previews on X/Twitter, Discord, Slack and LinkedIn.
- [ ] Per-route `<lastmod>` in the sitemap from `git log -1 --format=%cI -- <view file>` instead of the build date. `scripts/generate-static-routes.mjs`
- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.

## 5. Guided system setup

Once most tuners exist. Design it in Design.md first.

- [ ] Landing page: explain the bigger picture (which tuners matter for which machine, and in what order) and lead the user through them as steps, most important first.
- [ ] All-in-one quick configuration: enter the shared profile once (RAM, workload, kernel, systemd version), then walk through each tuner as a step that links to its full page, and end with every file for the whole system. It has to respect the cross-tuner limits, such as `fs.nr_open` against systemd's `DefaultLimitNOFILE` hard limit. Tuners don't import each other ([Design.md §9](Design.md#9-code-organization-and-reuse)), so the shared profile and the combined output belong in `core`/`ui`.

## 6. Legal

- [ ] Have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
