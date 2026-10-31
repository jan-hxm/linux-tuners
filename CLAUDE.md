# CLAUDE.md

Agent instructions for [linux-tuners.dev](https://linux-tuners.dev). Loaded into every session, so keep it short: the full design lives in [Design.md](Design.md) and is the single source of truth.

## At a glance

Static Vue 3 SPA (plain JS, Pinia, Tailwind, Chart.js) with two tuners: `/swap` (`vm.*` sysctl) and `/systemd` (systemd resource control), plus landing and legal pages. Hosted on Cloudflare Pages; GitHub Actions deploys every push to `main`, so a push is a release.

## Docs map

- [Design.md](Design.md): scope and non-goals, product principles, architecture, conventions. **Read the relevant section before changing that area.**
- [TODO.md](TODO.md): the single list of open work. When an item is done, record the outcome in Design.md if it changes how the project works, then **delete the item**. Don't keep closed items or add new planning files.
- [README.md](README.md): public-facing summary only. Keep it short.
- `PRIVATE.md`: see below.

## Private notes (local only)

The repo is **public**. Anything that shouldn't be public-facing lives in `PRIVATE.md` at the repo root, which is gitignored and exists only on the maintainer's machine: AdSense publisher/slot IDs and account status, the deploy secrets inventory, sponsorship/payout setup, revenue notes, and **open security findings**. Read it when a task touches those topics. Never copy its contents into tracked files, commit messages, PR descriptions or GitHub issues, and put new details of that kind there rather than in TODO.md or Design.md. If it's missing (fresh clone), ask the user instead of guessing.

## Rules that are easy to break

Each links to its full rationale in Design.md.

- **Security audit before every commit.** Every change except docs-only or test-only ones passes the audit in [§10](Design.md#10-security) before you commit: tests and build, `npm audit --omit=dev`, the rules checklist, and `/security-review` on the diff. Give the result in your reply. Blocking findings get fixed first; anything else goes in `PRIVATE.md`. Generated output is built from definitions, never from state, and never contains executable directives.
- **No em dashes in displayed text** (UI strings, parameter descriptions, validation messages, generated config). Docs and comments are exempt. [§8](Design.md#8-copy-conventions)
- **Every emitted value must be one the kernel/systemd accepts**, and sliders must not offer values systemd silently ignores. Blocking validation only for rejected or clearly broken settings. [§3](Design.md#3-product-principles)
- **Shared-link state is untrusted input**: keep the schema checks, rounding and preset-id check in serialization / `restoreState`. [§5 Shareable URL state](Design.md#shareable-url-state)
- **Don't bind `:value` on the range input** in `ui/controls/SliderControl.vue`; it cancels Chromium drags. [§5 Range slider](Design.md#range-slider-uncontrolled-with-external-sync)
- **Don't reintroduce a custom consent banner**; Google's CMP handles consent. [§5 Ads and consent](Design.md#ads-and-consent)
- **A component can't `inject()` what it `provide()`s**: `TunerPage` passes its store explicitly to its own composables. [§5 Domain modules](Design.md#domain-modules-behind-a-shared-store-and-ui)
- **UI/UX + accessibility guardrails** (mobile impact bar, real buttons with `aria-expanded`, tablist arrow keys, focus-trapping drawers, chart `aria-label`s, type and contrast floors). [§7](Design.md#7-uiux-and-accessibility-conventions)
- **New tuners** follow the checklist, and get no route entry until they work. [§6](Design.md#6-adding-a-tuner)
- **Reuse before writing**: data first, then configure shared code, then tuner-local, and promote when a second tuner needs it. Never copy between tuners or branch on a tuner id in shared code. [§9](Design.md#9-code-organization-and-reuse)
- Material changes to the privacy policy bump its "Last updated" line.

## Commands

```bash
npm run dev          # vite dev server (5173, falls back to 5174)
npm test             # vitest run
npm run build        # vite build + postbuild (per-route HTML + sitemap.xml)
npm run gen:icons    # regen favicons + OG image (uses sharp)
```
