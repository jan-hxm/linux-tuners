// Capture the learning pages' evidence: npm run vm:capture [image...]
//
// Boots each image fresh as the VM suite does (vm/lib/probeKinds.mjs GUEST),
// runs every probe from every src/tuners/<id>/probes.js through its kind, and
// writes src/learn/evidence/<image>.json. With no image, every image in
// vm/lib/images.mjs; VM_PARALLEL caps how many boot at once (default 5).
// `--dry-run` prints each probe's command and boots nothing.

import { mkdirSync, writeFileSync } from 'node:fs'
import { VM } from './lib/vm.mjs'
import { IMAGES } from './lib/images.mjs'
import { EVIDENCE_DIR, GUEST, KINDS, evidenceFile, evidencePath, loadProbes, runProbes } from './lib/probeKinds.mjs'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const ids = args.filter((a) => a !== '--dry-run')
const unknown = ids.filter((id) => !Object.hasOwn(IMAGES, id))
if (unknown.length) {
  console.error(`Unknown image ${unknown.join(', ')}; images: ${Object.keys(IMAGES).join(', ')}`)
  process.exit(2)
}
const images = ids.length ? ids : Object.keys(IMAGES)
const probes = await loadProbes()

if (dryRun) {
  for (const id of Object.keys(probes).sort()) console.log(`${id.padEnd(32)} ${KINDS[probes[id].kind].command(probes[id])}`)
  console.log(`${Object.keys(probes).length} probes; would capture ${images.join(', ')}`)
  process.exit(0)
}
if (!Object.keys(probes).length) {
  console.error('No probes: no src/tuners/<id>/probes.js exports PROBES yet.')
  process.exit(1)
}

async function capture(id) {
  const image = IMAGES[id]
  const vm = new VM(id)
  // As in vm/suite.mjs: the conntrack module is loaded at every boot, so the
  // network keys it brings exist here too.
  vm.afterBoot = (v) => v.sudo(image.expect.conntrackIpv4 ? 'modprobe nf_conntrack && modprobe nf_conntrack_ipv4' : 'modprobe nf_conntrack')
  try {
    await vm.start({ memory: GUEST.memory, disks: GUEST.disks })
    const kernel = (await vm.run('uname -r')).stdout.trim()
    const results = await runProbes(vm, probes)
    const capturedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    writeFileSync(evidencePath(id), evidenceFile({ image: id, kernel, capturedAt, probes: results }))
    const absent = Object.values(results).filter((r) => r.status === 'absent').length
    console.log(`[${id}] ${kernel}: ${Object.keys(results).length} probes, ${absent} absent -> ${evidencePath(id)}`)
  } finally {
    await vm.stop()
  }
}

const queue = [...images]
const failed = []
const parallel = Math.max(1, Number(process.env.VM_PARALLEL ?? 5) || 1)
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
  while (queue.length) {
    const id = queue.shift()
    try {
      await capture(id)
    } catch (e) {
      failed.push(id)
      console.error(`[${id}] capture failed, evidence left as it was: ${e.message}`)
    }
  }
}))
if (failed.length) process.exit(1)
