/**
 * Small probes run inside the guest, as shell or python3 one-liners. python3
 * is on every cloud image (cloud-init needs it), so the syscalls go through
 * ctypes rather than a compiler.
 */

// perf_event_open(2) on the calling process. Prints "ok" or the errno name.
// argv[1]: 1 to exclude kernel samples (user space only), 0 to include them.
export const PERF_OPEN = String.raw`
import ctypes, os, struct, sys, errno
libc = ctypes.CDLL(None, use_errno=True)
exclude_kernel = int(sys.argv[1])
# struct perf_event_attr, PERF_ATTR_SIZE_VER0 (64 bytes) is enough:
# type, size, config, sample_period, sample_type, read_format, flags
flags = (1 << 0) | (exclude_kernel << 5) | (1 << 6)  # disabled, exclude_kernel, exclude_hv
attr = struct.pack('IIQQQQQ', 1, 64, 0, 0, 0, 0, flags) + bytes(8)  # SOFTWARE, CPU_CLOCK
buf = ctypes.create_string_buffer(attr, 64)
fd = libc.syscall(298, buf, 0, -1, -1, 0)
print('ok' if fd >= 0 else errno.errorcode[ctypes.get_errno()])
`

// bpf(BPF_MAP_CREATE) of a one-entry array map. Prints "ok" or the errno name.
export const BPF_MAP = String.raw`
import ctypes, struct, errno
libc = ctypes.CDLL(None, use_errno=True)
attr = struct.pack('IIII', 2, 4, 4, 1) + bytes(112)  # ARRAY, key 4, value 4, 1 entry
buf = ctypes.create_string_buffer(attr, len(attr))
fd = libc.syscall(321, 0, buf, len(attr))
print('ok' if fd >= 0 else errno.errorcode[ctypes.get_errno()])
`

/** Wrap a python probe as a shell command (base64, so no quoting to get wrong). */
export const py = (src, ...args) => `echo ${Buffer.from(src).toString('base64')} | base64 -d | python3 - ${args.join(' ')}`
