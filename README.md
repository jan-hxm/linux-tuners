# linux-tuners.dev

Interactive, hardware-aware tuners for Linux system configuration. Describe your
machine, adjust the settings while live graphs show the effect, and copy a
ready-to-apply config file with citations to the source documentation.

**https://linux-tuners.dev**

## Tuners

| Tuner | Covers |
|---|---|
| [Swap & memory](https://linux-tuners.dev/swap) | `vm.*` sysctl: swappiness, watermarks, dirty-page writeback, overcommit |
| [systemd & resource limits](https://linux-tuners.dev/systemd) | systemd manager defaults and cgroup v2 slice controls |
| [Security hardening](https://linux-tuners.dev/security) | hardening sysctls from `kernel.*`, `net.*` and `fs.*`, with KSPP and CIS-style presets |
| [Network stack](https://linux-tuners.dev/network) | `net.*` sysctl: socket buffers sized to your link and path, listen queues, congestion control, local ports, conntrack |
| [Filesystem & file descriptors](https://linux-tuners.dev/filesystem) | `fs.*` sysctl: open-file ceilings, inotify limits for IDEs and Kubernetes nodes, native AIO for databases |
| [Huge pages & memory layout](https://linux-tuners.dev/hugepages) | huge page pools, Transparent Huge Pages and KSM (sysctl.d + tmpfiles.d), `vm.max_map_count`, NUMA zone reclaim |

More are planned (filesystem, huge pages, …). Everything runs in
your browser; your settings are only stored in the URL you choose to share.

## Develop

```bash
npm install
npm run dev     # dev server on :5173
npm test        # unit tests
npm run build   # production build into dist/
```

Design, architecture and conventions: [Design.md](Design.md). Open work: [TODO.md](TODO.md).

## Contributing

Bug reports and small fixes are welcome. For anything substantial, please open an issue first.

## Licence

MIT, see [LICENSE](LICENSE).
