/**
 * The networking study guide at /learn/networking: six chapters along the
 * path a connection's data takes, where the network tuner's seventeen
 * settings act. Data in the frozen Guide shape (src/learn/schema.js), checked
 * by src/learn/contract.test.js. Probe ids name entries in ./probes.js;
 * `[^id]` marks point into each chapter's `sources`; `[[term]]` names an entry
 * in ui/glossary.js.
 *
 * ip-sysctl.html has no per-key anchors, so its sources point at the section
 * (TCP variables, IP variables) and name the key in the label.
 */

const IP = 'https://docs.kernel.org/networking/ip-sysctl.html'
const NET = 'https://docs.kernel.org/admin-guide/sysctl/net.html'
const CT = 'https://docs.kernel.org/networking/nf_conntrack-sysctl.html#proc-sys-net-netfilter-nf-conntrack-variables'
const MAN = 'https://man7.org/linux/man-pages'
const tcpVar = (name) => ({ url: `${IP}#tcp-variables`, label: `IP sysctl: ${name}` })
const ipVar = (name) => ({ url: `${IP}#ip-variables`, label: `IP sysctl: ${name}` })
const core = (anchor, name) => ({ url: `${NET}#${anchor}`, label: `sysctl/net: ${name}` })
const man = (page, anchor, label) => ({ url: `${MAN}/${page}.html#${anchor}`, label })

