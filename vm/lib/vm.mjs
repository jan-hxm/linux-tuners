/**
 * Boot a throwaway QEMU VM from a distro cloud image and drive it over SSH.
 *
 * Each boot gets a fresh qcow2 overlay on top of the cached base image, so the
 * base is never modified and a VM can be thrown away with its overlay. The
 * cloud-init seed (NoCloud) is a directory QEMU presents as a FAT disk
 * labelled CIDATA (vvfat), which every cloud-init version reads and which
 * needs no ISO tool. SSH reaches the guest through a forwarded port on
 * 127.0.0.1.
 *
 * Users in the guest: `tester` (passwordless sudo, used for SSH) and `alice`
 * (unprivileged, for checks such as "can a normal user open perf events").
 */

import { spawn, spawnSync } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMAGES } from './images.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const CACHE = join(ROOT, '.cache')
const IMAGE_DIR = join(CACHE, 'images')
const RUN_DIR = join(CACHE, 'run')
const KEY = join(CACHE, 'id_ed25519')
const KNOWN_HOSTS = join(CACHE, 'known_hosts')

const QEMU_DIR = process.env.QEMU_DIR ?? (process.platform === 'win32' ? 'C:\\Program Files\\qemu' : '')
const exe = (name) => (QEMU_DIR ? join(QEMU_DIR, process.platform === 'win32' ? `${name}.exe` : name) : name)

/** Accelerator: WHPX on Windows, KVM on Linux, HVF on macOS. VM_ACCEL overrides. */
function accel() {
  if (process.env.VM_ACCEL) return process.env.VM_ACCEL
  if (process.platform === 'win32') return 'whpx,kernel-irqchip=off'
  if (process.platform === 'darwin') return 'hvf'
  return existsSync('/dev/kvm') ? 'kvm' : 'tcg'
}

/**
 * CPU model. KVM and HVF pass the host CPU through. Under WHPX, `max` and
 * named models such as Skylake-Client advertise features WHPX doesn't
 * provide, which crashes init on older guests (Debian 11, Ubuntu 18.04), so
 * Windows gets the plain qemu64 model. VM_CPU overrides.
 */
