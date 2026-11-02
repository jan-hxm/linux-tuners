# TODO

The single list of open work. When an item is done, record the outcome in
[Design.md](Design.md) if it changes how the project works, then delete the item.
Finished items are not kept here. Account, revenue and security details are kept
in the local, gitignored `PRIVATE.md`, not here.

## 1. Tuners, in build order

Each one is a new domain module following [Design.md §6](Design.md#6-adding-a-tuner).

sysfs-based. Global `/sys` values can use the tmpfiles.d writer the huge pages tuner added, per-device ones the udev writer the block I/O tuner added:

1. [ ] **CPU frequency & power**: `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).

## 2. UX

- [ ] Use one grid for the landing page's available and coming-soon cards (currently 2 vs 3 columns).
- [ ] Give the top nav an active state on the landing page.

## 3. Engineering

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.
- [ ] Tests: `ChartFrame.test.js` once failed in a full `npm test` run with "document is not defined" (happy-dom missing), then passed alone and in three full runs. Possibly the node-environment override in `src/ui/theme.test.js` sharing a worker with the happy-dom files under `src/ui/**`; if it recurs, move the node-only tests out of `src/ui` or give `ChartFrame.test.js` an explicit `@vitest-environment happy-dom`.
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
