# linux-tuners.dev

Interactive, hardware-aware tuners for Linux system configuration. Drag sliders, watch live impact graphs, copy a ready-to-paste sysctl config.

Live site: **https://linux-tuners.dev**

## Tuners

| Tuner | Status | Path |
|---|---|---|
| Swap & memory (`vm.*` sysctl) | Available | [/swap](https://linux-tuners.dev/swap) |
| systemd & resource limits | Coming soon | [/systemd](https://linux-tuners.dev/systemd) |

Each tuner asks for your hardware spec (RAM, swap device, workload), derives sensible starting values from kernel.org and published recommendations, lets you customise via sliders, and shows the kernel-level impact through live graphs grounded in the same formulas the kernel uses internally. Output is a copy-pasteable config file with citations to the source documentation.

## Develop

```bash
npm install
npm run dev        # vite dev server on :5173 (or :5174 if busy)
npm test           # vitest, ~70 tests across model + components
npm run build      # vite build + postbuild (per-route HTML + sitemap)
```

## Stack

- **Vue 3** + **Vite** (composition API, `<script setup>`, plain JS)
- **Pinia** for state, **vue-router** for routing
- **Tailwind CSS** for styling
- **Chart.js** + **vue-chartjs** for the live simulation graphs
- **lz-string** for URL-encoded shareable state
- **Vitest** + **@vue/test-utils** + **happy-dom** for tests
- Static site, hosted on **Cloudflare Pages**, deployed via GitHub Actions

## Contributing

Open an issue first if you're planning a substantial change. Bug reports and small fixes are welcome via PR.

## Licence

MIT — see [LICENSE](LICENSE).