function cpuModel() {
  if (process.env.VM_CPU) return process.env.VM_CPU
  return process.platform === 'win32' ? 'qemu64' : 'host'
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${r.stderr}`)
  return r.stdout
}

function ensureKey() {
  mkdirSync(CACHE, { recursive: true })
  if (!existsSync(KEY)) sh('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'linux-tuners-vm', '-f', KEY])
  return readFileSync(`${KEY}.pub`, 'utf8').trim()
}

/** Download the base image once. */
export async function ensureImage(id) {
  const img = IMAGES[id]
  if (!img) throw new Error(`Unknown image "${id}"`)
  mkdirSync(IMAGE_DIR, { recursive: true })
  const path = join(IMAGE_DIR, img.file)
  if (!existsSync(path)) {
    console.log(`[vm] downloading ${img.url}`)
    sh('curl', ['-sSfL', '-o', `${path}.part`, img.url], { stdio: ['ignore', 'inherit', 'inherit'] })
    sh(process.platform === 'win32' ? 'cmd' : 'mv', process.platform === 'win32' ? ['/c', 'move', '/y', `${path}.part`, path] : [`${path}.part`, path])
  }
  return path
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = createNetServer()
    srv.unref()
    srv.on('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => res(port))
    })
  })
}

function userData(pubkey) {
  return [
    '#cloud-config',
    'users:',
    '  - name: tester',
    '    sudo: ALL=(ALL) NOPASSWD:ALL',
    '    shell: /bin/bash',
    '    lock_passwd: true',
    `    ssh_authorized_keys: ['${pubkey}']`,
    '  - name: alice',
    '    shell: /bin/bash',
    '    lock_passwd: true',
    'ssh_pwauth: false',
    // Keep the boot quick and the guest unchanged: no package upgrades.
    'package_update: false',
    'package_upgrade: false',
    '',
  ].join('\n')
}

/** Write the NoCloud seed files that the CIDATA disk presents. */
function writeSeed(dir, name, pubkey) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'meta-data'), `instance-id: ${name}-${Date.now()}
local-hostname: ${name}
`)
  writeFileSync(join(dir, 'user-data'), userData(pubkey))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class VM {
  /** @param {string} id  An IMAGES key */
  constructor(id) {
    this.id = id
    this.image = IMAGES[id]
    this.name = `lt-${id.replace(/[^a-z0-9]/g, '')}`
    this.dir = join(RUN_DIR, this.name)
  }

  /** Boot a fresh VM and wait until SSH and cloud-init are done. */
  async start({ memory = 2048, cpus = 2, timeoutMs = 600_000 } = {}) {
    const base = await ensureImage(this.id)
    const pubkey = ensureKey()
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
    this.overlay = join(this.dir, 'disk.qcow2')
    sh(exe('qemu-img'), ['create', '-q', '-f', 'qcow2', '-F', 'qcow2', '-b', base, this.overlay, '10G'])

    const seed = join(this.dir, 'seed')
    writeSeed(seed, this.name, pubkey)
    this.sshPort = await freePort()
    this.console = join(this.dir, 'console.log')
    this.args = [
      '-machine', 'q35',
      '-accel', accel(),
      '-cpu', cpuModel(),
      '-m', String(memory),
      '-smp', String(cpus),
      '-drive', `file=${this.overlay},if=virtio,format=qcow2`,
      '-nic', `user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:${this.sshPort}-:22`,
      '-drive', `if=virtio,format=raw,readonly=on,file.driver=vvfat,file.dir=${seed},file.label=CIDATA`,
      '-display', 'none',
      '-monitor', 'none',
      // A guest reboot exits QEMU and reboot() cold-starts it again: under
      // WHPX a warm reset hangs most guests right after GRUB.
      '-no-reboot',
    ]
    await this.launch(timeoutMs)
    await this.run('cloud-init status --wait >/dev/null 2>&1 || true', { timeoutMs: 600_000 })
    return this
  }

  /** Start QEMU on the existing overlay and wait for SSH. */
  async launch(timeoutMs = 600_000) {
    this.boots = (this.boots ?? 0) + 1
    const args = [...this.args, '-serial', `file:${this.console.replace(/\.log$/, `-${this.boots}.log`)}`]
    this.proc = spawn(exe('qemu-system-x86_64'), args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let qemuErr = ''
    this.proc.stderr.on('data', (d) => { qemuErr += d })
    this.exited = new Promise((r) => this.proc.on('exit', r))

    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (this.proc.exitCode !== null) throw new Error(`qemu exited (${this.proc.exitCode}): ${qemuErr}`)
      if (Date.now() >= deadline) throw new Error(`${this.id}: SSH did not come up; see ${this.console}`)
      const r = await this.run('true', { timeoutMs: 15_000, check: false })
      if (r.code === 0) break
      await sleep(3000)
    }
    await this.afterBoot?.(this)
  }

  /**
   * Run a shell command in the guest as `tester`.
   * @returns {Promise<{code:number, stdout:string, stderr:string}>}
   */
  run(cmd, { input, timeoutMs = 120_000, check = true } = {}) {
    const args = [
      '-q', '-i', KEY, '-p', String(this.sshPort),
      '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', `UserKnownHostsFile=${KNOWN_HOSTS}`,
      '-o', 'ConnectTimeout=10', '-o', 'LogLevel=ERROR',
      // Debian leaves the sbin dirs off a normal user's PATH.
      'tester@127.0.0.1', `export PATH=/usr/local/sbin:/usr/sbin:/sbin:$PATH; ${cmd}`,
    ]
    return new Promise((res, rej) => {
      const p = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      p.stdout.on('data', (d) => { stdout += d })
      p.stderr.on('data', (d) => { stderr += d })
      const t = setTimeout(() => p.kill(), timeoutMs)
      p.on('error', rej)
      p.on('close', (code) => {
        clearTimeout(t)
        const r = { code: code ?? -1, stdout, stderr }
        if (check && r.code !== 0) rej(new Error(`[${this.id}] \`${cmd}\` exited ${r.code}\n${stderr}${stdout}`))
        else res(r)
      })
      p.stdin.end(input ?? '')
    })
  }

  /** Run as root. */
  sudo(cmd, opts) {
    return this.run(`sudo sh -c ${quote(cmd)}`, opts)
  }

  /** Run as the unprivileged user `alice`. */
  asUser(cmd, opts) {
    return this.run(`sudo -u alice -H sh -c ${quote(cmd)}`, opts)
  }

  /** Write a file in the guest as root. */
  async writeFile(path, content) {
    await this.run(`sudo mkdir -p ${quote(path.replace(/\/[^/]+$/, '') || '/')} && sudo tee ${quote(path)} >/dev/null`, { input: content.endsWith('\n') ? content : `${content}\n` })
  }

  /**
   * Read sysctls as root (fs.protected_* are 0600 on older kernels), with
   * whitespace collapsed. A key that doesn't exist reads as null.
   * @param {string[]} keys
   * @returns {Promise<Record<string, string|null>>}
   */
  async sysctls(keys) {
    const script = keys.map((k) => `v=$(sysctl -n ${quote(k)} 2>/dev/null) && printf '%s=%s\\n' ${quote(k)} "$(echo $v)" || printf '%s\\n' ${quote(k)}`).join('\n')
    const { stdout } = await this.run('sudo sh', { input: script })
    const out = Object.fromEntries(keys.map((k) => [k, null]))
    for (const line of stdout.split('\n')) {
      const i = line.indexOf('=')
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1)
    }
    return out
  }

  /** Read one sysctl as root, or null when the key doesn't exist. */
  async sysctl(key) {
    return (await this.sysctls([key]))[key]
  }

  /** Write one sysctl as root. Returns the error text, or '' on success. */
  async sysctlWrite(key, value) {
    const r = await this.sudo(`sysctl -q -w ${quote(`${key}=${value}`)}`, { check: false })
    // procps 3.3 exits 0 even when a write fails, so stderr decides.
    return r.code !== 0 || r.stderr.trim() ? (r.stderr.trim() || `exit ${r.code}`) : ''
  }

  /** The default-route interface, e.g. enp0s2. */
  async nic() {
    return (await this.run("ip -o route show default | awk '{print $5; exit}'")).stdout.trim()
  }

  /** Reboot: the guest shuts down, QEMU exits, and the same disk boots again. */
  async reboot() {
    await this.run('sudo systemctl reboot', { check: false, timeoutMs: 10_000 })
    const done = await Promise.race([this.exited, sleep(180_000).then(() => 'timeout')])
    if (done === 'timeout') {
      this.proc.kill()
      await this.exited
    }
    await this.launch()
  }

  async stop() {
    if (this.proc && this.proc.exitCode === null) {
      await this.run('sudo systemctl poweroff', { check: false, timeoutMs: 10_000 })
      const done = await Promise.race([this.exited, sleep(30_000).then(() => 'timeout')])
      if (done === 'timeout') this.proc.kill()
      await this.exited
    }
    if (!process.env.VM_KEEP) rmSync(this.dir, { recursive: true, force: true })
  }
}

/** Single-quote for a POSIX shell. */
export function quote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}
