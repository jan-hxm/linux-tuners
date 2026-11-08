# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Next

- [ ] **Learning pages** (in progress). One study guide per tuner at `/learn/<slug>`, for beginners, with figures whose numbers come from VM captures ([Design.md §5 Learning pages](Design.md#learning-pages)). The tuner cards drop their long descriptions once a tuner's guide is live. Built in four waves: foundations and the memory guide, the pages, the other eight guides, then a final pass.
- [ ] **Chooser answers that name a value.** A chooser answer is `{ key, dir: 'raise' | 'lower' }` or `{ leave, why }`, rendered "Raise <name>." For an enum setting (`thp_enabled`, `thp_defrag`, `ksm_run`, likely network and security enums) "raise" means nothing, so the guides spell the value out in the question or `why`. Add `{ key, to: <value> }` to the schema (checked against the def's options), `answerText` ("Set <name> to madvise.") and the static decision flow, then move the enum answers over.
- [ ] **Finer swap pressure samples near full memory.** `pressureCurve` samples memory fill in 1% steps, but on a typical machine the kswapd band and the min watermark sit within the last 1% (99.3 to 99.6% on 16 GiB). The chart now zooms the axis to that range (`focusRange`), so the curve shows only three samples there and starts rising at 99%, before the band. Sample more densely near the watermarks (simulation change, keep the tests).

## 2. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 3. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] **Glossary page.** The terms already live in `src/ui/glossary.js`, and the header and footer show a Glossary link once a route named `glossary` exists. A `/glossary` route listing every term with its definition would make that link appear.
- [ ] **Explain a derived default in one line.** A domain could explain a default with the profile's option labels ("database, 64 GiB, swap on NVMe, so 10") beyond today's origin note. Left over from the reactive margin notes item.
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
