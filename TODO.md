# TODO

The single list of open work, most valuable first. When an item is done, record
the outcome in [Design.md](Design.md) if it changes how the project works, then
delete the item. Finished items are not kept here. Account, revenue and security
details are kept in the local, gitignored `PRIVATE.md`, not here.

## 1. Readable without JavaScript: check after deploy

The static page text, the Markdown copies, `llms.txt`, the crawler policy in `robots.txt` and real 404s are built (Design.md §5 "Routes, SEO and build"). What's left can only be checked on the live site or in Cloudflare.

- [ ] **Measure (maintainer, in Cloudflare), ideally before the deploy as a baseline.** In Crawl Control, note which crawlers hit which paths, their response codes (a 403 or challenge means Cloudflare's AI-bot blocking or Bot Fight Mode is stopping them), and the referrals each one sends back. Check that managed `robots.txt` and "Block AI bots" are off, or at least don't block the search and retrieval bots the policy welcomes (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User).
- [ ] **Flash before the app mounts.** Visitors briefly see the static text until the module script runs, and the site header only appears after mount. In a real browser at phone and desktop width, on a throttled connection, check how visible that is, and compare Lighthouse CLS with the previous deploy. If it looks bad, tone the static text down in `.static-doc` (main.css); don't hide it with `hidden` or `display:none`, which crawlers may discount.
- [ ] **Live checks.**
  - `curl -A OAI-SearchBot https://linux-tuners.dev/swap` shows the static `<main>`.
  - `curl -I` on `/swap.md` shows `text/markdown; charset=utf-8`, `X-Robots-Tag: noindex` and the canonical `Link`. `/llms.txt` is `text/plain`. The build appends one `_headers` block per file, so also check that Pages merges them with the `/*` rules.
  - `curl -I https://linux-tuners.dev/.env` gives 404 with the static page, and `/swap`, `/setup`, `/imprint` give 200.
  - Run Google's URL Inspection on one tuner page.
  - Watch Crawl Control requests and referrals for 2 to 4 weeks against the baseline.

## 2. Launch & SEO

Cheap, and nothing else pays off until people can find the site and shared links look right.

- [ ] **Edge filter for scanner probes (maintainer, Cloudflare dashboard).** One WAF custom rule on the free plan: block when the URI path contains `/.env`, `/.git`, `.php`, `/wp-`, `/phpmyadmin`, `/.aws` or `/config.json`, or ends in `.sql`, `.bak` or `.zip`. The site serves none of these, so it can't block a real visitor. This keeps the probes out of analytics; nothing can stop the requests from being sent. If you also turn on Bot Fight Mode, check in Crawl Control that the allowed search and retrieval bots still get a 200.
- [ ] Verify the site in Google Search Console and submit `https://linux-tuners.dev/sitemap.xml`; optionally Bing Webmaster Tools.
- [ ] After the next deploy, check the link cards in an Open Graph preview tester (opengraph.xyz or metatags.io) for `/` and one tuner page. No social accounts needed.

## 3. Watch list

Act only when they happen again.

- [ ] VM suite: in a full parallel run the Ubuntu 24.04 guest sometimes drops off (SSH refused) at the first systemd drop-in case, right after the sysctl sweep; it comes back at the next reboot, and alone it always passes. Seen in two of three full runs, cause unknown (the panic switches are already reset after the kernel cases, and no other file sets them). Run with `VM_KEEP=1` and read `vm/.cache/run/lt-ubuntu2404/console-*.log` when it happens again.

## 4. Parked

- [ ] **CPU frequency & power tuner** (a new domain module following [Design.md §6](Design.md#6-adding-a-tuner); sysfs-based, so global values can use the huge pages tuner's tmpfiles.d writer): `scaling_governor`, `scaling_min_freq`/`scaling_max_freq`, `energy_performance_preference`, plus `kernel.numa_balancing`. Parked until it can be measured on real hardware: the VM guests have no cpufreq at all (no `cpu*/cpufreq`, `acpi-cpufreq` finds no device). That needs the driver (`intel_pstate`, `amd-pstate`, `acpi-cpufreq`), the governors and EPP values each offers, the min/max bounds, and whether tmpfiles.d `w` lines with a `cpu*` glob reach every CPU. `kernel.numa_balancing` could be measured in a VM with two NUMA nodes (a single-node guest starts it at 0).
- [ ] Legal: have the privacy policy reviewed by a data-protection officer or German IT lawyer if the site becomes commercial; it's templated, not legal advice.