export const LEARN = {
  slug: 'networking',
  title: 'How Linux handles network connections',
  lead: 'Follow a connection from your program to the network card and back, and see where each network setting acts on the way.',
  minutes: 20,
  parts: {
    picture:
      'Think of the network stack as a post office. Programs hand letters in at the counter, and sorters queue them for the trucks. Arriving mail waits in pigeonholes until each program collects it. A clerk at the door notes every conversation that passes.',
    cards: [
      { id: 'programs', title: 'Your programs', does: 'Open connections, then send and receive data through them.', col: 1, row: 1 },
      { id: 'sockets', title: 'Sockets', does: 'One per connection or listening port, with buffers for its data and a queue for new connections.', col: 1, row: 2, probe: 'network.sockstat' },
      { id: 'tcp', title: 'TCP', does: 'Decides how fast each connection may send, and resends what gets lost.', col: 2, row: 2, probe: 'network.congestionControl' },
      { id: 'conntrack', title: 'Connection tracking', does: 'Notes every connection it sees, for firewall rules and address rewriting.', col: 1, row: 3, probe: 'network.conntrackCount' },
      { id: 'qdisc', title: 'Outgoing queue', does: 'Holds packets waiting to leave and picks which goes next.', col: 2, row: 3, probe: 'network.defaultQdisc' },
      { id: 'backlog', title: 'Incoming queue', does: 'Holds arriving packets until a CPU has time for them.', col: 1, row: 4, probe: 'network.netdevBacklog' },
      { id: 'nic', title: 'Network card', does: 'Puts packets on the wire and takes them off.', col: 2, row: 4 },
    ],
    edges: [
      { from: 'programs', to: 'sockets', label: 'read and write data' },
      { from: 'sockets', to: 'tcp', label: 'data to send' },
      { from: 'tcp', to: 'qdisc', label: 'packets to send' },
      { from: 'qdisc', to: 'nic', label: 'packets leave' },
      { from: 'nic', to: 'backlog', label: 'packets arrive' },
      { from: 'backlog', to: 'conntrack', label: 'each packet is checked' },
      { from: 'conntrack', to: 'sockets', label: 'delivered to its connection' },
    ],
  },
  chapters: [
    {
      id: 'socket-buffers',
      title: 'Buffers for each connection',
      oneLine: 'Each connection keeps a buffer for data arriving and one for data leaving. Four settings cap how large those buffers may grow.',
      picture: {
        text: 'Think of a loading dock. The sender may only ship as many boxes as the dock has room for, then waits to hear that some were carried inside. On a long road, a bigger dock keeps more trucks driving at once.',
        limit: 'A dock has a fixed size. The kernel grows each connection\'s buffer while it runs, up to a cap, and part of the buffer holds bookkeeping, not data.',
      },
      figure: {
        kind: 'compare',
        title: 'Socket buffer sizes, receive and send',
        axis: 'buffer size',
        scale: 'log',
        groups: [
          { id: 'receive', label: 'Receive', does: 'Buffers for data that has arrived and waits for the program.' },
          { id: 'send', label: 'Send', does: 'Buffers for data on its way out, until the other side confirms it.' },
        ],
        bars: [
          { id: 'r-min', label: 'Smallest', group: 'receive', value: { probe: 'network.tcpRmem', path: '0', unit: 'bytes' }, does: 'The least a TCP receive buffer may shrink to.' },
          { id: 'r-start', label: 'Start', group: 'receive', tone: 'fit', value: { probe: 'network.tcpRmem', path: '1', unit: 'bytes' }, does: 'The size a new connection starts with, before the kernel grows it.' },
          { id: 'r-max', label: 'Largest', group: 'receive', value: { probe: 'network.tcpRmem', path: '2', unit: 'bytes' }, does: 'The most the kernel grows a TCP receive buffer to (larger on Fedora).' },
          { id: 'r-cap', label: 'Program cap', group: 'receive', tone: 'error', value: { probe: 'network.rmemMax', unit: 'bytes' }, does: 'The most a program may ask for with `SO_RCVBUF`.' },
          { id: 'w-min', label: 'Smallest', group: 'send', value: { probe: 'network.tcpWmem', path: '0', unit: 'bytes' }, does: 'The least a TCP send buffer may shrink to.' },
          { id: 'w-start', label: 'Start', group: 'send', tone: 'fit', value: { probe: 'network.tcpWmem', path: '1', unit: 'bytes' }, does: 'The size a new connection starts with, before the kernel grows it.' },
          { id: 'w-max', label: 'Largest', group: 'send', value: { probe: 'network.tcpWmem', path: '2', unit: 'bytes' }, does: 'The most the kernel grows a TCP send buffer to.' },
          { id: 'w-cap', label: 'Program cap', group: 'send', tone: 'error', value: { probe: 'network.wmemMax', unit: 'bytes' }, does: 'The most a program may ask for with `SO_SNDBUF`.' },
        ],
        pins: [
          { key: 'tcp_rmem', bar: 'r-max' },
          { key: 'tcp_wmem', bar: 'w-max' },
          { key: 'rmem_max', bar: 'r-cap' },
          { key: 'wmem_max', bar: 'w-cap' },
        ],
      },
      body: [
        'A [[socket]] is what a program uses to talk over the network. Each one has a receive buffer for data that has arrived and a send buffer for data on its way out[^socket7]. To use fast links with long delays, both buffers must be large[^tcp7].',
        'For TCP the kernel sizes the buffers itself, growing each one toward what the path needs[^moderate][^wmem]. net.ipv4.tcp_rmem and net.ipv4.tcp_wmem each hold three numbers: a minimum, a starting size and a maximum[^rmem][^wmem]. None of the three tcp_rmem values may be below 4096 bytes[^rmem].',
        'A program can instead pick its own size with SO_RCVBUF or SO_SNDBUF, which turns automatic sizing off for that socket[^rmem]. net.core.rmem_max and net.core.wmem_max cap what it may ask for[^socket7]. The kernel doubles the request to leave room for bookkeeping[^socket7].',
      ],
      pins: [
        { key: 'tcp_rmem', layer: 'r-max', here: 'The receive buffer TCP grows on its own. The max limits how much data a sender may have in flight, so long, fast paths need a larger one. Leave min and default alone.' },
        { key: 'tcp_wmem', layer: 'w-max', here: 'The send buffer TCP grows on its own. Raise the max on machines that send bulk data over long paths, together with tcp_rmem on the receiving side.' },
        { key: 'rmem_max', layer: 'r-cap', here: 'The cap for programs that set their own receive buffer, such as some UDP servers. Most TCP sockets follow tcp_rmem instead.' },
        { key: 'wmem_max', layer: 'w-cap', here: 'The cap for programs that set their own send buffer. Most TCP sockets follow tcp_wmem instead. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Does one download from far away stay slow while the link has room to spare?',
          check: 'sysctl net.ipv4.tcp_rmem',
          hint: 'The last number is the largest receive buffer, in bytes. A connection moves at most about one buffer of data per round trip.',
          yes: { key: 'tcp_rmem', dir: 'raise' },
        },
        {
          q: 'Does a program log that it got a smaller socket buffer than it asked for?',
          check: 'sysctl net.core.rmem_max net.core.wmem_max',
          hint: 'Programs that size their own buffers, such as some UDP servers, are held to these caps.',
          yes: { key: 'rmem_max', dir: 'raise' },
          no: { leave: true, why: 'The kernel sizes TCP buffers from your RAM, and that suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Single transfers over long distances stay slow, though the link is far from full.',
        high: 'Many busy connections hold more memory in buffers, with no gain on short paths.',
      },
      look: {
        cmd: 'sysctl net.ipv4.tcp_rmem net.ipv4.tcp_wmem net.core.rmem_max net.core.wmem_max',
        for: 'The TCP lines show min, default and max in bytes. The two core lines are the caps for programs that set their own size.',
      },
      sources: {
        socket7: man('man7/socket.7', 'DESCRIPTION', 'socket(7): SO_RCVBUF and SO_SNDBUF'),
        tcp7: man('man7/tcp.7', 'DESCRIPTION', 'tcp(7): window scaling'),
        moderate: tcpVar('tcp_moderate_rcvbuf'),
        wmem: tcpVar('tcp_wmem'),
        rmem: tcpVar('tcp_rmem'),
      },
    },
    {
      id: 'waiting-in-line',
      title: 'Queues for packets and new connections',
      oneLine: 'Arriving packets and new connections wait in queues until the kernel or your program gets to them. Three settings decide how long each line may get.',
      picture: {
        text: 'Picture a restaurant. Guests who knocked wait by the door until the host greets them. Greeted guests wait at the bar until a table is free. When either line is full, newcomers are turned away or try again later.',
        limit: 'Guests can see the line. A client cannot: its request is refused or ignored, and a retry may get through later, which looks like a slow server.',
      },
      figure: {
        kind: 'tree',
        kernels: true,
        title: 'Where arriving traffic waits before your program',
        root: {
          id: 'arrivals',
          label: 'Incoming traffic',
          does: 'Packets from the network card, and the new connections they open.',
          children: [
            {
              id: 'packets',
              label: 'Arriving packets',
              does: 'Every packet waits for a CPU before the kernel handles it.',
              children: [
                { id: 'cpu-queue', label: 'CPU backlog', value: { probe: 'network.netdevBacklog', unit: 'packets' }, does: 'Packets wait here for a CPU, and new ones are dropped when it is full.' },
              ],
            },
            {
              id: 'listener',
              label: 'Listening socket',
              does: 'One per listening port, with two queues for new connections.',
              children: [
                { id: 'syn', label: 'SYN queue', value: { probe: 'network.synBacklog', unit: 'connections' }, does: 'Half-open connections wait here, after a SYN arrived and before the handshake is done.' },
                { id: 'ready', label: 'Accept queue', value: { probe: 'network.somaxconn', unit: 'connections' }, does: 'Finished handshakes wait here until the program calls `accept()`.' },
              ],
            },
          ],
        },
        pins: [
          { key: 'netdev_max_backlog', node: 'cpu-queue' },
          { key: 'tcp_max_syn_backlog', node: 'syn' },
          { key: 'somaxconn', node: 'ready' },
        ],
      },
      body: [
        'Packets that arrive faster than the kernel can handle them wait in an input queue on each CPU[^flow]. net.core.netdev_max_backlog sets how many packets that queue holds[^backlog]. Once it is full, new packets are dropped[^flow].',
        'A TCP connection opens with a three-way [[handshake]] that starts with a SYN packet[^migrate]. While it is half done, the request waits in a queue sized by net.ipv4.tcp_max_syn_backlog, one per listening port[^syn]. When that queue overflows, the kernel sends SYN cookies instead[^cookies]. The docs call this a fallback against floods, not a way to carry heavy real traffic[^cookies].',
        'Once the handshake is done, the connection waits for the program to accept it. The program asks for a queue length with listen(), and net.core.somaxconn silently caps it[^listen]. If that queue is full, the client may get an error, or its request is ignored and a later retry succeeds[^listen].',
      ],
      pins: [
        { key: 'netdev_max_backlog', layer: 'cpu-queue', here: 'How many arriving packets each CPU may hold before it drops more. Raise it when the drop count in /proc/net/softnet_stat keeps growing. Most machines don\'t need to change this.' },
        { key: 'tcp_max_syn_backlog', layer: 'syn', here: 'How many half-open connections each listening port remembers. Raise it, together with somaxconn, on servers that take bursts of new clients.' },
        { key: 'somaxconn', layer: 'ready', here: "The cap on each listening port's queue of ready connections. It helps only when the program asks for a longer queue too, in its own settings." },
      ],
      choose: [
        {
          q: 'Do clients see slow or failed connects while the server itself is barely busy?',
          check: 'grep TcpExt /proc/net/netstat',
          hint: 'The first line names the counters and the second holds their values. A growing ListenOverflows means ready connections found the queue full.',
          yes: { key: 'somaxconn', dir: 'raise' },
        },
        {
          q: 'Does the kernel log say "Possible SYN flooding" on a port with real traffic?',
          check: 'sudo dmesg | grep -i "syn flooding"',
          hint: "This line appears when a port's queue of half-open connections overflows. If the traffic is real clients, the queue is too short.",
          yes: { key: 'tcp_max_syn_backlog', dir: 'raise' },
        },
        {
          q: 'On a fast link, does the second column of softnet_stat keep growing?',
          check: 'cat /proc/net/softnet_stat',
          hint: "One line per CPU, in hexadecimal. The second column counts packets dropped because that CPU's queue was full.",
          yes: { key: 'netdev_max_backlog', dir: 'raise' },
          no: { leave: true, why: 'The defaults suit most machines and links.' },
        },
      ],
      symptoms: {
        low: 'New connections stall or fail in bursts, and drop counters grow while the CPU has time to spare.',
        high: 'Queues hold more memory, and a full one adds delay before packets are handled.',
      },
      look: {
        cmd: 'grep TcpExt /proc/net/netstat',
        for: 'Two lines: counter names, then values. ListenOverflows counts connections that found the accept queue full.',
      },
      sources: {
        flow: { url: 'https://docs.kernel.org/networking/scaling.html#rps-flow-limit', label: 'Scaling in the networking stack: RPS flow limit' },
        backlog: core('netdev-max-backlog', 'netdev_max_backlog'),
        migrate: tcpVar('tcp_migrate_req'),
        syn: tcpVar('tcp_max_syn_backlog'),
        cookies: tcpVar('tcp_syncookies'),
        listen: man('man2/listen.2', 'NOTES', 'listen(2): the backlog argument'),
      },
    },
    {
      id: 'how-fast-to-send',
      title: 'How fast to send',
      oneLine: 'TCP decides how much data to send before waiting for replies, and a queue in front of the network card orders what leaves. Three settings shape both.',
      picture: {
        text: "Think of merging onto a motorway you can't see. You speed up until you notice brake lights, then ease off. At the on-ramp a marshal lets cars out in turns, so one long convoy doesn't block everyone.",
        limit: "A driver sees the road. TCP can't see the path, so it judges it from the replies that come back.",
      },
      figure: {
        kind: 'modes',
        title: 'What decides how a connection sends',
        rows: [
          {
            id: 'algorithm',
            label: 'Congestion control',
            pin: 'tcp_congestion_control',
            value: { probe: 'network.congestionControl', unit: '' },
            does: 'How much data a connection may send before replies come back, from the algorithms the kernel has loaded.',
            options: [
              { value: 'cubic', label: 'cubic', does: 'Backs off when packets are lost.' },
              { value: 'bbr', label: 'bbr', does: 'Models the path, and needs the `tcp_bbr` module.' },
              { value: 'reno', label: 'reno', does: 'The classic algorithm, always built in.' },
            ],
          },
          {
            id: 'qdisc',
            label: 'Outgoing queue',
            pin: 'default_qdisc',
            value: { probe: 'network.defaultQdisc', unit: '' },
            does: 'Which queueing discipline new network devices get to order the packets waiting to leave.',
            options: [
              { value: 'fq_codel', label: 'fq_codel', does: 'Gives every flow a fair share.' },
              { value: 'fq', label: 'fq', does: 'Paces each flow.' },
              { value: 'cake', label: 'cake', does: 'Aimed at home routers, and needs the `sch_cake` module.' },
              { value: 'pfifo_fast', label: 'pfifo_fast', does: 'The kernel default: one plain line for every flow.' },
            ],
          },
          {
            id: 'idle',
            label: 'After an idle pause',
            pin: 'tcp_slow_start_after_idle',
            value: { probe: 'network.slowStartAfterIdle', unit: '' },
            does: 'Whether a connection that sat idle starts slowly again or keeps the pace it had reached.',
            options: [
              { value: 0, label: 'keeps pace', does: 'The window is kept, so a burst leaves at full pace.' },
              { value: 1, label: 'restarts slowly', does: 'The window is timed out, so the next burst starts slowly.' },
            ],
          },
        ],
      },
      body: [
        '[[Congestion control|congestion-control]] decides how much a TCP connection may send at a time. net.ipv4.tcp_congestion_control picks the algorithm for new connections[^cc]. reno is always available, and others depend on how the kernel was built[^cc]. More may exist as modules not yet loaded[^avail]. Connections a listening socket accepts inherit its choice[^cc].',
        'By default, a connection that sat idle for one retransmission timeout has its congestion window timed out, so the next burst starts slowly[^idle]. At 0, net.ipv4.tcp_slow_start_after_idle keeps the window instead[^idle]. The fq man page says this slow restart hurts fast, long paths and programs that send data in chunks, such as video[^fq].',
        'Packets to send then wait in the interface\'s [[queueing discipline|qdisc]], which hands them to the network card[^tc]. net.core.default_qdisc picks it for network devices, and the kernel\'s own default is pfifo_fast[^qdisc]. fq_codel gives every flow a fair share[^codel], and fq paces each flow[^fq]. Virtual devices such as lo ignore the setting[^qdisc].',
      ],
      pins: [
        { key: 'tcp_congestion_control', layer: 'algorithm', here: 'The algorithm new connections use. Other algorithms, such as bbr, may come as modules; check tcp_available_congestion_control. Keep the default unless you have measured a gain.' },
        { key: 'default_qdisc', layer: 'qdisc', here: 'The queue network devices get. fq_codel shares the link fairly between flows, and fq adds pacing, which suits servers sending many flows. pfifo_fast is the kernel default.' },
        { key: 'tcp_slow_start_after_idle', layer: 'idle', here: 'On, a connection that paused starts slowly again. Off, it resumes at the pace it had. Off suits long-lived connections that send in bursts.' },
      ],
      choose: [
        {
          q: 'Do long-lived connections send in bursts, with each burst starting slowly?',
          check: 'sysctl net.ipv4.tcp_slow_start_after_idle',
          hint: '1 means a connection that paused for about one retransmission timeout restarts at a low rate.',
          yes: { key: 'tcp_slow_start_after_idle', dir: 'lower' },
        },
        {
          q: 'Is the queue pfifo_fast, and does one big upload slow down everything else on the link?',
          check: 'sysctl net.core.default_qdisc',
          hint: 'pfifo_fast, the kernel default, holds every flow in one line. Devices that exist already keep their queue until the next boot.',
          yes: { key: 'default_qdisc', to: 'fq_codel' },
          no: { leave: true, why: 'The defaults restart carefully after a pause, which suits short and interactive connections.' },
        },
      ],
      symptoms: {
        low: 'Each burst after a pause starts slowly, and one big upload can delay other traffic.',
        high: 'Bursts leave at full pace after a pause, even if the path got busier meanwhile.',
      },
      look: {
        cmd: 'sysctl net.ipv4.tcp_available_congestion_control net.ipv4.tcp_congestion_control net.core.default_qdisc',
        for: 'The first line lists the algorithms loaded now. The second is the one new connections use, and the third the queue devices get.',
      },
      sources: {
        cc: tcpVar('tcp_congestion_control'),
        avail: tcpVar('tcp_available_congestion_control'),
        idle: tcpVar('tcp_slow_start_after_idle'),
        fq: man('man8/tc-fq.8', 'DESCRIPTION', 'tc-fq(8)'),
        tc: man('man8/tc.8', 'QDISCS', 'tc(8): qdiscs'),
        qdisc: core('default-qdisc', 'default_qdisc'),
        codel: man('man8/tc-fq_codel.8', 'DESCRIPTION', 'tc-fq_codel(8)'),
      },
    },
    {
      id: 'packets-too-big',
      title: 'When large packets vanish',
      oneLine: 'Each link on a path has a largest packet it carries. One setting lets TCP find a size that gets through when the usual warnings never arrive.',
      picture: {
        text: 'You post parcels through a chain of mail slots. One slot on the way is narrower than yours. Normally the post office there sends a note: too big, use smaller parcels. If someone bins the notes, your big parcels vanish and you never learn why.',
        limit: 'Parcels you post are lost for good. TCP resends lost data, so with probing on it can try smaller packets until they get through.',
      },
      figure: {
        kind: 'modes',
        title: 'How TCP probes for a size that gets through',
        rows: [
          {
            id: 'probing',
            label: 'Path MTU probing',
            pin: 'tcp_mtu_probing',
            value: { probe: 'network.mtuProbing', unit: '' },
            does: 'Whether TCP tries smaller packets itself when ICMP warnings never arrive.',
            options: [
              { value: 0, label: 'off', does: 'TCP relies on ICMP messages and never probes.' },
              { value: 1, label: 'after a black hole', does: 'Probing starts once TCP detects an ICMP black hole.' },
              { value: 2, label: 'always', does: 'TCP always probes, starting from `tcp_base_mss`.' },
            ],
          },
        ],
      },
      body: [
        'Every link has a largest packet it carries, its [[MTU]]. With path MTU discovery on, the kernel keeps track of the path MTU to each destination host[^pmtu]. Some networks block the ICMP "Fragmentation Needed" messages it learns from. Then large packets never get through: browsers connect, then hang with no data received[^tcpmss].',
        'net.ipv4.tcp_mtu_probing turns on TCP\'s own path MTU discovery, which needs no ICMP[^probing]. At 0, the default, it is off[^tcp7]. At 1 it starts once TCP detects an ICMP black hole like the one above. At 2 it is always on and starts from tcp_base_mss[^probing].',
      ],
      pins: [
        { key: 'tcp_mtu_probing', layer: 'probing', here: 'Whether TCP tries smaller packet sizes on its own. 1 acts only after a black hole is detected, which suits hosts behind tunnels and overlay networks. Most machines don\'t need to change this.' },
      ],
      choose: [
        {
          q: 'Do connections open, then hang once large data starts to flow, as with scp after login?',
          check: 'sysctl net.ipv4.tcp_mtu_probing',
          hint: '0 means TCP relies on ICMP messages to learn the path MTU. If a firewall drops them, large packets vanish.',
          yes: { key: 'tcp_mtu_probing', dir: 'raise' },
          no: { leave: true, why: 'Path MTU discovery works where ICMP gets through, and the default leaves it to that.' },
        },
      ],
      symptoms: {
        low: 'Connections open, then hang once large packets flow, while small requests work.',
        high: 'At 2, every connection starts from a small segment size and probes upward, even on clean paths.',
      },
      look: {
        cmd: 'sysctl net.ipv4.tcp_mtu_probing net.ipv4.tcp_base_mss',
        for: 'The first is the mode, 0 to 2. The second is the segment size, in bytes, that probing starts from at 2.',
      },
      sources: {
        pmtu: man('man2/IP_MTU_DISCOVER.2const', 'DESCRIPTION', 'IP_MTU_DISCOVER(2const)'),
        tcpmss: man('man8/iptables-extensions.8', 'TARGET_EXTENSIONS', 'iptables-extensions(8): TCPMSS'),
        probing: tcpVar('tcp_mtu_probing'),
        tcp7: man('man7/tcp.7', 'DESCRIPTION', 'tcp(7): tcp_mtu_probing'),
      },
    },
    {
      id: 'ports-and-closing',
      title: 'Ports and closed connections',
      oneLine: 'Each outgoing connection borrows a local port, and a closed connection can hold it for a while. Three settings decide how many ports there are and how they come back.',
      picture: {
        text: 'A cloakroom has a fixed rack of numbered tickets. Each guest takes one on the way in. After a guest leaves, the ticket rests on a hook for a while before it goes back into use. On a busy night the rack can run empty.',
        limit: 'Guests at a cloakroom wait in line. A program does not wait: when no port is free, its connect() fails with an error.',
      },
      figure: {
        kind: 'gauge',
        title: 'Port numbers, and the range outgoing connections draw from',
        axis: 'port number',
        range: { from: 0, to: 65535 },
        marks: [
          { id: 'first', label: 'First port', value: { probe: 'network.portRange', path: '0', unit: '' }, does: 'The lowest port an outgoing connection may get.' },
          { id: 'last', label: 'Last port', value: { probe: 'network.portRange', path: '1', unit: '' }, does: 'The highest port an outgoing connection may get.' },
        ],
        zones: [
          { id: 'below', label: 'below the range', to: 'first', does: 'Ports for services that listen, such as those under 1024, which outgoing connections never borrow.' },
          { id: 'ephemeral', label: 'outgoing ports', from: 'first', to: 'last', tone: 'fit', does: 'Each outgoing connection borrows one, and `connect()` fails when all are busy or in TIME-WAIT.' },
          { id: 'above', label: 'above the range', from: 'last', does: 'Never handed out to outgoing connections, up to the top port, 65535.' },
        ],
      },
      body: [
        'A program that connects out without picking a port gets one from net.ipv4.ip_local_port_range[^reserved][^range]. The defaults are 32768 to 60999[^range]. If every port in the range is in use, connect() fails with EADDRNOTAVAIL[^connect].',
        'The low end may not be below ip_unprivileged_port_start, 1024 by default[^range][^unpriv]. The docs suggest ends of different parity, one even and one odd[^range]. Keep the range clear of ports your own services listen on.',
        'Closed connections linger as [[TIME-WAIT|time-wait]] sockets, which the kernel holds for a time[^tw-buckets]. net.ipv4.tcp_tw_reuse lets new connections reuse them when that is safe, and its default 2 does so for loopback only[^reuse]. net.ipv4.tcp_fin_timeout limits how long an abandoned connection waits in FIN_WAIT_2 for the other side to close[^fin].',
      ],
      pins: [
        { key: 'ip_local_port_range', layer: 'ephemeral', here: 'The ports outgoing connections borrow. Widen it on proxies and clients that open many short connections, and keep it clear of ports your services listen on.' },
        { key: 'tcp_tw_reuse', layer: 'ephemeral', here: 'Whether new connections may reuse ports still in TIME-WAIT when that is safe. 2, the default, does it for loopback only. The docs advise changing it only on expert advice.' },
        { key: 'tcp_fin_timeout', layer: 'ephemeral', here: 'How long, in seconds, a connection no program holds any more waits for the other side to finish closing. Lower frees such leftovers sooner on busy servers. It is not the TIME-WAIT time.' },
      ],
      choose: [
        {
          q: 'Do outgoing connections fail with "Cannot assign requested address"?',
          check: 'grep TCP /proc/net/sockstat',
          hint: 'tw counts connections in TIME-WAIT. A number close to the size of the port range means ports are running out.',
          yes: { key: 'ip_local_port_range', dir: 'raise' },
        },
        {
          q: 'Does the server collect many connections that clients left half closed?',
          check: 'grep TCP /proc/net/sockstat',
          hint: 'orphan counts connections no program holds any more. A large number that stays high means they wait long to be closed.',
          yes: { key: 'tcp_fin_timeout', dir: 'lower' },
          no: { leave: true, why: 'The default range gives 28232 ports, which suits most machines.' },
        },
      ],
      symptoms: {
        low: 'Outgoing connections fail with "Cannot assign requested address" during bursts.',
        high: 'A very wide range can hand out a port that one of your services wants to listen on.',
      },
      look: {
        cmd: 'grep TCP /proc/net/sockstat',
        for: 'inuse counts open TCP sockets, orphan those no program holds, and tw those in TIME-WAIT.',
      },
      sources: {
        reserved: ipVar('ip_local_reserved_ports'),
        range: ipVar('ip_local_port_range'),
        connect: man('man2/connect.2', 'ERRORS', 'connect(2): EADDRNOTAVAIL'),
        unpriv: ipVar('ip_unprivileged_port_start'),
        'tw-buckets': tcpVar('tcp_max_tw_buckets'),
        reuse: tcpVar('tcp_tw_reuse'),
        fin: tcpVar('tcp_fin_timeout'),
      },
    },
    {
      id: 'tracking-connections',
      title: 'Tracking connections',
      oneLine: "Firewall rules and address rewriting need to know which connection each packet belongs to. Three settings size the kernel's table of connections and how long idle ones stay.",
      picture: {
        text: 'A doorman keeps a guest book. Each new visitor gets a line, and everyone who comes back is checked against it. The book has a fixed number of pages. When it is full, the doorman turns newcomers away until old lines are crossed out.',
        limit: 'A doorman can squeeze in one more name. The kernel cannot: once the table is full and nothing can be dropped, the new connection\'s packet is dropped instead.',
      },
      figure: {
        kind: 'gauge',
        title: 'Connections the kernel tracks, against its limit',
        axis: 'tracked connections',
        marks: [
          {
            id: 'entries',
            label: 'Busy server',
            value: { example: 41000, unit: 'connections', label: 'Busy server' },
            does: 'An example count of tracked connections on a busy server, to show a table that is filling up.',
          },
          {
            id: 'limit',
            label: 'Table limit',
            value: { probe: 'network.conntrackMax', unit: 'connections' },
            tone: 'error',
            does: 'The most entries allowed, and a new connection is dropped past it.',
          },
        ],
        zones: [
          { id: 'free', label: 'free entries', from: 'entries', to: 'limit', tone: 'fit', does: 'Room for new connections, one entry each, while idle entries leave after their timeout.' },
          { id: 'full', label: 'table full', from: 'limit', tone: 'error', does: 'No room is left, so packets that would start a new connection are dropped.' },
        ],
        pins: [{ key: 'nf_conntrack_max', mark: 'limit' }],
      },
      body: [
        '[[Connection tracking|conntrack]] keeps an entry for each connection the kernel sees[^ct]. Firewall rules can then match a packet by its connection\'s state, such as NEW or ESTABLISHED[^match]. [[NAT]] rules act on the packet that starts a connection, and every later packet of it gets the same change[^nat-table][^snat].',
        'net.netfilter.nf_conntrack_max caps the entries, and by default equals nf_conntrack_buckets[^ct]. The kernel picks the bucket count from RAM, between 1024 and 262144[^ct]. Each entry sits in the hash table twice, once per direction, so a full table averages two per bucket[^ct]. The bucket count can be written only in the initial network [[namespace]][^ct].',
        'An idle established TCP connection keeps its entry for net.netfilter.nf_conntrack_tcp_timeout_established, 432000 seconds (5 days) by default[^ct]. On busy NAT hosts, clients that vanish without closing leave entries behind that wait out this timer.',
      ],
      pins: [
        { key: 'nf_conntrack_max', layer: 'limit', here: 'How many connections the kernel tracks at once. Raise it on NAT gateways and container hosts until the peak count stays well below it. Each entry costs memory.' },
        { key: 'nf_conntrack_buckets', layer: 'free', here: 'The size of the hash table entries are looked up in. Keep it near nf_conntrack_max, so lookups stay short when the table fills.' },
        { key: 'nf_conntrack_tcp_timeout_established', layer: 'free', here: 'How long an idle TCP connection keeps its entry. Lower clears out connections clients abandoned. Keep it above the longest quiet spell your connections have, or they break behind NAT.' },
      ],
      choose: [
        {
          q: 'Does the kernel log say "nf_conntrack: table full, dropping packet"?',
          check: 'sudo dmesg | grep -i "table full"',
          hint: 'Each line is a packet the kernel dropped because the tracking table had no room for its connection.',
          yes: { key: 'nf_conntrack_max', dir: 'raise' },
        },
        {
          q: 'Is the table mostly full of connections that went quiet long ago?',
          check: 'sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max',
          hint: 'A count near the max that stays high while traffic is low points to idle entries waiting out their timeout.',
          yes: { key: 'nf_conntrack_tcp_timeout_established', dir: 'lower' },
          no: { leave: true, why: 'The defaults scale with RAM and suit machines that do not route or rewrite much traffic.' },
        },
      ],
      symptoms: {
        low: 'New connections time out at random under load, and the kernel log says the table is full.',
        high: 'The table takes more memory, and idle entries linger for days.',
      },
      look: {
        cmd: 'sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max',
        for: 'count is how many connections are tracked now, and max is the limit. The keys exist only while the nf_conntrack module is loaded.',
      },
      sources: {
        ct: { url: CT, label: 'Netfilter conntrack sysctl variables' },
        match: man('man8/iptables-extensions.8', 'MATCH_EXTENSIONS', 'iptables-extensions(8): conntrack'),
        'nat-table': man('man8/iptables.8', 'TABLES', 'iptables(8): the nat table'),
        snat: man('man8/iptables-extensions.8', 'TARGET_EXTENSIONS', 'iptables-extensions(8): SNAT'),
      },
    },
  ],
}
