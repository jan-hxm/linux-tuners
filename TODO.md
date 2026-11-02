# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Launch & SEO

Cheap, and nothing else pays off until people can find the site and shared links look right.

- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.
- [ ] After the next deploy, check the link cards in an Open Graph preview tester (opengraph.xyz or metatags.io) for `/` and one tuner page. No social accounts needed.

## 2. Guided system setup

The next big feature, now that nine tuners exist: it turns separate tools into one path through a whole machine. Designed in [Design.md §5 Guided setup](Design.md#guided-setup); build in this order, each step shippable on its own.

- [ ] `core/machine.js` and the mapping: the machine field list, each tuner's `machine` declarations, and the contract test that every machine option maps to a value the tuner accepts.
- [ ] Facts: the `facts` hook and the facts argument of `validate`, the systemd warnings against `nrOpen`, `pidMax` and `threadsMax`, and the order test.
- [ ] `/setup`: the store option `urlSync: false`, the steps, the link envelope with its hostile-link tests, the output step with per-file download (which closes the `ConfigOutput` item in §3), the no-shared-key test, the route and the sitemap sources, the `src/setup/` import rule, and the landing page's "Start guided setup" button, which passes the picked role.

## 3. Quality

- [ ] Automated accessibility sweep (axe-core / Lighthouse): focus visibility on the dark hero, a live-region announcement when a preset is applied or validation fires, and a full WCAG AA contrast pass.
- [ ] Bundle: re-measure (last measured before `/systemd`), drop unused Chart.js parts (check whether `Filler` is needed), lazy-load chart components per tab.
- [ ] `ConfigOutput`: a download per file for multi-file tuners (systemd), instead of one combined `.conf`.
- [ ] Tests: `ConfigOutput` flow (textarea matches the generator, copy calls the clipboard API, blocked state).

## 4. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 5. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
