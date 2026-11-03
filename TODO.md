# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Launch & SEO

Cheap, and nothing else pays off until people can find the site and shared links look right.

- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.
- [ ] After the next deploy, check the link cards in an Open Graph preview tester (opengraph.xyz or metatags.io) for `/` and one tuner page. No social accounts needed.

## 2. UI/UX: beginners and pros

From the UI/UX audit of November 2026 (desktop 1280 px, phone 390 px). The site serves two readers: a beginner who wants safe values and to understand them, and a pro who knows the knobs and wants the file fast. On `/swap` the first parameter sits 1600 px down on desktop and 2560 px down on a phone. The layering model and the essential and advanced tiers are in Design.md §7; the items below build on them. `/setup` renders the same cards, so it pays off twice.

- [ ] **Faster path to the sliders.** When a page opens from a shared link, and in every `/setup` step, collapse the profile form to its summary line straight away, since the profile is already set. Unapplied profile edits only show as "Unsaved changes" at the end of the form: repeat a notice with an Apply button at the top of the tune step.
- [ ] **"Do I need this?" on each tuner page.** A short box under the hero, from data that already exists (the registry's `setup.why` and the tuner's machine roles): which roles it matters for, and when the defaults are fine. Beginners skip what they don't need, and pros lose nothing.
- [ ] **Landing page.** The ad sits between the hero and the role picker, which pushes the picker to about 600 px down on a phone: move it below the tuner grid. Replace "URL-encodable state for sharing" with three plain trust points (runs in your browser and sends nothing, every value cites its source, the output says how to apply and undo). Drop the "Available" badge, which every live card carries. The hero's main button is now "Start guided setup".
- [ ] **Tools for pros.** On tuners with 15 or more parameters (security, network, systemd), a filter field above the sections (name or description) and a "Changed only" switch. A compact density that hides the descriptions and shows name, value and control on one row each. No global keyboard shortcuts (§7).
- [ ] **Glossary.** Terms that recur across tuners (page cache, anonymous memory, cgroup, OOM killer, watermark, conntrack) defined once in a shared data file and marked in the copy with a `RichText` syntax, so a click or tap opens the definition inline. Not a `title` tooltip.

## 3. Quality

- [ ] Automated accessibility sweep (axe-core / Lighthouse): focus visibility on the dark hero, a live-region announcement when a preset is applied or validation fires, and a full WCAG AA contrast pass.
- [ ] Bundle: re-measure (last measured before `/systemd`), drop unused Chart.js parts (check whether `Filler` is needed), lazy-load chart components per tab.
- [ ] Tests: `ConfigOutput` flow (textarea matches the generator, copy calls the clipboard API, blocked state).

## 4. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 5. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
