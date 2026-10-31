/**
 * Network tuner page copy and About content, rendered by TunerPage and
 * AboutSection. Inline markup: `code`, **bold**, [label](https://url).
 */

export const PAGE = {
  title: 'Network stack',
  intro:
    'Tune the `net.core`, `net.ipv4` and `net.netfilter` sysctls for throughput and latency: socket buffers sized to your link and path, listen queues, congestion control, local ports and connection tracking. See how far one connection can go at your round-trip time, and copy the result into `/etc/sysctl.d/`.',
  profileStep: {
    id: 'system',
    label: 'System',
    title: 'Your system',
    subtitle: 'The link and the longest path size the buffers; the workload sets the queues and ports.',
  },
  tuneSubtitle: 'Each card says what the value limits, and when raising it helps.',
  exportStep: {
    title: 'Copy your config',
    subtitle: 'Drop this into /etc/sysctl.d/99-network-tuning.conf, then sudo sysctl --system.',
  },
  adSlot: 'swap',
}

export const ABOUT = {
  heading: 'About this tuner',
  intro: [],
  sections: [
    {
      title: 'Methodology',
      blocks: [
        { p: 'Buffers start from the **bandwidth-delay product**: link speed times round-trip time is how much data must be in flight to keep the link busy. The kernel advertises about half of a receive buffer as window, so the `tcp_rmem` max starts at twice the BDP, rounded up to a power of two, never below the usual kernel default and at most a 16th of RAM. Queues, ports and conntrack follow the workload. These are opinionated starting points, not mandated values.' },
        {
          ul: [
            'Kernel defaults and accepted values come from the kernel\'s networking documentation. Several defaults scale with RAM or changed between kernels; each card says so.',
            'The throughput chart is a teaching model: one advertised window per round trip, with no packet loss and no competing traffic. Real connections reach less, but never more.',
            'The values target kernel 4.19 or newer. Older kernels lack the loopback-only setting of `tcp_tw_reuse` and some other values.',
            'Interfaces keep the qdisc they were created with, and the netfilter keys exist only once `nf_conntrack` is loaded. The generated file shows how to handle both.',
          ],
        },
      ],
    },
    {
      title: 'Sources',
      blocks: [
        {
          ul: [
            '[IP sysctls](https://docs.kernel.org/networking/ip-sysctl.html)',
            '[net.core sysctls](https://docs.kernel.org/admin-guide/sysctl/net.html)',
            '[Netfilter conntrack sysctls](https://docs.kernel.org/networking/nf_conntrack-sysctl.html)',
            '[kube-proxy reference (conntrack flags)](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-proxy/)',
            '[BBR congestion control](https://github.com/google/bbr)',
          ],
        },
      ],
    },
    {
      title: 'Disclaimer',
      blocks: [
        { p: 'Larger buffers and queues trade memory for speed, and a connection tracking timeout that is too short breaks idle connections behind NAT. Apply the file on one machine first, measure with your real traffic, and keep a way back in (console access) before rolling it out.' },
      ],
    },
  ],
}
