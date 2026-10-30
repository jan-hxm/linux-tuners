/**
 * Swap tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Swap & memory',
  intro:
    'Tune Linux `vm.*` sysctl parameters for your specific hardware. Drag the sliders, watch the graphs respond, copy the resulting config into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'hardware',
    label: 'Hardware',
    title: 'Your hardware',
    subtitle: 'Drives every default value and slider range below.',
  },
  tuneSubtitle: 'Drag any slider on the left and the simulation on the right updates live.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-swap-tuning.conf, then sudo sysctl --system.',
  },
  adSlot: 'swap',
}

export const ABOUT = {
  heading: 'About this tool',
  intro: [],
  sections: [
    {
      title: 'Methodology',
      blocks: [
        { p: 'The tuner derives starting values for each `vm.*` parameter from your hardware spec (RAM, swap size, swap device, workload, cgroup version) and the published recommendations in the kernel docs and the August 2025 Kubernetes swap-tuning blog. Per-device caps (e.g. swappiness ≤ 60 on rotational disks, ≤ 200 on zram/zswap) are enforced both as slider ranges and as validation warnings.' },
        { p: 'The three live graphs are **teaching models**:' },
        {
          ul: [
            '**Swap pressure curve**: a piecewise model with no swap above the high watermark, a linear ramp through the kswapd band scaled by swappiness, and a steeper ramp from low to min watermark for direct reclaim.',
            '**Watermark zones**: derived directly from the kernel formula `window_pages = total_managed_pages × watermark_scale_factor / 10000`, with the system-wide min/low/high heights shown as a stacked bar.',
            '**Dirty writeback timeline**: a 120-second simulation of a constant 1%/s synthetic write workload, with the background flusher absorbing ~60% of the rate above `dirty_background_ratio` and a synchronous stall ceiling at `dirty_ratio`.',
          ],
        },
      ],
    },
    {
      title: 'Limitations',
      blocks: [
        {
          ul: [
            'The graphs are simplified pedagogical models, not kernel-accurate predictions. NUMA effects, per-zone watermarks, transparent huge pages, and MGLRU are not modelled.',
            'Per-cgroup swappiness (cgroup v1 only) is not configurable here; the tool emits system-wide values that `sudo sysctl --system` applies to all cgroups.',
            'Real-time kernel metrics (/proc/meminfo, PSI) are not imported; the tuner is purely a configuration-time aid.',
            'The starting defaults are intended for typical Linux server workloads. Always test in a non-production environment before applying.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            'Kernel administrator docs: [docs.kernel.org/admin-guide/sysctl/vm.html](https://docs.kernel.org/admin-guide/sysctl/vm.html)',
            '"Tuning Linux Swap for Kubernetes: A Deep Dive" (Kubernetes blog, Aug 2025): [kubernetes.io/blog](https://kubernetes.io/blog/2025/08/19/tuning-linux-swap-for-kubernetes-a-deep-dive/)',
            'Red Hat performance tuning guide (for the database preset)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'The author of this tool is not responsible for any system behaviour resulting from applying the generated configuration. Always validate values against your kernel version and test on a non-production node first. Misconfigured memory-reclaim parameters can cause data loss, OOM-killed processes, or system-wide stalls.' },
      ],
    },
    {
      title: 'Licence',
      blocks: [
        { p: 'Released under the MIT licence. See the [LICENSE file](https://github.com/jan-hxm/linux-tuners/blob/main/LICENSE) in the repository.' },
      ],
    },
  ],
}
